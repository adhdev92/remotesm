/**
 * Remote package resolver + JS/JSDoc API surface extractor.
 * Designed for DOM-less environments with fetch + dynamic import.
 */

const DEFAULT_CDN = "https://esm.sh";
const DEFAULT_TS_URL = "https://esm.sh/typescript@6.0.3?target=es2022";

export async function remoteEsmImport(input, options = {}) {
  const opts = {
    cdn: DEFAULT_CDN,
    target: "es2022",
    pinVersion: true,
    importRuntime: true,
    fetchSource: true,
    analyzeSource: true,
    typescriptUrl: DEFAULT_TS_URL,
    query: {},
    baseUrl: getDefaultBaseUrl(),
    ...options,
  };

  const parsed = parsePackageInput(input, opts);

  let resolved;

  if (parsed.kind === "npm") {
    resolved = await resolveNpmViaEsmMeta(parsed, opts);
  } else if (parsed.kind === "url") {
    resolved = await resolveUrlInput(parsed, opts);
  } else if (parsed.kind === "path") {
    resolved = await resolvePathInput(parsed, opts);
  } else {
    throw new TypeError(`Unsupported package input kind: ${parsed.kind}`);
  }

  const runtimeModule = opts.importRuntime
    ? await import(/* @vite-ignore */ resolved.importUrl)
    : null;

  const sourceText = opts.fetchSource
    ? await tryFetchRawSource(resolved)
    : null;

  const typeInfo = await tryFetchTypeInfo(resolved);

  const apiIr = opts.analyzeSource && sourceText
    ? await parseJavaScriptApiSurface(sourceText, {
        package: resolved,
        runtimeExports: runtimeModule ? Object.keys(runtimeModule) : [],
        typescriptUrl: opts.typescriptUrl,
      })
    : null;

  return {
    ...resolved,
    module: runtimeModule,
    sourceText,
    typeInfo,
    apiIr,
  };
}

/**
 * Converts API IR to a conservative ASPECML-like string.
 * Treat this as the adapter seam: once specml/aspecml grammar is confirmed,
 * only this function should need grammar-level changes.
 */
export function apiIrToSpecMl(ir, options = {}) {
  const pkgIdent = safeIdent(ir.package?.name || "anonymous_package");
  const lines = [];

  lines.push(`# Generated API spec for ${ir.package?.name || "unknown"}`);
  if (ir.package?.version) lines.push(`# Version: ${ir.package.version}`);
  if (ir.package?.importUrl) lines.push(`# Source: ${ir.package.importUrl}`);
  lines.push("");
  lines.push(`api ${pkgIdent} {`);

  for (const item of ir.exports || []) {
    if (item.description) {
      for (const line of wrapComment(item.description)) {
        lines.push(`  /// ${line}`);
      }
    }

    if (item.kind === "function") {
      const params = item.params
        .map((p) => {
          const optional = p.optional ? "?" : "";
          return `${safeIdent(p.name)}${optional}: ${p.type || "unknown"}`;
        })
        .join(", ");

      lines.push(`  fn ${safeIdent(item.name)}(${params}): ${item.returns?.type || "unknown"}`);
      lines.push("");
      continue;
    }

    if (item.kind === "class") {
      lines.push(`  class ${safeIdent(item.name)}`);
      lines.push("");
      continue;
    }

    lines.push(`  export ${safeIdent(item.name)}: ${item.type || "unknown"}`);
    lines.push("");
  }

  lines.push("}");
  return lines.join("\n");
}

export async function validateSpecMlText(specText, options = {}) {
  const specmlUrl = options.specmlUrl || "https://esm.sh/specml@0.1.2";
  const specml = await import(/* @vite-ignore */ specmlUrl);

  const candidates = [
    "parse",
    "parseSpecML",
    "parseSpecMl",
    "compile",
    "validate",
    "validateSpecML",
    "validateSpecMl",
  ];

  const found = candidates.find((name) => typeof specml[name] === "function");

  if (!found) {
    return {
      ok: false,
      reason: "No obvious parser/validator export found on specml.",
      availableExports: Object.keys(specml),
    };
  }

  try {
    return {
      ok: true,
      method: found,
      result: specml[found](specText),
    };
  } catch (error) {
    return {
      ok: false,
      method: found,
      error,
    };
  }
}

