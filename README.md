# RemoteEsm

`RemoteEsm` imports a remote ESM runtime module, fetches its `.d.ts` graph, converts declarations to JSON completion data, emits safe JSDoc helper typedefs, and caches everything in virtual memory.

## Main API

```ts
import { RemoteEsmImport, markdownCodeBlock } from "./index.ts";

const octo = await RemoteEsmImport("@octokit/core@7.0.6", {
  typeNameSuffix: "T",
  unknownType: "unknown",
  maxDepth: 2,
  maxFiles: 30,
  includeBareDtsImports: true,
  log: true,
  jsdoc: {
    format: "oneLine",
    space: "",
    tags: {
      property: "prop",
      argument: "arg"
    },
    globals: "importTypes",
    importTypes: {
      mode: "namespace",
      namespaceName: "OctokitModuleT"
    },
    shorthand: {
      enabled: true,
      includeTypedefs: true
    }
  }
});

output.markdown(markdownCodeBlock(octo.jsdoc, "js"));

const Octokit = octo.pick("Octokit");
console.info(Reflect.ownKeys(Octokit));
```

## Supported inputs

```ts
await RemoteEsmImport("zod");
await RemoteEsmImport("zod@4.4.3");
await RemoteEsmImport("@octokit/core");
await RemoteEsmImport("@octokit/core@7.0.6");
await RemoteEsmImport("github:user/repo#commit");
await RemoteEsmImport("gh:user/repo#commit");
await RemoteEsmImport("https://esm.sh/@octokit/core@7.0.6");
await RemoteEsmImport({ runtimeUrl: "https://esm.sh/pkg", dtsUrl: "https://example.com/pkg.d.ts", specifier: "pkg" });
```

## Private GitHub repositories

Passing `options.github` switches `github:` / `gh:` inputs from the public esm.sh GitHub path to GitHub's authenticated Contents API. The token stays in request headers and is never embedded in the generated runtime URLs.

### Token + fetch

```ts
const pkg = await RemoteEsmImport("github:my-org/private-repo#main", {
  github: {
    token: GH_TOKEN,
    // Optional. If omitted, remoteFetchAsync is preferred when available,
    // otherwise global fetch is used.
    fetch: globalThis.remoteFetchAsync,
  },
});
```

Fine-grained PATs, classic PATs, installation tokens, and other valid GitHub bearer tokens work as long as they can read the repository contents.

### Dynamically imported Octokit

```ts
const pkg = await RemoteEsmImport("gh:my-org/private-repo#main", {
  github: {
    token: GH_TOKEN,
    octokit: true,
  },
});
```

`octokit: true` dynamically imports the pinned default `https://esm.sh/@octokit/core@7.0.6`. Override it with `github.octokitUrl` when needed.

You can also pass an existing Octokit-compatible instance:

```ts
const pkg = await RemoteEsmImport("gh:my-org/private-repo#main", {
  github: { octokit },
});
```

Monorepo package directories are supported as part of the specifier:

```ts
await RemoteEsmImport("github:my-org/private-monorepo/packages/sdk#main", {
  github: { token: GH_TOKEN },
});
```

For authenticated GitHub packages, `RemoteEsm` reads `package.json`, resolves the root runtime and declaration entries, fetches relative private files through GitHub with authentication, transpiles TypeScript/TSX runtime source when necessary, and rewrites repository-local runtime imports to credential-free data URLs. Bare npm dependencies continue to resolve through `esm.sh`.

A private runtime graph containing circular relative imports currently requires a pre-bundled ESM entry; the authenticated data-URL loader reports `ERR_PRIVATE_GITHUB_MODULE_CYCLE` rather than hanging.

## Notes

- `jsdoc.globals` defaults to `"none"`, so fake runtime stubs are not emitted unless requested.
- `jsdoc.globals: "importTypes"` emits type-only import aliases instead.
- `jsdoc.format: "oneLine"` joins each JSDoc block using `jsdoc.space`; `space: ""` joins blocks as `*//**`.
- Built-in shorthand aliases are enabled by default: `s`, `n`, `b`, `x`, `X`, `O`, etc.
