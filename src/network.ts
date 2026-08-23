import packageJson from "../package.json" with { type: "json" };
import { remoteEsmVm, vmMemo } from "./cache.ts";
import {
  fetchGitHubVirtualText,
  isGitHubVirtualUrl,
  parseGitHubVirtualUrl,
  resolveGitHubVirtualImport,
} from "./github.ts";
import type { RemoteEsmOptions } from "./types.ts";
import { esmUrl } from "./url.ts";

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** Exact TypeScript version used for remote compiler imports. */
export const TYPESCRIPT_VERSION = getPinnedTypeScriptVersion(packageJson.devDependencies?.typescript);

/** Default esm.sh URL for the TypeScript compiler API. */
export const DEFAULT_TYPESCRIPT_URL = `https://esm.sh/typescript@${TYPESCRIPT_VERSION}`;

/** Fetch text through authenticated GitHub transport, Airtable remoteFetchAsync, or fetch. */
export async function getText(url: string, options: RemoteEsmOptions = {}): Promise<string> {
  return vmMemo(remoteEsmVm.text, url, async () => {
    if (isGitHubVirtualUrl(url)) {
      return await fetchGitHubVirtualText(url, options);
    }

    const remoteFetch = (globalThis as any).remoteFetchAsync;
    let response: any;

    if (typeof remoteFetch === "function") {
      response = await remoteFetch(url);
    } else if (typeof fetch === "function") {
      response = await fetch(url);
    } else {
      throw new Error("No fetch API found. Expected remoteFetchAsync or fetch.");
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }

    return await response.text();
  });
}

/** Fetch and parse JSON. */
export async function getJson<T = any>(url: string, options: RemoteEsmOptions = {}): Promise<T> {
  return vmMemo(remoteEsmVm.json, url, async () => {
    return JSON.parse(await getText(url, options));
  });
}

/** Import a module URL with memory caching, including authenticated GitHub virtual modules. */
export async function importModuleCached<T = any>(url: string, options: RemoteEsmOptions = {}): Promise<T> {
  return vmMemo(remoteEsmVm.module, url, async () => {
    if (isGitHubVirtualUrl(url)) {
      return await importGitHubVirtualModule(url, options) as T;
    }
    return await import(url) as T;
  });
}

/** Ensure a bare esm.sh TypeScript URL is pinned to the package.json compiler version. */
export function resolveTypeScriptUrl(tsUrl = DEFAULT_TYPESCRIPT_URL): string {
  const url = new URL(tsUrl);
  const hostname = url.hostname.toLowerCase();

  if ((hostname === "esm.sh" || hostname.endsWith(".esm.sh")) && url.pathname === "/typescript") {
    url.pathname = `/typescript@${TYPESCRIPT_VERSION}`;
    return url.href;
  }

  return tsUrl;
}

/** Load the TypeScript compiler API from esm.sh. */
export async function loadTypeScript(tsUrl = DEFAULT_TYPESCRIPT_URL): Promise<any> {
  if (remoteEsmVm.ts) return remoteEsmVm.ts;

  const resolvedTsUrl = resolveTypeScriptUrl(tsUrl);
  const tsModule: any = await import(resolvedTsUrl);
  remoteEsmVm.ts = tsModule.default || tsModule;

  return remoteEsmVm.ts;
}

async function importGitHubVirtualModule(url: string, options: RemoteEsmOptions): Promise<any> {
  const generated = new Map<string, Promise<string>>();
  const rootUrl = await buildGitHubExecutableUrl(url, options, generated, []);
  return await import(rootUrl);
}

async function buildGitHubExecutableUrl(
  url: string,
  options: RemoteEsmOptions,
  generated: Map<string, Promise<string>>,
  stack: string[],
): Promise<string> {
  if (stack.includes(url)) {
    const cycle = [...stack.slice(stack.indexOf(url)), url]
      .map((item) => parseGitHubVirtualUrl(item).path)
      .join(" -> ");
    const error: any = new Error(
      `Cyclic private GitHub runtime imports are not supported by the header-auth loader: ${cycle}. ` +
      "Point the package entry at a pre-bundled ESM build to avoid the cycle.",
    );
    error.code = "ERR_PRIVATE_GITHUB_MODULE_CYCLE";
    throw error;
  }

  const cached = generated.get(url);
  if (cached) return await cached;

  const pending = (async () => {
    const file = parseGitHubVirtualUrl(url);
    let source = await getText(url, options);

    if (/\.json$/i.test(file.path)) {
      source = `export default ${source.trim()};`;
    } else if (/\.(?:ts|tsx|mts|cts)$/i.test(file.path) && !/\.d\.(?:ts|mts|cts)$/i.test(file.path)) {
      const ts = await loadTypeScript(options.tsUrl || DEFAULT_TYPESCRIPT_URL);
      source = ts.transpileModule(source, {
        fileName: file.path,
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit?.ReactJSX ?? ts.JsxEmit?.Preserve,
          sourceMap: false,
          inlineSourceMap: false,
        },
      }).outputText;
    }

    const nextStack = [...stack, url];
    source = await rewriteModuleSpecifiersAsync(source, async (specifier) => {
      if (!specifier || specifier.startsWith("node:") || specifier.startsWith("data:") || specifier.startsWith("blob:")) {
        return specifier;
      }

      if (specifier.startsWith(".") || (specifier.startsWith("/") && !specifier.startsWith("//"))) {
        const child = resolveGitHubVirtualImport(url, specifier);
        return await buildGitHubExecutableUrl(child, options, generated, nextStack);
      }

      if (/^[A-Za-z][A-Za-z\d+.-]*:/.test(specifier)) {
        return specifier;
      }

      return esmUrl(specifier, options);
    });

    source += `\n//# sourceURL=${url}\n`;
    return `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
  })();

  generated.set(url, pending);
  try {
    return await pending;
  } catch (error) {
    generated.delete(url);
    throw error;
  }
}

async function rewriteModuleSpecifiersAsync(
  source: string,
  rewrite: (specifier: string) => Promise<string>,
): Promise<string> {
  let result = String(source);

  result = await replaceAsync(
    result,
    /(\b(?:import|export)\s+(?:type\s+)?(?:[^"'`;]*?\s+from\s*)?)(["'])([^"']+)\2/g,
    async (_full, prefix, quote, specifier) => `${prefix}${quote}${await rewrite(specifier)}${quote}`,
  );

  result = await replaceAsync(
    result,
    /(\bimport\s*\(\s*)(["'])([^"']+)\2(\s*\))/g,
    async (_full, prefix, quote, specifier, suffix) => `${prefix}${quote}${await rewrite(specifier)}${quote}${suffix}`,
  );

  return result;
}

async function replaceAsync(
  source: string,
  pattern: RegExp,
  replacer: (...args: string[]) => Promise<string>,
): Promise<string> {
  const matches = Array.from(source.matchAll(pattern));
  if (!matches.length) return source;

  let cursor = 0;
  const out: string[] = [];

  for (const match of matches) {
    const index = match.index ?? 0;
    out.push(source.slice(cursor, index));
    out.push(await replacer(...match.map((value) => value ?? "")));
    cursor = index + match[0].length;
  }

  out.push(source.slice(cursor));
  return out.join("");
}

function getPinnedTypeScriptVersion(value: unknown): string {
  if (typeof value !== "string" || !exactVersionPattern.test(value)) {
    throw new Error(
      `package.json devDependencies.typescript must be an exact version, received ${JSON.stringify(value)}.`,
    );
  }

  return value;
}
