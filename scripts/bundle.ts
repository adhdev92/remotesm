import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { build } from "tsdown";

type BundleKind = "ts" | "mjs";

type PackageJson = {
  devDependencies?: {
    typescript?: unknown;
  };
};

const kind = process.argv[2] as BundleKind | undefined;
if (kind !== "ts" && kind !== "mjs") {
  throw new TypeError('Expected bundle kind "ts" or "mjs".');
}

const typescriptVersion = await getPinnedTypeScriptVersion();
const outputDirectory = resolve(process.argv[3] || await getDefaultOutputDirectory());
const extension = kind === "ts" ? ".ts" : ".mjs";

await build({
  entry: { bundle: "src/index.ts" },
  format: "esm",
  dts: false,
  outDir: outputDirectory,
  outExtensions: () => ({ js: extension }),
  clean: false,
  target: "esnext",
  platform: "neutral",
});

await assertPinnedTypeScriptImports(
  resolve(outputDirectory, `bundle${extension}`),
  typescriptVersion,
);

async function getDefaultOutputDirectory(): Promise<string> {
  try {
    const tsconfig = JSON.parse(await readFile("tsconfig.json", "utf8")) as {
      compilerOptions?: { outDir?: unknown };
    };
    const outDir = tsconfig.compilerOptions?.outDir;
    return typeof outDir === "string" && outDir.trim() ? outDir : "build";
  } catch {
    return "build";
  }
}

async function getPinnedTypeScriptVersion(): Promise<string> {
  const packageJson = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;
  const version = packageJson.devDependencies?.typescript;
  const exactVersionPattern = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

  if (typeof version !== "string" || !exactVersionPattern.test(version)) {
    throw new Error(
      `package.json devDependencies.typescript must be an exact version, received ${JSON.stringify(version)}.`,
    );
  }

  return version;
}

async function assertPinnedTypeScriptImports(
  outputPath: string,
  expectedVersion: string,
): Promise<void> {
  const source = await readFile(outputPath, "utf8");
  const matches = Array.from(
    source.matchAll(/https:\/\/esm\.sh\/typescript(?:@([^\s"'`?]+))?/g),
  );

  if (!matches.length) {
    throw new Error(`Expected ${outputPath} to contain an esm.sh TypeScript import.`);
  }

  for (const match of matches) {
    if (match[1] !== expectedVersion) {
      throw new Error(
        `Unpinned or mismatched TypeScript CDN import in ${outputPath}: ${match[0]}. ` +
        `Expected https://esm.sh/typescript@${expectedVersion}.`,
      );
    }
  }
}
