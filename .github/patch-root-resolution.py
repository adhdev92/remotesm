from pathlib import Path

source_path = Path("src/github.ts")
source = source_path.read_text()

old_resolver = '''async function resolvePackageRuntimePath(
  owner: string,
  repo: string,
  ref: string,
  packageRoot: string,
  pkg: any,
  options: RemoteEsmOptions,
): Promise<string> {
  const candidates = packageRuntimeCandidates(pkg);

  for (const entry of candidates) {
    const candidate = joinPath(packageRoot, entry);
    if (await githubFileExists(owner, repo, ref, candidate, options)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find a checked-in runtime entry for ${owner}/${repo}` +
    `${packageRoot ? `/${packageRoot}` : ""}. Tried: ${candidates.join(", ")}.`,
  );
}
'''

new_resolver = '''async function resolvePackageRuntimePath(
  owner: string,
  repo: string,
  ref: string,
  packageRoot: string,
  pkg: any,
  options: RemoteEsmOptions,
): Promise<string> {
  const declared = pickPackageRuntimeEntry(pkg);

  if (declared) {
    const declaredPath = joinPath(packageRoot, declared);
    if (await githubFileExists(owner, repo, ref, declaredPath, options)) {
      return declaredPath;
    }
  }

  if (typeof pkg?.source === "string" && pkg.source.trim()) {
    return joinPath(packageRoot, stripDotSlash(pkg.source));
  }

  const inferredSourceCandidates = compiledEntrySourceCandidates(declared);
  if (packageUsesTypeScript(pkg)) {
    const inferredTypeScriptSource = inferredSourceCandidates.find((candidate) =>
      /\\.(?:ts|tsx|mts|cts)$/i.test(candidate)
    );
    if (inferredTypeScriptSource) {
      return joinPath(packageRoot, inferredTypeScriptSource);
    }
  }

  const candidates = packageRuntimeCandidates(pkg);
  for (const entry of candidates) {
    if (entry === declared || inferredSourceCandidates.includes(entry)) continue;
    const candidate = joinPath(packageRoot, entry);
    if (await githubFileExists(owner, repo, ref, candidate, options)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find a checked-in runtime entry for ${owner}/${repo}` +
    `${packageRoot ? `/${packageRoot}` : ""}. Tried: ${candidates.join(", ")}.`,
  );
}

function packageUsesTypeScript(pkg: any): boolean {
  return [
    pkg?.dependencies?.typescript,
    pkg?.devDependencies?.typescript,
    pkg?.peerDependencies?.typescript,
    pkg?.optionalDependencies?.typescript,
  ].some((value) => typeof value === "string" && value.trim());
}
'''

if old_resolver not in source:
    raise SystemExit("resolvePackageRuntimePath block not found")
source = source.replace(old_resolver, new_resolver, 1)

old_probe = '''  } catch (error: any) {
    if (error?.status === 404 || error?.code === "ERR_PRIVATE_GITHUB_FETCH") return false;
    return false;
  }
}
'''
new_probe = '''  } catch (error: any) {
    if (error?.status === 404) return false;
    throw error;
  }
}
'''
if old_probe not in source:
    raise SystemExit("githubFileExists catch block not found")
source = source.replace(old_probe, new_probe, 1)
source_path.write_text(source)

test_path = Path("tests/privateGithubSourceFallback.test.ts")
test = test_path.read_text()
old_pkg = '''      exports: {
        "./pglite": "./dist/pglite.mjs",
      },
'''
new_pkg = '''      exports: {
        "./pglite": "./dist/pglite.mjs",
      },
      devDependencies: {
        typescript: "^6.0.3",
      },
'''
if old_pkg not in test:
    raise SystemExit("fallback fixture package block not found")
test = test.replace(old_pkg, new_pkg, 1)

old_asserts = '''  assert.equal(target?.dtsUrl, sourceUrl);
  assert.ok(requestedPaths.includes("dist/index.mjs"));
  assert.ok(requestedPaths.includes("src/index.ts"));

  const result = await RemoteEsmImport'''
new_asserts = '''  assert.equal(target?.dtsUrl, sourceUrl);
  assert.deepEqual(requestedPaths, ["package.json", "dist/index.mjs"]);

  const result = await RemoteEsmImport'''
if old_asserts not in test:
    raise SystemExit("fallback fixture assertions not found")
test = test.replace(old_asserts, new_asserts, 1)
test_path.write_text(test)
