import assert from "node:assert/strict";
import test from "node:test";
import {
  createGitHubVirtualUrl,
  fetchGitHubVirtualText,
  importModuleCached,
  parseGitHubSpecifier,
  resolvePrivateGitHubTarget,
} from "../index.ts";
import type { RemoteEsmOptions } from "../index.ts";

test("parses GitHub repository aliases without exposing auth", () => {
  assert.deepEqual(parseGitHubSpecifier("github:acme/private-lib#feature/x"), {
    owner: "acme",
    repo: "private-lib",
    ref: "feature/x",
    path: "",
  });

  assert.deepEqual(parseGitHubSpecifier("gh:acme/monorepo/packages/tool#main"), {
    owner: "acme",
    repo: "monorepo",
    ref: "main",
    path: "packages/tool",
  });
});

test("resolves and imports a private GitHub package with token-authenticated fetch", async () => {
  const requests: Array<{ url: string; init: any }> = [];
  const files: Record<string, string> = {
    "package.json": JSON.stringify({
      exports: {
        ".": {
          types: "./dist/index.d.ts",
          import: "./dist/index.js",
        },
      },
    }),
    "dist/index.js": 'import { answer } from "./dep.js"; export const value = answer + 1;',
    "dist/dep.js": "export const answer = 41;",
    "dist/index.d.ts": "export declare const value: number;",
  };

  const fetch = async (input: string, init: any = {}) => {
    const url = new URL(input);
    requests.push({ url: url.href, init });

    if (url.pathname === "/repos/acme/private-lib") {
      return new Response(JSON.stringify({ default_branch: "main" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const prefix = "/repos/acme/private-lib/contents/";
    if (url.pathname.startsWith(prefix)) {
      const path = url.pathname.slice(prefix.length).split("/").map(decodeURIComponent).join("/");
      if (path in files) return new Response(files[path], { status: 200 });
      return new Response("not found", { status: 404 });
    }

    return new Response("not found", { status: 404 });
  };

  const options: RemoteEsmOptions = {
    github: {
      token: "github_pat_test_secret",
      fetch,
    },
  };

  const target = await resolvePrivateGitHubTarget("github:acme/private-lib", options);
  assert.ok(target);
  assert.equal(target?.specifier, "github:acme/private-lib");
  assert.equal(target?.runtimeUrl, createGitHubVirtualUrl("acme", "private-lib", "main", "dist/index.js"));
  assert.equal(target?.dtsUrl, createGitHubVirtualUrl("acme", "private-lib", "main", "dist/index.d.ts"));
  assert.equal(target?.runtimeUrl.includes("github_pat_test_secret"), false);

  const declaration = await fetchGitHubVirtualText(target!.dtsUrl, options);
  assert.equal(declaration, files["dist/index.d.ts"]);

  const imported: any = await importModuleCached(target!.runtimeUrl, options);
  assert.equal(imported.value, 42);

  assert.ok(requests.length >= 4);
  for (const request of requests) {
    const headers = request.init?.headers || {};
    assert.equal(headers.authorization, "Bearer github_pat_test_secret");
  }
});

test("accepts an existing Octokit-compatible client", async () => {
  const calls: Array<{ route: string; parameters: any }> = [];
  const octokit = {
    async request(route: string, parameters: any) {
      calls.push({ route, parameters });
      if (parameters.path === "package.json") {
        return {
          data: JSON.stringify({
            module: "./index.js",
            types: "./index.d.ts",
          }),
        };
      }
      throw new Error(`Unexpected Octokit request: ${route}`);
    },
  };

  const target = await resolvePrivateGitHubTarget("gh:acme/private-lib#deadbeef", {
    github: { octokit },
  });

  assert.equal(target?.runtimeUrl, createGitHubVirtualUrl("acme", "private-lib", "deadbeef", "index.js"));
  assert.equal(target?.dtsUrl, createGitHubVirtualUrl("acme", "private-lib", "deadbeef", "index.d.ts"));
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.route, "GET /repos/{owner}/{repo}/contents/{path}");
});
