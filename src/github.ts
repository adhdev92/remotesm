import type {
  NormalizedRemoteEsmTarget,
  RemoteEsmGitHubOptions,
  RemoteEsmInput,
  RemoteEsmOptions,
} from "./types.ts";

export const DEFAULT_OCTOKIT_URL = "https://esm.sh/@octokit/core@7.0.6";
export const PRIVATE_GITHUB_PROTOCOL = "gh-private:";

export interface ParsedGitHubSpecifier {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

export interface GitHubVirtualFile {
  owner: string;
  repo: string;
  ref: string;
  path: string;
}

const octokitCache = new WeakMap<object, Promise<any>>();

/** Parse github:owner/repo[/package/path]#ref and gh: aliases. */
export function parseGitHubSpecifier(value: string): ParsedGitHubSpecifier | null {
  const raw = String(value || "").trim();
  const prefix = raw.startsWith("github:") ? "github:" : raw.startsWith("gh:") ? "gh:" : "";
  if (!prefix) return null;

  const body = raw.slice(prefix.length);
  const hashIndex = body.indexOf("#");
  const repoAndPath = hashIndex >= 0 ? body.slice(0, hashIndex) : body;
  const ref = hashIndex >= 0 ? body.slice(hashIndex + 1).trim() : "";
  const parts = repoAndPath.split("/").filter(Boolean);

  if (parts.length < 2) {
    throw new TypeError(`Invalid GitHub repository specifier: ${value}`);
  }

  return {
    owner: parts[0]!,
    repo: parts[1]!,
    ref,
    path: parts.slice(2).join("/"),
  };
}

/** Whether options request authenticated/direct GitHub resolution. */
export function hasPrivateGitHubTransport(options: RemoteEsmOptions = {}): boolean {
  const github = options.github;
  return !!github && !!(
    github.token ||
    github.fetch ||
    github.octokit ||
    github.octokitUrl
  );
}

/** Resolve an authenticated github:/gh: input to private virtual runtime/type URLs. */
export async function resolvePrivateGitHubTarget(
  input: RemoteEsmInput,
  options: RemoteEsmOptions = {},
): Promise<NormalizedRemoteEsmTarget | null> {
  if (!hasPrivateGitHubTransport(options)) return null;

  const specifier = typeof input === "string"
    ? input
    : input?.specifier || options.specifier || "";
  const parsed = parseGitHubSpecifier(specifier);
  if (!parsed) return null;

  const ref = parsed.ref || await getDefaultBranch(parsed.owner, parsed.repo, options);
  const explicitFile = isRuntimeFilePath(parsed.path) ? parsed.path : "";
  const packageRoot = explicitFile ? dirname(explicitFile) : parsed.path.replace(/^\/+|\/+$/g, "");

  let runtimePath = explicitFile;
  let dtsPath = options.dtsUrl || (typeof input === "object" && input ? input.dtsUrl || "" : "");

  if (!runtimePath) {
    const packagePath = joinPath(packageRoot, "package.json");
    const pkg = JSON.parse(await fetchGitHubFile(parsed.owner, parsed.repo, ref, packagePath, options));
    runtimePath = joinPath(packageRoot, pickPackageRuntimeEntry(pkg));

    if (!dtsPath) {
      const declarationEntry = pickPackageDeclarationEntry(pkg);
      if (declarationEntry) {
        dtsPath = joinPath(packageRoot, declarationEntry);
      }
    }
  }

  if (!runtimePath) {
    throw new Error(`Could not determine a runtime entry for ${specifier}.`);
  }

  if (!dtsPath) {
    dtsPath = await inferGitHubDeclarationPath(parsed.owner, parsed.repo, ref, runtimePath, options);
  } else if (!isAbsoluteUrl(dtsPath)) {
    dtsPath = joinPath(packageRoot, dtsPath);
  }

  const runtimeUrl = createGitHubVirtualUrl(parsed.owner, parsed.repo, ref, runtimePath);
  const dtsUrl = dtsPath
    ? (isAbsoluteUrl(dtsPath) ? dtsPath : createGitHubVirtualUrl(parsed.owner, parsed.repo, ref, dtsPath))
    : "";

  return {
    input,
    specifier,
    runtimeUrl,
    metaUrl: "",
    dtsUrl,
    isUrl: true,
    esmBase: options.esmBase || "https://esm.sh",
  };
}

/** Create an opaque URL that identifies a private GitHub file without embedding credentials. */
export function createGitHubVirtualUrl(owner: string, repo: string, ref: string, path: string): string {
  const encodedPath = String(path || "")
    .replace(/^\/+/, "")
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${PRIVATE_GITHUB_PROTOCOL}//${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(ref)}/${encodedPath}`;
}

export function isGitHubVirtualUrl(value: string): boolean {
  return String(value || "").startsWith(`${PRIVATE_GITHUB_PROTOCOL}//`);
}

export function parseGitHubVirtualUrl(value: string): GitHubVirtualFile {
  const url = new URL(value);
  if (url.protocol !== PRIVATE_GITHUB_PROTOCOL) {
    throw new TypeError(`Not a private GitHub virtual URL: ${value}`);
  }

  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  if (parts.length < 2) {
    throw new TypeError(`Malformed private GitHub virtual URL: ${value}`);
  }

  return {
    owner: decodeURIComponent(url.hostname),
    repo: parts[0]!,
    ref: parts[1]!,
    path: parts.slice(2).join("/"),
  };
}

/** Resolve a repository-local import while retaining owner/repo/ref identity. */
export function resolveGitHubVirtualImport(fromUrl: string, specifier: string): string {
  if (!isGitHubVirtualUrl(fromUrl)) return new URL(specifier, fromUrl).href;

  if (specifier.startsWith("/") && !specifier.startsWith("//")) {
    const file = parseGitHubVirtualUrl(fromUrl);
    return createGitHubVirtualUrl(file.owner, file.repo, file.ref, specifier.slice(1));
  }

  return new URL(specifier, fromUrl).href;
}

/** Read a gh-private: file via GitHub Contents API using fetch or Octokit. */
export async function fetchGitHubVirtualText(url: string, options: RemoteEsmOptions = {}): Promise<string> {
  const file = parseGitHubVirtualUrl(url);
  return fetchGitHubFile(file.owner, file.repo, file.ref, file.path, options);
}

export async function fetchGitHubFile(
  owner: string,
  repo: string,
  ref: string,
  path: string,
  options: RemoteEsmOptions = {},
): Promise<string> {
  const github = options.github || {};
  const octokit = await getOctokit(github);

  if (octokit) {
    const response = await octokit.request("GET /repos/{owner}/{repo}/contents/{path}", {
      owner,
      repo,
      path,
      ...(ref ? { ref } : {}),
      headers: { accept: "application/vnd.github.raw+json" },
    });
    return decodeGitHubContent(response?.data);
  }

  const apiBase = (github.apiBaseUrl || "https://api.github.com").replace(/\/$/, "");
  const url = new URL(`${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/contents/${path.split("/").map(encodeURIComponent).join("/")}`);
  if (ref) url.searchParams.set("ref", ref);

  const response = await githubFetch(url.href, {
    method: "GET",
    headers: githubHeaders(github, "application/vnd.github.raw+json"),
  }, github);

  if (!response?.ok) {
    throw githubHttpError("file", owner, repo, path, response);
  }

  return await response.text();
}

async function getDefaultBranch(owner: string, repo: string, options: RemoteEsmOptions): Promise<string> {
  const github = options.github || {};
  const octokit = await getOctokit(github);

  if (octokit) {
    const response = await octokit.request("GET /repos/{owner}/{repo}", { owner, repo });
    const branch = response?.data?.default_branch;
    if (!branch) throw new Error(`GitHub did not return a default branch for ${owner}/${repo}.`);
    return String(branch);
  }

  const apiBase = (github.apiBaseUrl || "https://api.github.com").replace(/\/$/, "");
  const response = await githubFetch(
    `${apiBase}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`,
    { method: "GET", headers: githubHeaders(github, "application/vnd.github+json") },
    github,
  );

  if (!response?.ok) {
    throw githubHttpError("repository", owner, repo, "", response);
  }

  const data = await response.json();
  if (!data?.default_branch) throw new Error(`GitHub did not return a default branch for ${owner}/${repo}.`);
  return String(data.default_branch);
}

async function inferGitHubDeclarationPath(
  owner: string,
  repo: string,
  ref: string,
  runtimePath: string,
  options: RemoteEsmOptions,
): Promise<string> {
  if (/\.(?:ts|tsx|mts|cts)$/i.test(runtimePath) && !/\.d\.(?:ts|mts|cts)$/i.test(runtimePath)) {
    return runtimePath;
  }

  const candidates = declarationCandidates(runtimePath);
  for (const candidate of candidates) {
    try {
      await fetchGitHubFile(owner, repo, ref, candidate, options);
      return candidate;
    } catch {
      // Try the next likely declaration path.
    }
  }
  return "";
}

function pickPackageRuntimeEntry(pkg: any): string {
  const root = packageExportRoot(pkg?.exports);
  return stripDotSlash(
    pickConditionalExport(root, ["browser", "import", "module", "default", "require"], true) ||
    (typeof pkg?.module === "string" ? pkg.module : "") ||
    (typeof pkg?.browser === "string" ? pkg.browser : "") ||
    (typeof pkg?.main === "string" ? pkg.main : "") ||
    "index.js",
  );
}

function pickPackageDeclarationEntry(pkg: any): string {
  const root = packageExportRoot(pkg?.exports);
  return stripDotSlash(
    pickConditionalExport(root, ["types", "typings"], false) ||
    (typeof pkg?.types === "string" ? pkg.types : "") ||
    (typeof pkg?.typings === "string" ? pkg.typings : ""),
  );
}

function packageExportRoot(exportsField: any): any {
  if (!exportsField || typeof exportsField !== "object" || Array.isArray(exportsField)) return exportsField;
  const keys = Object.keys(exportsField);
  return keys.some((key) => key.startsWith(".")) ? exportsField["."] : exportsField;
}

function pickConditionalExport(value: any, conditions: string[], fallback: boolean): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const picked = pickConditionalExport(item, conditions, fallback);
      if (picked) return picked;
    }
    return "";
  }
  if (!value || typeof value !== "object") return "";

  for (const condition of conditions) {
    const picked = pickConditionalExport(value[condition], conditions, fallback);
    if (picked) return picked;
  }

  if (fallback) {
    for (const child of Object.values(value)) {
      const picked = pickConditionalExport(child, conditions, fallback);
      if (picked) return picked;
    }
  }

  return "";
}