/* -------------------------------------------------------------------------- */
/* Resolver                                                                    */
/* -------------------------------------------------------------------------- */

function parsePackageInput(input, opts) {
  const value = String(input || "").trim();
  if (!value) throw new TypeError("Package input cannot be empty.");

  if (isAbsoluteUrl(value)) {
    const url = new URL(value);
    return {
      kind: "url",
      url,
      query: Object.fromEntries(url.searchParams),
    };
  }

  if (looksLikePath(value)) {
    if (!opts.baseUrl) {
      throw new TypeError(
        "Relative/absolute path input requires options.baseUrl in a DOM-less environment."
      );
    }

    return {
      kind: "path",
      url: new URL(value, opts.baseUrl),
    };
  }

  return {
    kind: "npm",
    ...parseNpmSpecifier(value),
  };
}

function parseNpmSpecifier(input) {
  const { body, search } = splitSearch(input);
  const clean = body.replace(/^\/+/, "");
  const parts = clean.split("/").filter(Boolean);

  if (!parts.length) throw new TypeError(`Invalid npm package specifier: ${input}`);

  let name;
  let version = null;
  let subpath = "";

  if (parts[0].startsWith("@")) {
    if (!parts[1]) throw new TypeError(`Invalid scoped package specifier: ${input}`);

    const nameAndVersion = splitNameVersion(parts[1]);
    name = `${parts[0]}/${nameAndVersion.name}`;
    version = nameAndVersion.version;
    subpath = parts.slice(2).join("/");
  } else {
    const nameAndVersion = splitNameVersion(parts[0]);
    name = nameAndVersion.name;
    version = nameAndVersion.version;
    subpath = parts.slice(1).join("/");
  }

  return {
    name,
    version,
    subpath,
    query: Object.fromEntries(new URLSearchParams(search)),
  };
}

function splitNameVersion(segment) {
  const at = segment.lastIndexOf("@");

  // For unscoped names, @ at index 0 is not a version separator.
  if (at > 0) {
    return {
      name: segment.slice(0, at),
      version: segment.slice(at + 1),
    };
  }

  return {
    name: segment,
    version: null,
  };
}

async function resolveNpmViaEsmMeta(parsed, opts) {
  const metaSpecifier = formatNpmSpecifier(parsed);
  const metaUrl = buildCdnUrl(opts.cdn, metaSpecifier, {
    ...opts.query,
    ...parsed.query,
    meta: "",
  });

  const meta = await fetchJson(metaUrl);

  const name = meta.name || parsed.name;
  const version = opts.pinVersion
    ? meta.version || parsed.version
    : parsed.version || meta.version || null;

  const importSpecifier = formatNpmSpecifier({
    name,
    version,
    subpath: parsed.subpath,
  });

  const importUrl = buildCdnUrl(opts.cdn, importSpecifier, {
    target: opts.target,
    ...opts.query,
    ...parsed.query,
  });

  return {
    kind: "npm",
    cdn: normalizeCdn(opts.cdn),
    name,
    version,
    subpath: parsed.subpath || "",
    meta,
    metaUrl,
    importUrl,
  };
}

async function resolveUrlInput(parsed, opts) {
  const url = parsed.url;

  // If it is already an esm.sh package URL, infer what we can.
  if (url.hostname === "esm.sh" || url.hostname.endsWith(".esm.sh")) {
    const inferred = inferEsmPackageFromUrl(url);
    const query = Object.fromEntries(url.searchParams);

    return {
      kind: "url",
      cdn: `${url.protocol}//${url.host}`,
      name: inferred.name,
      version: inferred.version,
      subpath: inferred.subpath,
      meta: null,
      metaUrl: inferred.name
        ? buildCdnUrl(`${url.protocol}//${url.host}`, formatNpmSpecifier(inferred), {
            ...query,
            meta: "",
          })
        : null,
      importUrl: url.href,
    };
  }

  return {
    kind: "url",
    cdn: null,
    name: null,
    version: null,
    subpath: "",
    meta: null,
    metaUrl: null,
    importUrl: url.href,
  };
}

