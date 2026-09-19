import type { DtsGraph } from "../types.ts";
import type {
  Declaration,
  DeclarationBase,
  DeclarationFile,
  DeclarationGraph,
  DeclarationJsDoc,
  DeclarationMember,
  DeclarationModifiers,
  DeclarationParameter,
  DeclarationSourceSpan,
  DeclarationTupleElement,
  DeclarationType,
  DeclarationTypeParameter,
} from "./types.ts";

/** Parse a fetched declaration graph into a stable JSON-serializable structural IR. */
export function parseDeclarationGraph(ts: any, graph: DtsGraph): DeclarationGraph {
  return {
    entryUrl: graph.entryUrl,
    files: graph.files.map((file) => parseDeclarationFile(ts, file.url, file.text)),
  };
}

/** Parse one declaration file while preserving declaration order and overloads. */
export function parseDeclarationFile(ts: any, url: string, sourceText: string): DeclarationFile {
  const sourceFile = ts.createSourceFile(url, String(sourceText || ""), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

  function span(node: any): DeclarationSourceSpan {
    const start = node.getStart(sourceFile, false);
    const end = node.getEnd();
    const pos = sourceFile.getLineAndCharacterOfPosition(start);
    return { file: url, start, end, line: pos.line + 1, column: pos.character + 1 };
  }

  function commentText(value: any): string {
    if (typeof value === "string") return value;
    if (Array.isArray(value)) return value.map((part) => typeof part === "string" ? part : part?.text || "").join("");
    return value?.text ? String(value.text) : "";
  }

  function jsDoc(node: any): DeclarationJsDoc | undefined {
    const docs = Array.from(node?.jsDoc || []) as any[];
    if (!docs.length) return undefined;
    const description = docs.map((doc) => commentText(doc.comment)).filter(Boolean).join("\n\n");
    const tags = docs.flatMap((doc) => Array.from(doc.tags || []).map((tag: any) => ({
      name: String(tag.tagName?.text || ""),
      text: commentText(tag.comment),
    })));
    return description || tags.length ? { description, tags } : undefined;
  }

  function hasModifier(node: any, kind: number): boolean {
    return Array.from(node?.modifiers || []).some((modifier: any) => modifier.kind === kind);
  }

  function modifiers(node: any): DeclarationModifiers {
    let accessibility: DeclarationModifiers["accessibility"];
    if (hasModifier(node, ts.SyntaxKind.PublicKeyword)) accessibility = "public";
    else if (hasModifier(node, ts.SyntaxKind.ProtectedKeyword)) accessibility = "protected";
    else if (hasModifier(node, ts.SyntaxKind.PrivateKeyword)) accessibility = "private";
    return {
      exported: hasModifier(node, ts.SyntaxKind.ExportKeyword),
      default: hasModifier(node, ts.SyntaxKind.DefaultKeyword),
      declare: hasModifier(node, ts.SyntaxKind.DeclareKeyword),
      abstract: hasModifier(node, ts.SyntaxKind.AbstractKeyword),
      readonly: hasModifier(node, ts.SyntaxKind.ReadonlyKeyword),
      static: hasModifier(node, ts.SyntaxKind.StaticKeyword),
      ...(accessibility ? { accessibility } : {}),
    };
  }

  function base(node: any, kind: string, name: string | null): DeclarationBase {
    const doc = jsDoc(node);
    return { kind, name, source: span(node), ...(doc ? { jsDoc: doc } : {}), modifiers: modifiers(node) };
  }

  function nameText(name: any): { text: string; computed: boolean } {
    if (!name) return { text: "", computed: false };
    if (ts.isComputedPropertyName?.(name)) return { text: name.expression.getText(sourceFile), computed: true };
    if (ts.isIdentifier(name) || ts.isPrivateIdentifier?.(name)) return { text: name.text, computed: false };
    if (ts.isStringLiteral(name) || ts.isNumericLiteral(name)) return { text: String(name.text), computed: false };
    return { text: name.getText(sourceFile), computed: false };
  }

  function typeParameter(node: any): DeclarationTypeParameter {
    const out: DeclarationTypeParameter = { name: String(node.name?.text || node.name?.getText(sourceFile) || "T") };
    if (node.constraint) out.constraint = typeNode(node.constraint);
    if (node.default) out.default = typeNode(node.default);
    return out;
  }

  function typeParameters(nodes: any): DeclarationTypeParameter[] {
    return Array.from(nodes || []).map(typeParameter);
  }

  function parameter(node: any, index: number): DeclarationParameter {
    return {
      name: node.name?.getText(sourceFile) || `arg${index + 1}`,
      type: typeNode(node.type),
      optional: !!node.questionToken || !!node.initializer,
      rest: !!node.dotDotDotToken,
      parameterProperty: Array.from(node.modifiers || []).some((modifier: any) =>
        [ts.SyntaxKind.PublicKeyword, ts.SyntaxKind.ProtectedKeyword, ts.SyntaxKind.PrivateKeyword, ts.SyntaxKind.ReadonlyKeyword].includes(modifier.kind)
      ),
    };
  }

  function parameters(nodes: any): DeclarationParameter[] {
    return Array.from(nodes || []).map((node: any, index) => parameter(node, index));
  }

  function literalValue(literal: any): string | number | boolean | null {
    if (literal.kind === ts.SyntaxKind.NullKeyword) return null;
    if (literal.kind === ts.SyntaxKind.TrueKeyword) return true;
    if (literal.kind === ts.SyntaxKind.FalseKeyword) return false;
    if (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral?.(literal)) return literal.text;
    if (ts.isNumericLiteral(literal)) return Number(literal.text);
    return literal.getText(sourceFile);
  }

  function tupleElement(node: any): DeclarationTupleElement {
    if (ts.isNamedTupleMember?.(node)) {
      return {
        name: node.name?.getText(sourceFile),
        type: typeNode(node.type),
        optional: !!node.questionToken,
        rest: !!node.dotDotDotToken,
      };
    }
    if (ts.isOptionalTypeNode?.(node)) return { type: typeNode(node.type), optional: true, rest: false };
    if (ts.isRestTypeNode?.(node)) return { type: typeNode(node.type), optional: false, rest: true };
    return { type: typeNode(node), optional: false, rest: false };
  }

  function modifierToken(token: any): boolean | "add" | "remove" {
    if (!token) return false;
    if (token.kind === ts.SyntaxKind.PlusToken) return "add";
    if (token.kind === ts.SyntaxKind.MinusToken) return "remove";
    return true;
  }

  function typeNode(node: any): DeclarationType {
    if (!node) return { kind: "primitive", name: "any" };
    const S = ts.SyntaxKind;
    const primitiveNames = new Map<number, string>([
      [S.AnyKeyword, "any"], [S.UnknownKeyword, "unknown"], [S.NumberKeyword, "number"],
      [S.BigIntKeyword, "bigint"], [S.ObjectKeyword, "object"], [S.BooleanKeyword, "boolean"],
      [S.StringKeyword, "string"], [S.SymbolKeyword, "symbol"], [S.VoidKeyword, "void"],
      [S.UndefinedKeyword, "undefined"], [S.NeverKeyword, "never"], [S.IntrinsicKeyword, "intrinsic"],
    ]);
    const primitive = primitiveNames.get(node.kind);
    if (primitive) return { kind: "primitive", name: primitive };
    if (node.kind === S.ThisType) return { kind: "this" };
    if (ts.isArrayTypeNode(node)) return { kind: "array", elementType: typeNode(node.elementType) };
    if (ts.isTypeReferenceNode(node)) return {
      kind: "reference",
      name: node.typeName.getText(sourceFile),
      typeArguments: Array.from(node.typeArguments || []).map(typeNode),
    };
    if (ts.isUnionTypeNode(node)) return { kind: "union", types: Array.from(node.types).map(typeNode) };
    if (ts.isIntersectionTypeNode(node)) return { kind: "intersection", types: Array.from(node.types).map(typeNode) };
    if (ts.isTupleTypeNode(node)) return { kind: "tuple", elements: Array.from(node.elements).map(tupleElement) };
    if (ts.isFunctionTypeNode(node) || ts.isConstructorTypeNode?.(node)) return {
      kind: ts.isConstructorTypeNode?.(node) ? "constructor" : "function",
      typeParameters: typeParameters(node.typeParameters),
      parameters: parameters(node.parameters),
      returnType: typeNode(node.type),
    };
    if (ts.isLiteralTypeNode(node)) return { kind: "literal", value: literalValue(node.literal) };
    if (ts.isParenthesizedTypeNode(node)) return typeNode(node.type);
    if (ts.isTypeLiteralNode(node)) return {
      kind: "object",
      members: Array.from(node.members || []).map(member).filter(Boolean) as DeclarationMember[],
    };
    if (ts.isMappedTypeNode(node)) return {
      kind: "mapped",
      typeParameter: typeParameter(node.typeParameter),
      ...(node.nameType ? { nameType: typeNode(node.nameType) } : {}),
      ...(node.type ? { valueType: typeNode(node.type) } : {}),
      optional: modifierToken(node.questionToken),
      readonly: modifierToken(node.readonlyToken),
    };
    if (ts.isConditionalTypeNode(node)) return {
      kind: "conditional",
      checkType: typeNode(node.checkType),
      extendsType: typeNode(node.extendsType),
      trueType: typeNode(node.trueType),
      falseType: typeNode(node.falseType),
    };
    if (ts.isIndexedAccessTypeNode(node)) return {
      kind: "indexedAccess",
      objectType: typeNode(node.objectType),
      indexType: typeNode(node.indexType),
    };
    if (ts.isTypeOperatorNode(node)) {
      if (node.operator === S.KeyOfKeyword) return { kind: "keyof", type: typeNode(node.type) };
      return {
        kind: "typeOperator",
        operator: ts.tokenToString?.(node.operator) || node.getChildAt(0, sourceFile)?.getText(sourceFile) || "operator",
        type: typeNode(node.type),
      };
    }
    if (ts.isTypeQueryNode(node)) return {
      kind: "typeQuery",
      expression: node.exprName.getText(sourceFile),
      typeArguments: Array.from(node.typeArguments || []).map(typeNode),
    };
    if (ts.isImportTypeNode(node)) return {
      kind: "import",
      argument: node.argument?.literal?.text ?? node.argument?.getText(sourceFile) ?? "",
      ...(node.qualifier ? { qualifier: node.qualifier.getText(sourceFile) } : {}),
      typeArguments: Array.from(node.typeArguments || []).map(typeNode),
      isTypeOf: !!node.isTypeOf,
    };
    if (ts.isTemplateLiteralTypeNode(node)) return {
      kind: "templateLiteral",
      head: node.head?.text || "",
      spans: Array.from(node.templateSpans || []).map((item: any) => ({
        type: typeNode(item.type),
        text: item.literal?.text || "",
      })),
    };
    if (ts.isTypePredicateNode(node)) return {
      kind: "predicate",
      parameter: node.parameterName?.getText(sourceFile) || "this",
      asserts: !!node.assertsModifier,
      ...(node.type ? { type: typeNode(node.type) } : {}),
    };
    if (ts.isInferTypeNode(node)) return { kind: "infer", typeParameter: typeParameter(node.typeParameter) };
    if (ts.isRestTypeNode(node)) return { kind: "rest", type: typeNode(node.type) };
    if (ts.isOptionalTypeNode?.(node)) return { kind: "optional", type: typeNode(node.type) };
    return { kind: "unsupported", text: node.getText(sourceFile) };
  }

  function member(node: any): DeclarationMember | null {
    const named = nameText(node.name);
    if (ts.isPropertySignature(node) || ts.isPropertyDeclaration(node)) return {
      ...base(node, "property", named.text),
      kind: "property",
      name: named.text,
      computed: named.computed,
      optional: !!node.questionToken,
      type: typeNode(node.type),
    };
    if (ts.isMethodSignature(node) || ts.isMethodDeclaration(node)) return {
      ...base(node, "method", named.text),
      kind: "method",
      name: named.text,
      computed: named.computed,
      optional: !!node.questionToken,
      typeParameters: typeParameters(node.typeParameters),
      parameters: parameters(node.parameters),
      returnType: typeNode(node.type),
    };
    if (ts.isConstructorDeclaration(node)) return {
      ...base(node, "constructor", "constructor"),
      kind: "constructor",
      name: "constructor",
      typeParameters: typeParameters(node.typeParameters),
      parameters: parameters(node.parameters),
    };
    if (ts.isCallSignatureDeclaration(node)) return {
      ...base(node, "callSignature", null),
      kind: "callSignature",
      name: null,
      typeParameters: typeParameters(node.typeParameters),
      parameters: parameters(node.parameters),
      returnType: typeNode(node.type),
    };
    if (ts.isConstructSignatureDeclaration(node)) return {
      ...base(node, "constructSignature", null),
      kind: "constructSignature",
      name: null,
      typeParameters: typeParameters(node.typeParameters),
      parameters: parameters(node.parameters),
      returnType: typeNode(node.type),
    };
    if (ts.isIndexSignatureDeclaration(node)) return {
      ...base(node, "indexSignature", null),
      kind: "indexSignature",
      name: null,
      parameters: parameters(node.parameters),
      returnType: typeNode(node.type),
    };
    if (ts.isGetAccessorDeclaration?.(node)) return {
      ...base(node, "getter", named.text),
      kind: "getter",
      name: named.text,
      computed: named.computed,
      returnType: typeNode(node.type),
    };
    if (ts.isSetAccessorDeclaration?.(node)) return {
      ...base(node, "setter", named.text),
      kind: "setter",
      name: named.text,
      computed: named.computed,
      parameters: parameters(node.parameters),
    };
    return null;
  }

  function heritage(node: any, token: number): DeclarationType[] {
    const clause = Array.from(node.heritageClauses || []).find((item: any) => item.token === token) as any;
    return Array.from(clause?.types || []).map((item: any) => ({
      kind: "reference" as const,
      name: item.expression.getText(sourceFile),
      typeArguments: Array.from(item.typeArguments || []).map(typeNode),
    }));
  }

  function enumValue(node: any): string | number | null {
    if (!node.initializer) return null;
    if (ts.isStringLiteral(node.initializer)) return node.initializer.text;
    if (ts.isNumericLiteral(node.initializer)) return Number(node.initializer.text);
    return node.initializer.getText(sourceFile);
  }

  function declarationKind(node: any): "const" | "let" | "var" {
    const flags = node.parent?.flags || 0;
    if (flags & ts.NodeFlags.Const) return "const";
    if (flags & ts.NodeFlags.Let) return "let";
    return "var";
  }

  function parseModuleBody(body: any): Declaration[] {
    if (!body) return [];
    if (ts.isModuleBlock(body)) return Array.from(body.statements || []).flatMap(statement);
    if (ts.isModuleDeclaration(body)) return statement(body);
    return [];
  }

  function statement(node: any): Declaration[] {
    if (ts.isInterfaceDeclaration(node)) return [{
      ...base(node, "interface", node.name.text),
      kind: "interface",
      name: node.name.text,
      typeParameters: typeParameters(node.typeParameters),
      extends: heritage(node, ts.SyntaxKind.ExtendsKeyword),
      members: Array.from(node.members || []).map(member).filter(Boolean) as DeclarationMember[],
    }];
    if (ts.isClassDeclaration(node)) return [{
      ...base(node, "class", node.name?.text || null),
      kind: "class",
      name: node.name?.text || null,
      typeParameters: typeParameters(node.typeParameters),
      extends: heritage(node, ts.SyntaxKind.ExtendsKeyword),
      implements: heritage(node, ts.SyntaxKind.ImplementsKeyword),
      members: Array.from(node.members || []).map(member).filter(Boolean) as DeclarationMember[],
    }];
    if (ts.isTypeAliasDeclaration(node)) return [{
      ...base(node, "typeAlias", node.name.text),
      kind: "typeAlias",
      name: node.name.text,
      typeParameters: typeParameters(node.typeParameters),
      type: typeNode(node.type),
    }];
    if (ts.isEnumDeclaration(node)) return [{
      ...base(node, "enum", node.name.text),
      kind: "enum",
      name: node.name.text,
      members: Array.from(node.members || []).map((item: any) => {
        const named = nameText(item.name);
        const doc = jsDoc(item);
        return {
          name: named.text,
          value: enumValue(item),
          source: span(item),
          ...(doc ? { jsDoc: doc } : {}),
        };
      }),
    }];
    if (ts.isFunctionDeclaration(node)) return [{
      ...base(node, "function", node.name?.text || null),
      kind: "function",
      name: node.name?.text || null,
      typeParameters: typeParameters(node.typeParameters),
      parameters: parameters(node.parameters),
      returnType: typeNode(node.type),
    }];
    if (ts.isVariableStatement(node)) return Array.from(node.declarationList.declarations || []).map((item: any) => {
      const named = nameText(item.name);
      return {
        ...base(node, "variable", named.text),
        kind: "variable" as const,
        name: named.text,
        declarationKind: declarationKind(item),
        type: typeNode(item.type),
      };
    });
    if (ts.isModuleDeclaration(node)) {
      const name = nameText(node.name).text || "global";
      const namespaceKind = node.flags & ts.NodeFlags.GlobalAugmentation
        ? "global"
        : ts.isStringLiteral(node.name) ? "module" : "namespace";
      return [{
        ...base(node, "namespace", name),
        kind: "namespace",
        name,
        namespaceKind,
        declarations: parseModuleBody(node.body),
      }];
    }
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const namedImports: Array<{ importedName: string; localName: string; typeOnly: boolean }> = [];
      let namespaceImport: string | undefined;
      if (clause?.namedBindings) {
        if (ts.isNamespaceImport(clause.namedBindings)) namespaceImport = clause.namedBindings.name.text;
        if (ts.isNamedImports(clause.namedBindings)) {
          for (const element of clause.namedBindings.elements) namedImports.push({
            importedName: element.propertyName?.text || element.name.text,
            localName: element.name.text,
            typeOnly: !!element.isTypeOnly,
          });
        }
      }
      return [{
        ...base(node, "import", null),
        kind: "import",
        name: null,
        moduleSpecifier: node.moduleSpecifier?.text || node.moduleSpecifier?.getText(sourceFile) || "",
        ...(clause?.name ? { defaultImport: clause.name.text } : {}),
        ...(namespaceImport ? { namespaceImport } : {}),
        namedImports,
        typeOnly: !!clause?.isTypeOnly,
      }];
    }
    if (ts.isExportDeclaration(node)) {
      const specifiers: Array<{ localName: string; exportedName: string; typeOnly: boolean }> = [];
      let namespaceExport: string | undefined;
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const element of node.exportClause.elements) specifiers.push({
          localName: element.propertyName?.text || element.name.text,
          exportedName: element.name.text,
          typeOnly: !!element.isTypeOnly,
        });
      } else if (node.exportClause && ts.isNamespaceExport?.(node.exportClause)) {
        namespaceExport = node.exportClause.name.text;
      }
      return [{
        ...base(node, "export", null),
        kind: "export",
        name: null,
        ...(node.moduleSpecifier ? { moduleSpecifier: node.moduleSpecifier.text || node.moduleSpecifier.getText(sourceFile) } : {}),
        exportAll: !node.exportClause,
        ...(namespaceExport ? { namespaceExport } : {}),
        specifiers,
        typeOnly: !!node.isTypeOnly,
      }];
    }
    if (ts.isExportAssignment(node)) return [{
      ...base(node, "exportAssignment", null),
      kind: "exportAssignment",
      name: null,
      expression: node.expression.getText(sourceFile),
      exportEquals: !!node.isExportEquals,
    }];
    return [];
  }

  return {
    url,
    declarations: Array.from(sourceFile.statements || []).flatMap(statement),
  };
}