async function getOctokit(github: RemoteEsmGitHubOptions): Promise<any | null> {
  if (github.octokit && github.octokit !== true) {
    const candidate: any = github.octokit;
    if (typeof candidate.request === "function") return candidate;
    if (typeof candidate === "function") return new candidate(octokitConstructorOptions(github));
  }

  if (github.octokit !== true && !github.octokitUrl) return null;

  const key = github as object;
  let pending = octokitCache.get(key);
  if (!pending) {
    pending = (async () => {
      const moduleUrl = github.octokitUrl || DEFAULT_OCTOKIT_URL;
      const mod: any = await import(/* @vite-ignore */ moduleUrl);
      const Octokit = mod?.Octokit || mod?.default?.Octokit || mod?.default;
      if (typeof Octokit !== "function") {
        throw new TypeError(`No Octokit constructor found in ${moduleUrl}.`);
      }
      return new Octokit(octokitConstructorOptions(github));
    })();
    octokitCache.set(key, pending);
  }
  return pending;
}

function octokitConstructorOptions(github: RemoteEsmGitHubOptions): any {
  return {
    ...(github.token ? { auth: github.token } : {}),
    ...(github.fetch ? { request: { fetch: github.fetch } } : {}),
    ...(github.apiBaseUrl ? { baseUrl: github.apiBaseUrl } : {}),
  };
}

