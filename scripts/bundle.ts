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
  const unpinned = source.match(/https:\/\/esm\.sh\/typescript(?=["'`?\s]|$)/g) || [];

  if (unpinned.length) {
    throw new Error(
      `Unpinned TypeScript CDN import in ${outputPath}: ${unpinned[0]}. ` +
      `Expected a versioned URL derived from package.json.`,
    );
  }

  const literalVersions = Array.from(
    source.matchAll(/https:\/\/esm\.sh\/typescript@(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)/g),
    (match) => match[1],
  );

  for (const version of literalVersions) {
    if (version !== expectedVersion) {
      throw new Error(
        `Mismatched TypeScript CDN version in ${outputPath}: ${version}. ` +
        `Expected ${expectedVersion} from package.json.`,
      );
    }
  }
}
