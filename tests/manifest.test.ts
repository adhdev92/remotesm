import assert from "node:assert/strict";
import test from "node:test";
import {
  clearRemoteEsmVm,
  normalizeRemoteEsmTarget,
  parseNpmPackageSpecifier,
  resolvePackageManifest,
} from "../index.ts";

test("npm package specifiers preserve package roots and versions", () => {
  assert.deepEqual(parseNpmPackageSpecifier("litdb@0.0.33"), { name: "litdb", version: "0.0.33" });
  assert.deepEqual(parseNpmPackageSpecifier("@octokit/core@7.0.6"), { name: "@octokit/core", version: "7.0.6" });
  assert.deepEqual(parseNpmPackageSpecifier("@octokit/core@7.0.6/subpath"), { name: "@octokit/core", version: "7.0.6" });
});

test("public npm manifests are fetched as raw package.json and preserved", async () => {
  clearRemoteEsmVm();
  const previous = (globalThis as any).remoteFetchAsync;
  const calls: string[] = [];
  (globalThis as any).remoteFetchAsync = async (url: string) => {
    calls.push(String(url));
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        name: "fixture",
        version: "1.2.3",
        typings: "./legacy.d.ts",
        exports: { ".": { types: "./dist/index.d.ts", import: "./dist/index.js" } },
      }),
    };
  };

  try {
    const input = "fixture@1.2.3";
    const target = normalizeRemoteEsmTarget(input);
    const manifest = await resolvePackageManifest(input, target);
    assert.equal(manifest?.name, "fixture");
    assert.equal(manifest?.typings, "./legacy.d.ts");
    assert.equal(manifest?.exports?.["."]?.types, "./dist/index.d.ts");
    assert.deepEqual(calls, ["https://esm.sh/fixture@1.2.3/package.json?raw"]);
  } finally {
    (globalThis as any).remoteFetchAsync = previous;
    clearRemoteEsmVm();
  }
});

test("public GitHub manifests use the normalized esm.sh GitHub package path", async () => {
  clearRemoteEsmVm();
  const previous = (globalThis as any).remoteFetchAsync;
  const calls: string[] = [];
  (globalThis as any).remoteFetchAsync = async (url: string) => {
    calls.push(String(url));
    return { ok: true, status: 200, text: async () => '{"name":"repo-fixture"}' };
  };

  try {
    const input = "gh:owner/repo#deadbeef";
    const target = normalizeRemoteEsmTarget(input);
    const manifest = await resolvePackageManifest(input, target);
    assert.equal(manifest?.name, "repo-fixture");
    assert.deepEqual(calls, ["https://esm.sh/gh/owner/repo@deadbeef/package.json?raw"]);
  } finally {
    (globalThis as any).remoteFetchAsync = previous;
    clearRemoteEsmVm();
  }
});

test("preloaded private manifests avoid another fetch", async () => {
  clearRemoteEsmVm();
  const previous = (globalThis as any).remoteFetchAsync;
  let calls = 0;
  (globalThis as any).remoteFetchAsync = async () => {
    calls += 1;
    throw new Error("manifest should not be fetched");
  };

  try {
    const input = "gh:owner/private#main";
    const target = {
      ...normalizeRemoteEsmTarget(input),
      manifest: { name: "private", types: "./index.d.ts" },
      manifestUrl: "gh-private://owner/private/main/package.json",
    };
    const manifest = await resolvePackageManifest(input, target);
    assert.equal(manifest?.name, "private");
    assert.equal(calls, 0);
  } finally {
    (globalThis as any).remoteFetchAsync = previous;
    clearRemoteEsmVm();
  }
});

test("explicit non-esm.sh URL targets do not fabricate a manifest", async () => {
  clearRemoteEsmVm();
  const previous = (globalThis as any).remoteFetchAsync;
  let calls = 0;
  (globalThis as any).remoteFetchAsync = async () => {
    calls += 1;
    throw new Error("manifest should not be fetched");
  };

  try {
    const input = {
      runtimeUrl: "https://example.test/runtime.js",
      dtsUrl: "https://example.test/runtime.d.ts",
      specifier: "fixture",
    };
    const manifest = await resolvePackageManifest(input, normalizeRemoteEsmTarget(input));
    assert.equal(manifest, null);
    assert.equal(calls, 0);
  } finally {
    (globalThis as any).remoteFetchAsync = previous;
    clearRemoteEsmVm();
  }
});
