import assert from "node:assert/strict";
import test from "node:test";
import { mergeRemoteEsmOptions } from "../index.ts";

test("configured importer options merge defined overrides deeply", () => {
  const defaultFetch = async () => new Response();
  const overrideFetch = async () => new Response();

  const merged = mergeRemoteEsmOptions(
    {
      maxDepth: 5,
      log: true,
      github: {
        token: "default-token",
        fetch: defaultFetch,
        apiBaseUrl: "https://api.github.example",
      },
      jsdoc: {
        format: "compact",
        tags: {
          property: "prop",
          argument: "arg",
        },
        shorthand: {
          enabled: true,
          includeTypedefs: true,
          types: {
            string: "s",
            number: "n",
          },
        },
        importTypes: {
          enabled: true,
          namespaceName: "DefaultTypes",
        },
      },
    },
    {
      maxDepth: undefined,
      log: false,
      github: {
        token: undefined,
        fetch: overrideFetch,
      },
      jsdoc: {
        tags: {
          property: "property",
        },
        shorthand: {
          includeTypedefs: false,
          types: {
            number: "num",
          },
        },
        importTypes: {
          namespaceName: "CallTypes",
        },
      },
    },
  );

  assert.equal(merged.maxDepth, 5);
  assert.equal(merged.log, false);
  assert.equal(merged.github?.token, "default-token");
  assert.equal(merged.github?.fetch, overrideFetch);
  assert.equal(merged.github?.apiBaseUrl, "https://api.github.example");
  assert.equal(merged.jsdoc?.format, "compact");
  assert.deepEqual(merged.jsdoc?.tags, {
    property: "property",
    argument: "arg",
  });
  assert.deepEqual(merged.jsdoc?.importTypes, {
    enabled: true,
    namespaceName: "CallTypes",
  });
  assert.deepEqual(merged.jsdoc?.shorthand, {
    enabled: true,
    includeTypedefs: false,
    types: {
      string: "s",
      number: "num",
    },
  });
});
