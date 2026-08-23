import { remoteEsmVm } from "../cache.ts";
import { loadDtsGraph, resolveDeclarationUrl } from "../dtsGraph.ts";
import { resolvePrivateGitHubTarget } from "../github.ts";
import { attachCompletionTypeJsdoc, completionsToSafeJsdoc } from "../jsdoc.ts";
import type { JsdocConvertOptions } from "../jsdoc.ts";
import { DEFAULT_TYPESCRIPT_URL, importModuleCached } from "../network.ts";
import { normalizeRemoteEsmTarget } from "../url.ts";
import type {
  RemoteEsmImporter,
  RemoteEsmInput,
  RemoteEsmJsdocOptions,
  RemoteEsmOptions,
  RemoteEsmResult,
} from "../types.ts";
import { buildRemoteEsmImportMatches, getDtsConverter, importWithPackageCache } from "./lib/index.ts";

export * from "./lib/index.ts";

/**
 * Main public API. Imports a remote ESM runtime module, loads its declaration graph, converts it to
 * completion JSON + safe JSDoc, and caches everything in virtual memory.
 *
 * Accepts any of:
 * - "zod"
 * - "zod@4.4.3"
 * - "@octokit/core"
 * - "@octokit/core@7.0.6"
 * - "github:user/repo#commit"
 * - "gh:user/repo#commit"
 * - authenticated private GitHub repositories via options.github
 * - "https://esm.sh/@octokit/core@7.0.6"
 * - { runtimeUrl, dtsUrl, specifier }
 */
export async function remoteEsmImport(input: RemoteEsmInput, options: RemoteEsmOptions = {}): Promise<RemoteEsmResult> {
  const target = await resolvePrivateGitHubTarget(input, options) || normalizeRemoteEsmTarget(input, options);
  const {
    tsUrl = DEFAULT_TYPESCRIPT_URL,
    maxDepth = 5,
    maxFiles = 80,
    includeBareDtsImports = true,
    typeNameSuffix = "",
    unknownType,
    includeHeader = false,
    log = true,
  } = options;

  const packageCacheKey = JSON.stringify({
    input,
    target,
    tsUrl,
    maxDepth,
    maxFiles,
    includeBareDtsImports,
    typeNameSuffix,
    unknownType,
    includeHeader,
    jsdoc: options.jsdoc || null,
  });

  return await importWithPackageCache(packageCacheKey, async () => {
    const [moduleObject, dtsUrl, converter] = await Promise.all([
      importModuleCached(target.runtimeUrl, options),
      resolveDeclarationUrl(target, options),
      getDtsConverter(tsUrl),
    ]);

    const dtsGraph = await loadDtsGraph(dtsUrl, {
      ...options,
      maxDepth,
      maxFiles,
      includeBareDtsImports,
    });

    const combinedDts = dtsGraph.files
      .map((file) => ["", `/* ===== ${file.url} ===== */`, file.text].join("\n"))
      .join("\n");

    const completions = converter.convertText(combinedDts, {
      fileName: `${target.specifier || "remote"}.virtual.d.ts`,
    });

    const jsdocOptions: JsdocConvertOptions = {
      ...options,
      specifier: options.jsdoc?.importTypes?.specifier || target.specifier,
      includeGlobals: true,
      includeHeader,
      typeNameSuffix,
    };

    if (unknownType !== undefined) jsdocOptions.unknownType = unknownType;

    attachCompletionTypeJsdoc(completions, jsdocOptions);

    const jsdoc = completionsToSafeJsdoc(completions, jsdocOptions);

    const result: RemoteEsmResult = {
      input,
      specifier: target.specifier,
      libUrl: target.runtimeUrl,
      runtimeUrl: target.runtimeUrl,
      metaUrl: target.metaUrl,
      dtsUrl,
      module: moduleObject,
      dtsGraph,
      completions,
      imports: buildRemoteEsmImportMatches(moduleObject, completions, {
        importSpecifier: target.runtimeUrl,
        typeNameSuffix,
      }),
      jsdoc,
      memory: remoteEsmVm,
      pick(name: string, fallback?: any): any {
        if (moduleObject && name in moduleObject) return moduleObject[name];
        if (fallback !== undefined) return fallback;
        return moduleObject?.default ?? moduleObject;
      },
      asAny<T = any>(value: T): any {
        return value as any;
      },
    };

    if (log) {
      console.info("remoteEsmImport runtime:", target.runtimeUrl);
      console.info("remoteEsmImport types:", dtsUrl);
      console.info("remoteEsmImport d.ts files:", dtsGraph.files.map((file) => file.url));

      if (dtsGraph.failed.length) {
        console.warn("remoteEsmImport d.ts fetch failures:", dtsGraph.failed);
      }
    }

    return result;
  });
}

