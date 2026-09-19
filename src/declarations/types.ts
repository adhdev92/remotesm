export interface DeclarationSourceSpan {
  file: string;
  start: number;
  end: number;
  line: number;
  column: number;
}

export interface DeclarationJsDocTag {
  name: string;
  text: string;
}

export interface DeclarationJsDoc {
  description: string;
  tags: DeclarationJsDocTag[];
}

export interface DeclarationTypeParameter {
  name: string;
  constraint?: DeclarationType;
  default?: DeclarationType;
}

export interface DeclarationParameter {
  name: string;
  type: DeclarationType;
  optional: boolean;
  rest: boolean;
  parameterProperty: boolean;
}

export interface DeclarationTupleElement {
  name?: string;
  type: DeclarationType;
  optional: boolean;
  rest: boolean;
}

export type DeclarationType =
  | { kind: "primitive"; name: string }
  | { kind: "reference"; name: string; typeArguments: DeclarationType[] }
  | { kind: "array"; elementType: DeclarationType }
  | { kind: "union" | "intersection"; types: DeclarationType[] }
  | { kind: "tuple"; elements: DeclarationTupleElement[] }
  | { kind: "function" | "constructor"; typeParameters: DeclarationTypeParameter[]; parameters: DeclarationParameter[]; returnType: DeclarationType }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "object"; members: DeclarationMember[] }
  | {
      kind: "mapped";
      typeParameter: DeclarationTypeParameter;
      nameType?: DeclarationType;
      valueType?: DeclarationType;
      optional: boolean | "add" | "remove";
      readonly: boolean | "add" | "remove";
    }
  | { kind: "conditional"; checkType: DeclarationType; extendsType: DeclarationType; trueType: DeclarationType; falseType: DeclarationType }
  | { kind: "indexedAccess"; objectType: DeclarationType; indexType: DeclarationType }
  | { kind: "keyof"; type: DeclarationType }
  | { kind: "typeOperator"; operator: string; type: DeclarationType }
  | { kind: "typeQuery"; expression: string; typeArguments: DeclarationType[] }
  | { kind: "import"; argument: string; qualifier?: string; typeArguments: DeclarationType[]; isTypeOf: boolean }
  | { kind: "templateLiteral"; head: string; spans: Array<{ type: DeclarationType; text: string }> }
  | { kind: "predicate"; parameter: string; asserts: boolean; type?: DeclarationType }
  | { kind: "infer"; typeParameter: DeclarationTypeParameter }
  | { kind: "rest"; type: DeclarationType }
  | { kind: "optional"; type: DeclarationType }
  | { kind: "this" }
  | { kind: "unsupported"; text: string };

export interface DeclarationModifiers {
  exported: boolean;
  default: boolean;
  declare: boolean;
  abstract: boolean;
  readonly: boolean;
  static: boolean;
  accessibility?: "public" | "protected" | "private";
}

export interface DeclarationBase {
  kind: string;
  name: string | null;
  source: DeclarationSourceSpan;
  jsDoc?: DeclarationJsDoc;
  modifiers: DeclarationModifiers;
}

export type DeclarationMember =
  | (DeclarationBase & { kind: "property"; name: string; computed: boolean; optional: boolean; type: DeclarationType })
  | (DeclarationBase & { kind: "method"; name: string; computed: boolean; optional: boolean; typeParameters: DeclarationTypeParameter[]; parameters: DeclarationParameter[]; returnType: DeclarationType })
  | (DeclarationBase & { kind: "constructor"; name: "constructor"; typeParameters: DeclarationTypeParameter[]; parameters: DeclarationParameter[] })
  | (DeclarationBase & { kind: "callSignature"; name: null; typeParameters: DeclarationTypeParameter[]; parameters: DeclarationParameter[]; returnType: DeclarationType })
  | (DeclarationBase & { kind: "constructSignature"; name: null; typeParameters: DeclarationTypeParameter[]; parameters: DeclarationParameter[]; returnType: DeclarationType })
  | (DeclarationBase & { kind: "indexSignature"; name: null; parameters: DeclarationParameter[]; returnType: DeclarationType })
  | (DeclarationBase & { kind: "getter"; name: string; computed: boolean; returnType: DeclarationType })
  | (DeclarationBase & { kind: "setter"; name: string; computed: boolean; parameters: DeclarationParameter[] });

export type Declaration =
  | (DeclarationBase & { kind: "interface"; name: string; typeParameters: DeclarationTypeParameter[]; extends: DeclarationType[]; members: DeclarationMember[] })
  | (DeclarationBase & { kind: "class"; name: string | null; typeParameters: DeclarationTypeParameter[]; extends: DeclarationType[]; implements: DeclarationType[]; members: DeclarationMember[] })
  | (DeclarationBase & { kind: "typeAlias"; name: string; typeParameters: DeclarationTypeParameter[]; type: DeclarationType })
  | (DeclarationBase & { kind: "enum"; name: string; members: Array<{ name: string; value: string | number | null; source: DeclarationSourceSpan; jsDoc?: DeclarationJsDoc }> })
  | (DeclarationBase & { kind: "function"; name: string | null; typeParameters: DeclarationTypeParameter[]; parameters: DeclarationParameter[]; returnType: DeclarationType })
  | (DeclarationBase & { kind: "variable"; name: string; declarationKind: "const" | "let" | "var"; type: DeclarationType })
  | (DeclarationBase & { kind: "namespace"; name: string; namespaceKind: "namespace" | "module" | "global"; declarations: Declaration[] })
  | (DeclarationBase & { kind: "import"; name: null; moduleSpecifier: string; defaultImport?: string; namespaceImport?: string; namedImports: Array<{ importedName: string; localName: string; typeOnly: boolean }>; typeOnly: boolean })
  | (DeclarationBase & { kind: "export"; name: null; moduleSpecifier?: string; exportAll: boolean; namespaceExport?: string; specifiers: Array<{ localName: string; exportedName: string; typeOnly: boolean }>; typeOnly: boolean })
  | (DeclarationBase & { kind: "exportAssignment"; name: null; expression: string; exportEquals: boolean });

export interface DeclarationFile {
  url: string;
  declarations: Declaration[];
}

export interface DeclarationGraph {
  entryUrl: string;
  files: DeclarationFile[];
}