async function resolvePathInput(parsed) {
  // This handles URL-addressable package folders. In Airtable, a “local” path
  // only works if your environment actually exposes it via fetch/baseUrl.
  const inputUrl = parsed.url;
  const pkgJsonUrl = inputUrl.pathname.endsWith("/package.json")
    ? inputUrl
    : new URL("./package.json", inputUrl);

  const pkg = await fetchJson(pkgJsonUrl.href);
  const entry = pickPackageEntry(pkg);

  return {
    kind: "path",
    cdn: null,
    name: pkg.name || null,
    version: pkg.version || null,
    subpath: "",
    meta: pkg,
    metaUrl: pkgJsonUrl.href,
    importUrl: new URL(entry, pkgJsonUrl).href,
  };
}

function pickPackageEntry(pkg) {
  const rootExport = pkg.exports && pkg.exports["."];

  if (typeof rootExport === "string") return rootExport;
  if (rootExport?.import) return rootExport.import;
  if (rootExport?.default) return rootExport.default;

  return pkg.module || pkg.browser || pkg.main || "./index.js";
}

function inferEsmPackageFromUrl(url) {
  const parts = url.pathname.replace(/^\/+/, "").split("/").filter(Boolean);

  if (!parts.length) return { name: null, version: null, subpath: "" };

  if (parts[0].startsWith("@")) {
    const second = parts[1] || "";
    const nv = splitNameVersion(second);
    return {
      name: `${parts[0]}/${nv.name}`,
      version: nv.version,
      subpath: parts.slice(2).join("/"),
    };
  }

  const nv = splitNameVersion(parts[0]);
  return {
    name: nv.name,
    version: nv.version,
    subpath: parts.slice(1).join("/"),
  };
}

function formatNpmSpecifier({ name, version, subpath }) {
  if (!name) throw new TypeError("Cannot format npm specifier without package name.");

  let out;

  if (name.startsWith("@")) {
    const [scope, pkg] = name.split("/");
    out = `${scope}/${pkg}${version ? `@${version}` : ""}`;
  } else {
    out = `${name}${version ? `@${version}` : ""}`;
  }

  if (subpath) out += `/${String(subpath).replace(/^\/+/, "")}`;
  return out;
}

function buildCdnUrl(cdn, specifier, query = {}) {
  const base = normalizeCdn(cdn);
  const url = new URL(`${base}/${specifier}`);

  for (const [key, value] of Object.entries(query)) {
    if (value === false || value == null) continue;

    if (value === true || value === "") {
      appendSearchFlag(url, key);
    } else {
      url.searchParams.set(key, String(value));
    }
  }

  return url.href;
}

function normalizeCdn(cdn) {
  return String(cdn || DEFAULT_CDN).replace(/\/+$/, "");
}

function appendSearchFlag(url, flag) {
  const raw = url.href;
  const sep = raw.includes("?") ? "&" : "?";
  const next = `${raw}${sep}${encodeURIComponent(flag)}`;
  url.href = next;
}

/* -------------------------------------------------------------------------- */
/* Source + d.ts discovery                                                     */
/* -------------------------------------------------------------------------- */