async function githubFetch(url: string, init: any, github: RemoteEsmGitHubOptions): Promise<any> {
  const remoteFetch = (globalThis as any).remoteFetchAsync;
  const fetchImpl = github.fetch || (typeof remoteFetch === "function" ? remoteFetch : globalThis.fetch);
  if (typeof fetchImpl !== "function") {
    throw new Error("No fetch implementation available for GitHub. Pass options.github.fetch or provide fetch/remoteFetchAsync globally.");
  }
  return await fetchImpl(url, init);
}

function githubHeaders(github: RemoteEsmGitHubOptions, accept: string): Record<string, string> {
  return {
    accept,
    "x-github-api-version": "2022-11-28",
    ...(github.token ? { authorization: `Bearer ${github.token}` } : {}),
  };
}

function decodeGitHubContent(data: any): string {
  if (typeof data === "string") return data;
  if (data && typeof data.content === "string") {
    const compact = data.content.replace(/\s+/g, "");
    if (typeof globalThis.atob === "function") {
      return decodeURIComponent(Array.from(globalThis.atob(compact), (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""));
    }
    const BufferCtor = (globalThis as any).Buffer;
    if (BufferCtor) return BufferCtor.from(compact, "base64").toString("utf8");
  }
  throw new TypeError("GitHub Contents API did not return decodable file content.");
}

function githubHttpError(kind: string, owner: string, repo: string, path: string, response: any): Error {
  const suffix = path ? `/${path}` : "";
  const error: any = new Error(`Failed to fetch private GitHub ${kind} ${owner}/${repo}${suffix}: ${response?.status ?? "unknown"}`);
  error.status = response?.status;
  error.code = "ERR_PRIVATE_GITHUB_FETCH";
  return error;
}

function declarationCandidates(runtimePath: string): string[] {
  const out = new Set<string>();
  const add = (value: string) => value && out.add(value);
  if (/\.mjs$/i.test(runtimePath)) {
    add(runtimePath.replace(/\.mjs$/i, ".d.mts"));
    add(runtimePath.replace(/\.mjs$/i, ".d.ts"));
  } else if (/\.cjs$/i.test(runtimePath)) {
    add(runtimePath.replace(/\.cjs$/i, ".d.cts"));
    add(runtimePath.replace(/\.cjs$/i, ".d.ts"));
  } else if (/\.(?:js|jsx)$/i.test(runtimePath)) {
    add(runtimePath.replace(/\.(?:js|jsx)$/i, ".d.ts"));
  }
  add(joinPath(dirname(runtimePath), "index.d.ts"));
  return Array.from(out);
}

function isRuntimeFilePath(path: string): boolean {
  return /\.(?:[cm]?[jt]sx?|mjs|cjs)$/i.test(path);
}

function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function stripDotSlash(value: string): string {
  return String(value || "").replace(/^\.\//, "");
}

function dirname(path: string): string {
  const clean = String(path || "").replace(/^\/+|\/+$/g, "");
  const slash = clean.lastIndexOf("/");
  return slash >= 0 ? clean.slice(0, slash) : "";
}

function joinPath(...parts: string[]): string {
  return parts
    .filter(Boolean)
    .map((part) => String(part).replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}
