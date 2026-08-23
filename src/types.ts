export type AnyRecord = Record<string, any>;

export type RemoteEsmFetch = (input: string, init?: any) => Promise<any>;

export interface RemoteEsmGitHubOptions {
  /** Fine-grained PAT, classic PAT, installation token, or other GitHub bearer token. */
  token?: string;
  /** Optional fetch-compatible transport, including Airtable remoteFetchAsync wrappers. */
  fetch?: RemoteEsmFetch;
  /** Existing Octokit instance/constructor, or true to dynamically import Octokit. */
  octokit?: any;
  /** Override the dynamically imported Octokit module URL. */
  octokitUrl?: string;
  /** GitHub REST API base URL, useful for GitHub Enterprise. */
  apiBaseUrl?: string;
}

export type RemoteEsmInput = string | {
  specifier?: string;
  url?: string;
  runtimeUrl?: string;
  metaUrl?: string;
  dtsUrl?: string;
};

export type RemoteEsmGlobalsMode = "none" | "stubs" | "importTypes";
export type RemoteEsmImportTypesMode = "namespace" | "typedefs";
export type RemoteEsmJsdocFormat = "compact" | "oneLine" | "verbose";

export interface RemoteEsmJsdocTagsOptions {
  property?: string;
  argument?: string;
}

export interface RemoteEsmJsdocShorthandOptions {
  enabled?: boolean;
  includeTypedefs?: boolean;
  types?: Record<string, string>;
}

export interface RemoteEsmImportTypesOptions {
  enabled?: boolean;
  specifier?: string;
  namespaceName?: string;
  mode?: RemoteEsmImportTypesMode;
}

export interface RemoteEsmJsdocOptions {
  tags?: RemoteEsmJsdocTagsOptions;
  format?: RemoteEsmJsdocFormat;
  space?: string | number;
  shorthand?: boolean | RemoteEsmJsdocShorthandOptions;
  globals?: RemoteEsmGlobalsMode;
  importTypes?: RemoteEsmImportTypesOptions;
}

export interface RemoteEsmOptions {
  tsUrl?: string;
  esmBase?: string;
  maxDepth?: number;
  maxFiles?: number;
  includeBareDtsImports?: boolean;
  typeNameSuffix?: string;
  unknownType?: string;
  includeHeader?: boolean;
  log?: boolean;
  bundle?: boolean;
  target?: string;
  dev?: boolean;
  jsdoc?: RemoteEsmJsdocOptions;
  dtsUrl?: string;
  metaUrl?: string;
  runtimeUrl?: string;
  url?: string;
  specifier?: string;
  github?: RemoteEsmGitHubOptions;
}

export interface NormalizedRemoteEsmTarget {
  input: RemoteEsmInput;
  specifier: string;
  runtimeUrl: string;
  metaUrl: string;
  dtsUrl: string;
  isUrl: boolean;
  esmBase: string;
}

export interface DtsFile {
  url: string;
  text: string;
}

export interface DtsFetchFailure {
  url: string;
  error: string;
}

export interface DtsGraph {
  entryUrl: string;
  files: DtsFile[];
  failed: DtsFetchFailure[];
}

export interface CompletionEntry {
  scope: string;
  label: string;
  kind: string;
  insertText: string;
  detail: string;
  documentation: string;
  type: string;
  returnType: string;
  memberOf: string;
  exportName: string;
  isStatic?: boolean;
}

export interface CompletionTypeRecord {
  kind: string;
  detail: string;
  members: CompletionEntry[];
  toJsdoc?: (jsdoc?: RemoteEsmJsdocOptions) => string;
}

export interface CompletionResult {
  flat: CompletionEntry[];
  byScope: Record<string, CompletionEntry[]>;
  types: Record<string, CompletionTypeRecord>;
}

export interface DtsCompletionConverter {
  convertText(dtsText: string, options?: { fileName?: string }): CompletionResult;
}

export interface RemoteEsmTypedBindingOptions {
  localName?: string;
  moduleName?: string;
  importSpecifier?: string;
  typeName?: string;
  typeNameSuffix?: string;
  typeSource?: "local" | "constructor" | "import";
  includeTypedef?: boolean;
  jsdoc?: RemoteEsmJsdocOptions;
}

export interface RemoteEsmImportMatch {
  key: string;
  value: any;
  entry: CompletionEntry;
  type?: CompletionTypeRecord;
  toJsdoc?: (jsdoc?: RemoteEsmJsdocOptions) => string;
  toTypedBinding?: (options?: string | RemoteEsmTypedBindingOptions) => string;
  toGlobal?: (options?: string | RemoteEsmTypedBindingOptions) => string;
}

export interface RemoteEsmResult {
  input: RemoteEsmInput;
  specifier: string;
  libUrl: string;
  runtimeUrl: string;
  metaUrl: string;
  dtsUrl: string;
  module: any;
  dtsGraph: DtsGraph;
  completions: CompletionResult;
  imports: Record<string, RemoteEsmImportMatch>;
  jsdoc: string;
  memory: RemoteEsmVm;
  pick(name: string, fallback?: any): any;
  asAny<T = any>(value: T): any;
}

export interface RemoteEsmVm {
  text: Map<string, Promise<string>>;
  json: Map<string, Promise<any>>;
  module: Map<string, Promise<any>>;
  dtsUrl: Map<string, Promise<string>>;
  dtsGraph: Map<string, Promise<DtsGraph>>;
  package: Map<string, Promise<RemoteEsmResult>>;
  ts: any;
  converter: DtsCompletionConverter | null;
}

export interface NormalizedJsdocSettings {
  includeGlobals: boolean;
  includeHeader: boolean;
  unknownType: string;
  typeNameSuffix: string;
  sort: boolean;
  tags: { property: string; argument: string };
  format: RemoteEsmJsdocFormat;
  space: string | number;
  shorthand: { enabled: boolean; includeTypedefs: boolean; types: Record<string, string> };
  globals: RemoteEsmGlobalsMode;
  importTypes: { enabled: boolean; specifier: string; namespaceName: string; mode: RemoteEsmImportTypesMode };
  __typeEntries?: Map<string, { typeEntry: CompletionEntry | undefined; typeInfo: CompletionTypeRecord | undefined }>;
}

export interface ParsedParam {
  name: string;
  type: string;
  optional: boolean;
  rest: boolean;
}

export interface ParsedCallable {
  name: string;
  params: ParsedParam[];
  returnType: string;
}

export interface RenderContext {
  settings: NormalizedJsdocSettings;
  unknownType: string;
  originalTypeNames: Set<string>;
  outTypeName(name: string): string;
  templateNames: Set<string>;
  functionUnknownType: string;
}

export interface JsdocDefinition {
  generic: boolean;
  lines: string[];
  kind?: string;
  code?: string;
}
