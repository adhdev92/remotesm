import { remoteEsmVm, vmMemo } from "./cache.ts";
import { isGitHubVirtualUrl, resolveGitHubVirtualImport } from "./github.ts";
import { getJson, getText } from "./network.ts";
import { appendQuery, isHttpUrl, toAbsoluteCdnUrl } from "./url.ts";
import type { DtsGraph, NormalizedRemoteEsmTarget, RemoteEsmOptions } from "./types.ts";

/** Resolve a target's declaration URL from explicit options or esm.sh ?meta. */
export async function resolveDeclarationUrl(target: NormalizedRemoteEsmTarget, options: RemoteEsmOptions = {}): Promise<string> {
  const cacheKey = JSON.stringify({
    explicit: target.dtsUrl || options.dtsUrl || "",
    metaUrl: target.metaUrl || options.metaUrl || "",
    runtimeUrl: target.runtimeUrl,
  });

  return vmMemo(remoteEsmVm.dtsUrl, cacheKey, async () => {
    if (target.dtsUrl || options.dtsUrl) {
      return toAbsoluteCdnUrl(target.dtsUrl || options.dtsUrl || "", target.runtimeUrl);
    }

    if (!target.metaUrl) {
      throw new Error(`No d.ts URL or metadata URL available for ${target.specifier}.`);
    }

    const meta: any = await getJson(target.metaUrl, options);
    const dtsPath = meta?.default?.dts || meta?.dts || meta?.types || meta?.typings;

    if (!dtsPath) {
      throw new Error(`No d.ts path found in metadata for ${target.specifier}.`);
    }

    return toAbsoluteCdnUrl(dtsPath, target.runtimeUrl);
  });
}

/** Fetch an entry declaration file plus reachable declaration imports. */
export async function loadDtsGraph(entryUrl: string, options: RemoteEsmOptions = {}): Promise<DtsGraph> {
  const {
    maxDepth = 5,
    maxFiles = 80,
    includeBareDtsImports = true,
  } = options;

  const graphCacheKey = JSON.stringify({
    entryUrl,
    maxDepth,
    maxFiles,
    includeBareDtsImports,
    esmBase: options.esmBase || "https://esm.sh",
  });

  return vmMemo(remoteEsmVm.dtsGraph, graphCacheKey, async () => {
    const visited = new Set<string>();
    const files: DtsGraph["files"] = [];
    const failed: DtsGraph["failed"] = [];

    async function visit(url: string, depth: number): Promise<void> {
      if (!url || visited.has(url)) return;
      if (files.length >= maxFiles) return;
      if (depth > maxDepth) return;

      visited.add(url);

      let text = "";

      try {
        text = await getText(url, options);
      } catch (error: any) {
        failed.push({
          url,
          error: String(error?.message || error),
        });
        return;
      }

      files.push({ url, text });

      const imports = extractDtsImportSpecifiers(text);

      for (const imported of imports) {
        if (files.length >= maxFiles) break;

        const resolved = await resolveDtsImport(url, imported, {
          ...options,
          includeBareDtsImports,
        });

        if (resolved) {
          await visit(resolved, depth + 1);
        }
      }
    }

    await visit(entryUrl, 0);

    return {
      entryUrl,
      files,
      failed,
    };
  });
}

/** Extract imported/referenced declaration specifiers from .d.ts text. */
export function extractDtsImportSpecifiers(text: string): string[] {
  const out = new Set<string>();
  const source = String(text || "");

  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bexport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\/\/\/\s*<reference\s+types=["']([^"']+)["']/g,
    /\/\/\/\s*<reference\s+path=["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(source))) {
      if (match[1]) out.add(match[1]);
    }
  }

  return Array.from(out);
}

/** Resolve an import found in a declaration file to a fetchable declaration URL. */
export async function resolveDtsImport(fromUrl: string, imported: string, options: RemoteEsmOptions = {}): Promise<string> {
  const spec = String(imported || "").trim();

  if (!spec) return "";
  if (spec.startsWith("node:")) return "";

  if (isHttpUrl(spec)) {
    return await firstWorkingDtsCandidate([spec], options);
  }

  if (spec.startsWith("/") && !spec.startsWith("//")) {
    const absolute = isGitHubVirtualUrl(fromUrl)
      ? resolveGitHubVirtualImport(fromUrl, spec)
      : `${new URL(fromUrl).origin}${spec}`;
    return await firstWorkingDtsCandidate(expandDtsCandidates(absolute), options);
  }

  if (spec.startsWith(".")) {
    const absolute = isGitHubVirtualUrl(fromUrl)
      ? resolveGitHubVirtualImport(fromUrl, spec)
      : new URL(spec, fromUrl).href;
    return await firstWorkingDtsCandidate(expandDtsCandidates(absolute), options);
  }

  if (!options.includeBareDtsImports) {
    return "";
  }

  try {
    const base = options.esmBase || "https://esm.sh";
    const metaUrl = appendQuery(`${base.replace(/\/$/, "")}/${spec.replace(/^\//, "")}`, { meta: "" });
    const meta: any = await getJson(metaUrl, options);
    const dtsPath = meta?.default?.dts || meta?.dts || meta?.types || meta?.typings;
    return dtsPath ? toAbsoluteCdnUrl(dtsPath, metaUrl) : "";
  } catch {
    return "";
  }
}

/** Expand a possible declaration path into candidate paths. */
export function expandDtsCandidates(url: string): string[] {
  if (/\.(d\.ts|d\.cts|d\.mts|ts|cts|mts)$/i.test(url)) {
    return [url];
  }

  return [
    url,
    `${url}.d.ts`,
    `${url}.d.cts`,
    `${url}.d.mts`,
    `${url}.ts`,
    `${url}/index.d.ts`,
    `${url}/index.d.cts`,
    `${url}/index.d.mts`,
  ];
}

/** Return the first declaration URL that can be fetched. */
export async function firstWorkingDtsCandidate(candidates: string[], options: RemoteEsmOptions = {}): Promise<string> {
  for (const candidate of candidates) {
    try {
      await getText(candidate, options);
      return candidate;
    } catch {
      // Try next candidate.
    }
  }

  return "";
}
