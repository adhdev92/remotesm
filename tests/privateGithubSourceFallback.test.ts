import assert from "node:assert/strict";
import test from "node:test";
import {
  createGitHubVirtualUrl,
  RemoteEsmImport,
  resolvePrivateGitHubTarget,
} from "../index.ts";
import type { RemoteEsmOptions } from "../index.ts";

test("repository roots fall back from missing build output to checked-in TypeScript source", async () => {
  const requestedPaths: string[] = [];
  const files: Record<string, string> = {
    "package.json": JSON.stringify({
      type: "module",
      main: "./dist/index.mjs",
      exports: {
        "./pglite": "./dist/pglite.mjs",
      },
      devDependencies: {
        typescript: "^6.0.3",
      },
    }),
    "src/index.ts": "export const answer: number = 42;",
  };

  const fetch = async (input: string, init: any = {}) => {
    const url = new URL(input);
    assert.equal(init.headers?.authorization, "Bearer test-token");

    if (url.pathname === "/repos/acme/source-only") {
      return new Response(JSON.stringify({ default_branch: "main" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }

    const prefix = "/repos/acme/source-only/contents/";
    if (url.pathname.startsWith(prefix)) {
      const path = url.pathname
        .slice(prefix.length)
        .split("/")
        .map(decodeURIComponent)
        .join("/");
      requestedPaths.push(path);

      if (path in files) return new Response(files[path], { status: 200 });
      return new Response("not found", { status: 404 });
    }

    return new Response("not found", { status: 404 });
  };

  const options: RemoteEsmOptions = {
    github: {
      token: "test-token",
      fetch,
    },
  };

  const target = await resolvePrivateGitHubTarget("gh:acme/source-only", options);
  const sourceUrl = createGitHubVirtualUrl("acme", "source-only", "main", "src/index.ts");

  assert.equal(target?.runtimeUrl, sourceUrl);
  assert.equal(target?.dtsUrl, sourceUrl);
  assert.deepEqual(requestedPaths, ["package.json", "dist/index.mjs"]);

  const result = await RemoteEsmImport("gh:acme/source-only", {
    ...options,
    tsUrl: import.meta.resolve("typescript"),
    log: false,
  });

  assert.equal(result.pick("answer"), 42);
  assert.equal(result.runtimeUrl, sourceUrl);
  assert.equal(result.dtsUrl, sourceUrl);
  assert.ok(result.completions.flat.some((entry) => entry.label === "answer"));
});
