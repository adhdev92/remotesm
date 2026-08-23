import packageJson from "../package.json" with { type: "json" };
import { remoteEsmVm, vmMemo } from "./cache.ts";

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

/** Exact TypeScript version used for remote compiler imports. */
export const TYPESCRIPT_VERSION = getPinnedTypeScriptVersion(packageJson.devDependencies?.typescript);

/** Default esm.sh URL for the TypeScript compiler API. */
export const DEFAULT_TYPESCRIPT_URL = `https://esm.sh/typescript@${TYPESCRIPT_VERSION}`;

/** Fetch text through Airtable remoteFetchAsync when available, otherwise fetch. */
export async function getText(url: string): Promise<string> {
  return vmMemo(remoteEsmVm.text, url, async () => {
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
export async function getJson<T = any>(url: string): Promise<T> {
  return vmMemo(remoteEsmVm.json, url, async () => {
    return JSON.parse(await getText(url));
  });
}

/** Import a module URL with memory caching. */
export async function importModuleCached<T = any>(url: string): Promise<T> {
  return vmMemo(remoteEsmVm.module, url, async () => {
    return await import(url) as T;
  });
}

/** Load the TypeScript compiler API from esm.sh. */
export async function loadTypeScript(tsUrl = DEFAULT_TYPESCRIPT_URL): Promise<any> {
  if (remoteEsmVm.ts) return remoteEsmVm.ts;

  const tsModule: any = await import(tsUrl);
  remoteEsmVm.ts = tsModule.default || tsModule;

  return remoteEsmVm.ts;
}

function getPinnedTypeScriptVersion(value: unknown): string {
  if (typeof value !== "string" || !exactVersionPattern.test(value)) {
    throw new Error(
      `package.json devDependencies.typescript must be an exact version, received ${JSON.stringify(value)}.`,
    );
  }

  return value;
}
