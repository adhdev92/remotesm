import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const unpinnedTypeScriptUrlPattern = /https:\/\/esm\.sh\/typescript(?=["'`?\s]|$)/g;
const literalTypeScriptVersionPattern = /https:\/\/esm\.sh\/typescript@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/g;

test("all committed esm.sh TypeScript URLs are pinned to package.json", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as {
    devDependencies?: { typescript?: unknown };
  };
  const version = packageJson.devDependencies?.typescript;

  assert.equal(typeof version, "string");
  assert.match(version as string, exactVersionPattern);

  const files = [
    "src/network.ts",
    "src/remote-esm-import/index.ts",
    "build/bundle.ts",
    "build/bundle.mjs",
    "tests/bundle.ts",
  ];

  let literalMatchCount = 0;

  for (const path of files) {
    const source = await readFile(path, "utf8");

    assert.deepEqual(
      source.match(unpinnedTypeScriptUrlPattern) || [],
      [],
      `${path} contains an unpinned TypeScript CDN URL`,
    );

    for (const match of source.matchAll(literalTypeScriptVersionPattern)) {
      literalMatchCount += 1;
      assert.equal(
        match[1],
        version,
        `${path} contains a mismatched TypeScript CDN URL: ${match[0]}`,
      );
    }
  }

  assert.ok(literalMatchCount > 0, "Expected at least one literal esm.sh TypeScript version.");
});