async function tryFetchRawSource(resolved) {
  // esm.sh documents ?raw as the way to fetch raw package source instead of
  // transformed/bundled ESM. For JSDoc, raw is much more useful.
  if (!resolved.importUrl) return null;

  const rawUrl = new URL(resolved.importUrl);
  appendSearchFlag(rawUrl, "raw");

  try {
    const res = await fetch(rawUrl.href);
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function tryFetchTypeInfo(resolved) {
  const out = {
    dtsUrl: null,
    dtsText: null,
    source: null,
  };

  if (resolved.meta?.dts) {
    out.dtsUrl = new URL(resolved.meta.dts, resolved.metaUrl || resolved.importUrl).href;
    out.source = "esm-meta.dts";
  }

  if (!out.dtsUrl && resolved.importUrl) {
    out.dtsUrl = await tryReadTypesHeader(resolved.importUrl);
    if (out.dtsUrl) out.source = "X-TypeScript-Types";
  }

  if (out.dtsUrl) {
    try {
      const res = await fetch(out.dtsUrl);
      if (res.ok) out.dtsText = await res.text();
    } catch {
      // Leave dtsText null.
    }
  }

  return out;
}

async function tryReadTypesHeader(importUrl) {
  for (const method of ["HEAD", "GET"]) {
    try {
      const res = await fetch(importUrl, { method });
      const header =
        res.headers.get("X-TypeScript-Types") ||
        res.headers.get("x-typescript-types");

      if (header) return new URL(header, importUrl).href;
    } catch {
      // Continue to GET fallback.
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* TypeScript/JSDoc API extraction                                             */
/* -------------------------------------------------------------------------- */

export async function parseJavaScriptApiSurface(sourceText, options = {}) {
  const tsModule = options.typescript ||
    await import(/* @vite-ignore */ (options.typescriptUrl || DEFAULT_TS_URL));
  const ts = tsModule.default || tsModule;

  const sf = ts.createSourceFile(
    options.fileName || "remote-module.js",
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const runtimeExports = new Set(options.runtimeExports || []);
  const explicitExports = collectExplicitExports(ts, sf);
  const exports = [];

  for (const statement of sf.statements) {
    if (ts.isFunctionDeclaration(statement)) {
      const name = statement.name?.text || (hasDefaultModifier(ts, statement) ? "default" : null);
      if (!name) continue;

      const exportedName = explicitExports.get(name) || name;

      if (isExported(ts, statement) || runtimeExports.has(exportedName) || explicitExports.has(name)) {
        exports.push(functionDeclToIr(ts, sf, sourceText, statement, exportedName));
      }
    }

    if (ts.isClassDeclaration(statement)) {
      const name = statement.name?.text || (hasDefaultModifier(ts, statement) ? "default" : null);
      if (!name) continue;

      const exportedName = explicitExports.get(name) || name;

      if (isExported(ts, statement) || runtimeExports.has(exportedName) || explicitExports.has(name)) {
        exports.push({
          kind: "class",
          name: exportedName,
          description: parseJsDoc(findLeadingJsDoc(sourceText, statement.pos)).description,
          tags: parseJsDoc(findLeadingJsDoc(sourceText, statement.pos)).tags,
        });
      }
    }

    if (ts.isVariableStatement(statement)) {
      const exported = isExported(ts, statement);

      for (const decl of statement.declarationList.declarations) {
        const name = decl.name?.getText(sf);
        if (!name) continue;

        const exportedName = explicitExports.get(name) || name;

        if (!exported && !runtimeExports.has(exportedName) && !explicitExports.has(name)) {
          continue;
        }

        const init = decl.initializer;

        if (init && (ts.isArrowFunction(init) || ts.isFunctionExpression(init))) {
          exports.push(functionDeclToIr(ts, sf, sourceText, init, exportedName, statement.pos));
        } else {
          const jsdoc = parseJsDoc(findLeadingJsDoc(sourceText, statement.pos));
          exports.push({
            kind: "value",
            name: exportedName,
            type: "unknown",
            description: jsdoc.description,
            tags: jsdoc.tags,
          });
        }
      }
    }
  }

  return {
    kind: "module-api",
    package: options.package || null,
    exports,
  };
}

function collectExplicitExports(ts, sf) {
  const map = new Map();

  for (const statement of sf.statements) {
    if (!ts.isExportDeclaration(statement)) continue;
    if (!statement.exportClause) continue;
    if (!ts.isNamedExports(statement.exportClause)) continue;

    for (const el of statement.exportClause.elements) {
      const local = el.propertyName?.text || el.name.text;
      const exported = el.name.text;
      map.set(local, exported);
    }
  }

  return map;
}

function functionDeclToIr(ts, sf, sourceText, node, exportedName, jsDocPos = node.pos) {
  const jsdoc = parseJsDoc(findLeadingJsDoc(sourceText, jsDocPos));
  const paramTags = new Map(jsdoc.params.map((p) => [p.name, p]));

  const params = (node.parameters || []).map((p) => {
    const name = p.name?.getText(sf) || "arg";
    const tag = paramTags.get(name);

    return {
      name,
      type: p.type?.getText(sf) || tag?.type || inferParamTypeFromSyntax(p, sf) || "unknown",
      optional: Boolean(p.questionToken) || /^\[.+\]$/.test(tag?.rawName || ""),
      description: tag?.description || "",
    };
  });

  return {
    kind: "function",
    name: exportedName,
    description: jsdoc.description,
    params,
    returns: {
      type: node.type?.getText(sf) || jsdoc.returns?.type || "unknown",
      description: jsdoc.returns?.description || "",
    },
    tags: jsdoc.tags,
  };
}

function inferParamTypeFromSyntax(param, sf) {
  const text = param.getText(sf);

  if (text.includes("...")) return "unknown[]";
  if (text.includes("=")) return "unknown";
  return null;
}

function isExported(ts, node) {
  return getModifiers(ts, node).some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

function hasDefaultModifier(ts, node) {
  return getModifiers(ts, node).some((m) => m.kind === ts.SyntaxKind.DefaultKeyword);
}

function getModifiers(ts, node) {
  if (typeof ts.getModifiers === "function") return ts.getModifiers(node) || [];
  return node.modifiers || [];
}

function findLeadingJsDoc(source, pos) {
  const before = source.slice(0, pos);
  const match = before.match(/\/\*\*[\s\S]*?\*\/\s*$/);
  return match ? match[0] : "";
}

function parseJsDoc(block) {
  const empty = {
    description: "",
    params: [],
    returns: null,
    tags: [],
  };

  if (!block) return empty;

  const lines = block
    .replace(/^\/\*\*/, "")
    .replace(/\*\/$/, "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\*\s?/, "").trimEnd());

  const description = [];
  const tags = [];
  let current = null;

  for (const line of lines) {
    const tagMatch = line.match(/^@(\S+)\s*(.*)$/);

    if (tagMatch) {
      current = {
        tag: tagMatch[1],
        text: tagMatch[2] || "",
      };
      tags.push(current);
      continue;
    }

    if (current) {
      current.text += current.text ? `\n${line}` : line;
    } else if (line.trim()) {
      description.push(line.trim());
    }
  }

  const params = tags
    .filter((t) => ["param", "arg", "argument"].includes(t.tag))
    .map(parseParamTag)
    .filter(Boolean);

  const returnsTag = tags.find((t) => ["returns", "return"].includes(t.tag));
  const returns = returnsTag ? parseReturnsTag(returnsTag) : null;

  return {
    description: description.join("\n").trim(),
    params,
    returns,
    tags,
  };
}

function parseParamTag(tag) {
  const text = tag.text.trim();

  const typed = text.match(/^\{([^}]+)\}\s+(\[[^\]]+\]|[^\s]+)\s*-?\s*([\s\S]*)$/);
  if (typed) {
    return {
      name: normalizeParamName(typed[2]),
      rawName: typed[2],
      type: typed[1].trim(),
      description: typed[3].trim(),
    };
  }

  const untyped = text.match(/^(\[[^\]]+\]|[^\s]+)\s*-?\s*([\s\S]*)$/);
  if (untyped) {
    return {
      name: normalizeParamName(untyped[1]),
      rawName: untyped[1],
      type: "unknown",
      description: untyped[2].trim(),
    };
  }

  return null;
}

function parseReturnsTag(tag) {
  const text = tag.text.trim();

  const typed = text.match(/^\{([^}]+)\}\s*-?\s*([\s\S]*)$/);
  if (typed) {
    return {
      type: typed[1].trim(),
      description: typed[2].trim(),
    };
  }

  return {
    type: "unknown",
    description: text,
  };
}

function normalizeParamName(name) {
  return name
    .replace(/^\[/, "")
    .replace(/\]$/, "")
    .replace(/=.*$/, "")
    .replace(/^\.\.\./, "");
}

/* -------------------------------------------------------------------------- */
/* Utilities                                                                   */
/* -------------------------------------------------------------------------- */

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch JSON: ${res.status} ${res.statusText} :: ${url}`);
  }
  return await res.json();
}

function splitSearch(input) {
  const index = input.search(/[?#]/);
  if (index === -1) return { body: input, search: "" };

  const body = input.slice(0, index);
  const suffix = input.slice(index);

  const q = suffix.startsWith("?")
    ? suffix.slice(1).split("#")[0]
    : "";

  return { body, search: q };
}

function isAbsoluteUrl(value) {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function looksLikePath(value) {
  return (
    value.startsWith("./") ||
    value.startsWith("../") ||
    value.startsWith("/") ||
    value.startsWith("file:")
  );
}

function getDefaultBaseUrl() {
  return globalThis.location?.href || null;
}

function safeIdent(value) {
  return String(value || "unknown")
    .replace(/^@/, "")
    .replace(/[^\w$]+/g, "_")
    .replace(/^(\d)/, "_$1");
}

function wrapComment(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}