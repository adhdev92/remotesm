import { getJson } from "./network.ts";
import type { AnyRecord, NormalizedRemoteEsmTarget, RemoteEsmInput, RemoteEsmOptions } from "./types.ts";

/** Resolve the raw package.json manifest when the target has a package identity. */
export async function resolvePackageManifest(
  input: RemoteEsmInput,
  target: NormalizedRemoteEsmTarget,
  options: RemoteEsmOptions = {},
): Promise<AnyRecord | null> {
  if (target.manifest !== undefined) return target.manifest;

  const rawSpecifier = typeof input === "string"
    ? input
    : input?.specifier || options.specifier || target.specifier;

  if (isExplicitNonEsmUrlInput(input)) return null;

  let packagePath = "";
  if (/^(?:github:|gh:)/.test(rawSpecifier) || target.specifier.startsWith("gh/")) {
    packagePath = target.specifier;
  } else {
    const parsed = parseNpmPackageSpecifier(target.specifier);
    if (!parsed.name) return null;
    packagePath = `${parsed.name}${parsed.version ? `@${parsed.version}` : ""}`;
  }

  const manifestUrl = `${target.esmBase.replace(/\/$/, "")}/${packagePath.replace(/^\//, "")}/package.json?raw`;
  try {
    return await getJson<AnyRecord>(manifestUrl, options);
  } catch {
    return null;
  }
}

function isExplicitNonEsmUrlInput(input: RemoteEsmInput): boolean {
  const value = typeof input === "string" ? input : input?.runtimeUrl || input?.url || "";
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host !== "esm.sh" && !host.endsWith(".esm.sh");
  } catch {
    return true;
  }
}

export function parseNpmPackageSpecifier(specifier: string): { name: string; version: string } {
  const value = String(specifier || "").trim().replace(/^npm:/, "").replace(/^\/+/, "");
  if (!value) return { name: "", version: "" };

  if (value.startsWith("@")) {
    const scopeSlash = value.indexOf("/");
    if (scopeSlash < 0) return { name: "", version: "" };
    const subpathSlash = value.indexOf("/", scopeSlash + 1);
    const packagePart = subpathSlash >= 0 ? value.slice(0, subpathSlash) : value;
    const versionAt = packagePart.lastIndexOf("@");
    return versionAt > scopeSlash
      ? { name: packagePart.slice(0, versionAt), version: packagePart.slice(versionAt + 1) }
      : { name: packagePart, version: "" };
  }

  const subpathSlash = value.indexOf("/");
  const packagePart = subpathSlash >= 0 ? value.slice(0, subpathSlash) : value;
  const versionAt = packagePart.lastIndexOf("@");
  return versionAt > 0
    ? { name: packagePart.slice(0, versionAt), version: packagePart.slice(versionAt + 1) }
    : { name: packagePart, version: "" };
}