/**
 * Create a RemoteEsmImport function with reusable defaults captured once.
 * Per-call options override only fields that are explicitly defined.
 */
export function createRemoteEsmImport(defaultOptions: RemoteEsmOptions = {}): RemoteEsmImporter {
  const defaults = mergeRemoteEsmOptions({}, defaultOptions);

  return async (input: RemoteEsmInput, options: RemoteEsmOptions = {}) => {
    return await remoteEsmImport(input, mergeRemoteEsmOptions(defaults, options));
  };
}

/** Alias emphasizing one-time initialization of a configured importer. */
export const initRemoteEsmImport = createRemoteEsmImport;

/** Merge initialized defaults with per-call overrides while preserving undefined defaults. */
export function mergeRemoteEsmOptions(
  defaults: RemoteEsmOptions = {},
  overrides: RemoteEsmOptions = {},
): RemoteEsmOptions {
  const merged = mergeDefinedRecord(defaults, overrides) as RemoteEsmOptions;

  if (defaults.github || overrides.github) {
    merged.github = mergeDefinedRecord(defaults.github || {}, overrides.github || {});
  }

  if (defaults.jsdoc || overrides.jsdoc) {
    merged.jsdoc = mergeJsdocOptions(defaults.jsdoc, overrides.jsdoc);
  }

  return merged;
}

function mergeJsdocOptions(
  defaults: RemoteEsmJsdocOptions | undefined,
  overrides: RemoteEsmJsdocOptions | undefined,
): RemoteEsmJsdocOptions {
  const merged = mergeDefinedRecord(defaults || {}, overrides || {}) as RemoteEsmJsdocOptions;

  if (defaults?.tags || overrides?.tags) {
    merged.tags = mergeDefinedRecord(defaults?.tags || {}, overrides?.tags || {});
  }

  if (defaults?.importTypes || overrides?.importTypes) {
    merged.importTypes = mergeDefinedRecord(
      defaults?.importTypes || {},
      overrides?.importTypes || {},
    );
  }

  if (
    defaults?.shorthand &&
    typeof defaults.shorthand === "object" &&
    overrides?.shorthand &&
    typeof overrides.shorthand === "object"
  ) {
    merged.shorthand = mergeDefinedRecord(defaults.shorthand, overrides.shorthand);

    if (defaults.shorthand.types || overrides.shorthand.types) {
      merged.shorthand.types = mergeDefinedRecord(
        defaults.shorthand.types || {},
        overrides.shorthand.types || {},
      );
    }
  }

  return merged;
}

function mergeDefinedRecord<T extends Record<string, any>>(defaults: T, overrides: Partial<T>): T {
  const merged = { ...defaults } as T;

  for (const [key, value] of Object.entries(overrides)) {
    if (value !== undefined) {
      (merged as any)[key] = value;
    }
  }

  return merged;
}

/** Backwards-compatible alias for the earlier single-file API name. */
export const importCdnPackageWithTypes = remoteEsmImport;

export default importCdnPackageWithTypes;
