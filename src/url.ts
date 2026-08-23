import type { NormalizedRemoteEsmTarget, RemoteEsmInput, RemoteEsmOptions } from "./types.ts";

/** Test whether a string is an absolute URL with any scheme. */
export function isAbsoluteUrl(value: string): boolean {
  try {
    new URL(String(value || ""));
    return true;
  } catch {
    return false;
  }
}

/** Test whether a string is an absolute HTTP(S) URL. */
export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(String(value || ""));
}

/** Append query params to a URL. Empty-string values become valueless query flags. */
export function appendQuery(url: string, params: Record<string, string | number | boolean | null | undefined> = {}): string {
  const u = new URL(url);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== false) {
      u.searchParams.set(key, value === true ? "" : String(value));
    }
  }

  return u.href.replace(/=$/, "");
}

/** Build an esm.sh runtime URL from an npm/GitHub specifier. */
export function esmUrl(specifier: string, options: RemoteEsmOptions = {}): string {
  const base = options.esmBase || "https://esm.sh";
  const cleanBase = base.replace(/\/$/, "");
  const cleanSpecifier = normalizePackageSpecifier(String(specifier).replace(/^\//, ""));

  let url = `${cleanBase}/${cleanSpecifier}`;

  if (options.bundle) url = appendQuery(url, { bundle: "" });
  if (options.target) url = appendQuery(url, { target: options.target });
  if (options.dev) url = appendQuery(url, { dev: "" });

  return url;
}

/** Build an esm.sh metadata URL. */
export function esmMetaUrl(specifier: string, options: RemoteEsmOptions = {}): string {
  return appendQuery(esmUrl(specifier, options), { meta: "" });
}

/** Convert a metadata/declaration path to an absolute URL. */
export function toAbsoluteCdnUrl(pathOrUrl: string, baseUrlOrOptions: string | RemoteEsmOptions = {}): string {
  if (!pathOrUrl) return "";
  if (isAbsoluteUrl(pathOrUrl)) return pathOrUrl;

  if (typeof baseUrlOrOptions === "string" && isAbsoluteUrl(baseUrlOrOptions)) {
    return new URL(pathOrUrl, baseUrlOrOptions).href;
  }

  const options = baseUrlOrOptions as RemoteEsmOptions;
  const base = options.esmBase || "https://esm.sh";
  return `${base.replace(/\/$/, "")}/${String(pathOrUrl).replace(/^\//, "")}`;
}

/** Normalize a user-supplied package/URL/object into runtime/meta/dts URLs. */
export function normalizeRemoteEsmTarget(input: RemoteEsmInput, options: RemoteEsmOptions = {}): NormalizedRemoteEsmTarget {
  const esmBase = options.esmBase || "https://esm.sh";

  if (typeof input === "object" && input !== null) {
    const runtimeUrl = input.runtimeUrl || input.url || options.runtimeUrl || options.url || "";
    const rawSpecifier = input.specifier || options.specifier || (runtimeUrl ? inferSpecifierFromUrl(runtimeUrl) : "");
    const specifier = rawSpecifier || runtimeUrl;
    const finalRuntimeUrl = runtimeUrl || esmUrl(specifier, options);

    return {
      input,
      specifier,
      runtimeUrl: finalRuntimeUrl,
      metaUrl: input.metaUrl || options.metaUrl || (finalRuntimeUrl ? appendQuery(finalRuntimeUrl, { meta: "" }) : ""),
      dtsUrl: input.dtsUrl || options.dtsUrl || "",
      isUrl: !!runtimeUrl && isHttpUrl(runtimeUrl),
      esmBase,
    };
  }

  const raw = String(input || "").trim();
  const optionRuntimeUrl = options.runtimeUrl || options.url || "";

  if (optionRuntimeUrl || isHttpUrl(raw)) {
    const runtimeUrl = optionRuntimeUrl || raw;
    const specifier = options.specifier || inferSpecifierFromUrl(runtimeUrl) || raw;

    return {
      input,
      specifier,
      runtimeUrl,
      metaUrl: options.metaUrl || appendQuery(runtimeUrl, { meta: "" }),
      dtsUrl: options.dtsUrl || "",
      isUrl: true,
      esmBase,
    };
  }

  const specifier = normalizePackageSpecifier(raw || options.specifier || "");

  return {
    input,
    specifier,
    runtimeUrl: esmUrl(specifier, options),
    metaUrl: options.metaUrl || esmMetaUrl(specifier, options),
    dtsUrl: options.dtsUrl || "",
    isUrl: false,
    esmBase,
  };
}

/** Normalize supported aliases such as npm: and github:user/repo#commit. */
export function normalizePackageSpecifier(specifier: string): string {
  let value = String(specifier || "").trim();

  if (value.startsWith("npm:")) {
    return value.slice(4);
  }

  if (value.startsWith("github:")) {
    value = value.slice("github:".length);
    const [repoPath, commit] = value.split("#");
    return commit ? `gh/${repoPath}@${commit}` : `gh/${repoPath}`;
  }

  if (value.startsWith("gh:")) {
    value = value.slice("gh:".length);
    const [repoPath, commit] = value.split("#");
    return commit ? `gh/${repoPath}@${commit}` : `gh/${repoPath}`;
  }

  return value;
}

/** Infer a package-ish specifier from a CDN URL when possible. */
export function inferSpecifierFromUrl(url: string): string {
  try {
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname.replace(/^\/+/, ""));

    if (u.hostname.includes("esm.sh")) {
      return path.replace(/^(stable|v\d+)\//, "");
    }

    if (u.hostname.includes("unpkg.com") || u.hostname.includes("jsdelivr.net")) {
      return path.replace(/^npm\//, "");
    }

    return path || url;
  } catch {
    return url;
  }
}
