import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const typescriptUrlPattern = /https:\/\/esm\.sh\/typescript(?:@([^\s"'`?]+))?/g;

test("all committed esm.sh TypeScript URLs use the package.json version", async () => {
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

  let matchCount = 0;

  for (const path of files) {
    const source = await readFile(path, "utf8");
    const matches = Array.from(source.matchAll(typescriptUrlPattern));
    matchCount += matches.length;

    for (const match of matches) {
      assert.equal(
        match[1],
        version,
        `${path} contains an unpinned or mismatched TypeScript CDN URL: ${match[0]}`,
      );
    }
  }

  assert.ok(matchCount > 0, "Expected at least one committed esm.sh TypeScript URL.");
});
