import assert from "node:assert/strict";
import test from "node:test";
import ts from "typescript";
import { parseDeclarationGraph } from "../index.ts";

test("structural declaration IR preserves declarations, scopes, overloads, exports, and modern type syntax", () => {
  const source = [
    "/** Main interface. */",
    "export interface I<T extends Base = Default> extends Parent<T> {",
    "  readonly optional?: string;",
    "  method(x: number): string;",
    "  method(x: string): number;",
    "  (x: T): boolean;",
    "  new (x: T): I<T>;",
    "  [key: string]: unknown;",
    "}",
    "export class C<T> extends Parent<T> implements I<T> {",
    "  static readonly version: string;",
    "  constructor(public value: T);",
    "  get prop(): T;",
    "  set prop(value: T);",
    "  run(...args: T[]): void;",
    "}",
    "export function overloaded(x: number): string;",
    "export function overloaded(x: string): number;",
    "export type Qualified = NS.Type<string>;",
    "export type Union = string | number;",
    "export type Inter = A & B;",
    "export type Tuple = [first?: string, ...rest: number[]];",
    "export type Fn = <T>(x: T) => T;",
    "export type Lit = 'x' | 42 | true | null;",
    "export type Obj = { value?: string; run(x: number): boolean };",
    "export type Mapped<T> = { -readonly [K in keyof T]+?: T[K] };",
    "export type Conditional<T> = T extends infer U ? U : never;",
    "export type Indexed = Obj['value'];",
    "export type Key = keyof Obj;",
    "export type Query = typeof target;",
    "export type Imported = import('./dep').Thing<string>;",
    "export type Template<T extends string> = `hello ${T}!`;",
    "export type Pred = (x: unknown) => x is string;",
    "export type Constructor = new <T>(value: T) => C<T>;",
    "export const v: string;",
    "export enum E { A, B = 'b' }",
    "export namespace Outer { export namespace Inner { export const x: number; } }",
    "declare module 'virtual' { export interface Inside { ok: boolean } }",
    "import Def, * as NS2 from './dep';",
    "import type { A as LocalA, B } from './types';",
    "export { Qualified as Alias };",
    "export type { LocalA as PublicA };",
    "export { I as RemoteI } from './other';",
    "export * from './all';",
    "export * as All from './ns';",
    "export default C;",
  ].join("\n");

  const graph = parseDeclarationGraph(ts, {
    entryUrl: "a.d.ts",
    files: [
      { url: "a.d.ts", text: source },
      { url: "b.d.ts", text: "export interface I { merged: true }" },
    ],
    failed: [],
  });

  assert.equal(graph.files.length, 2);
  const declarations = graph.files[0]!.declarations;
  assert.equal(declarations.filter((item) => item.kind === "function" && item.name === "overloaded").length, 2);

  const iface: any = declarations.find((item) => item.kind === "interface" && item.name === "I");
  assert.equal(iface.modifiers.exported, true);
  assert.equal(iface.members.filter((item: any) => item.kind === "method" && item.name === "method").length, 2);
  assert.equal(iface.members.find((item: any) => item.kind === "property").optional, true);
  assert.equal(iface.extends[0].kind, "reference");

  const klass: any = declarations.find((item) => item.kind === "class");
  assert.equal(klass.implements.length, 1);
  assert.equal(klass.members.find((item: any) => item.kind === "property").modifiers.static, true);
  assert.equal(klass.members.find((item: any) => item.kind === "constructor").parameters[0].parameterProperty, true);

  const alias = (name: string): any =>
    (declarations.find((item) => item.kind === "typeAlias" && item.name === name) as any).type;

  assert.equal(alias("Qualified").kind, "reference");
  assert.equal(alias("Qualified").name, "NS.Type");
  assert.equal(alias("Union").kind, "union");
  assert.equal(alias("Inter").kind, "intersection");
  assert.equal(alias("Tuple").elements[0].optional, true);
  assert.equal(alias("Tuple").elements[1].rest, true);
  assert.equal(alias("Fn").kind, "function");
  assert.equal(alias("Lit").kind, "union");
  assert.equal(alias("Obj").kind, "object");
  assert.equal(alias("Mapped").kind, "mapped");
  assert.equal(alias("Conditional").extendsType.kind, "infer");
  assert.equal(alias("Indexed").kind, "indexedAccess");
  assert.equal(alias("Key").kind, "keyof");
  assert.equal(alias("Query").kind, "typeQuery");
  assert.equal(alias("Imported").kind, "import");
  assert.equal(alias("Template").kind, "templateLiteral");
  assert.equal(alias("Pred").returnType.kind, "predicate");
  assert.equal(alias("Constructor").kind, "constructor");

  const outer: any = declarations.find((item) => item.kind === "namespace" && item.name === "Outer");
  assert.equal(outer.declarations[0].declarations[0].name, "x");

  const aliasExport: any = declarations.find(
    (item: any) => item.kind === "export" && item.specifiers?.some((spec: any) => spec.exportedName === "Alias"),
  );
  assert.deepEqual(aliasExport.specifiers[0], {
    localName: "Qualified",
    exportedName: "Alias",
    typeOnly: false,
  });
  assert.ok(declarations.find((item: any) => item.kind === "export" && item.namespaceExport === "All"));
  assert.ok(declarations.find((item) => item.kind === "exportAssignment"));

  const secondInterface: any = graph.files[1]!.declarations[0];
  assert.equal(secondInterface.name, "I");
  assert.notEqual(secondInterface.source.file, iface.source.file);
  assert.doesNotThrow(() => JSON.stringify(graph));
});

test("anonymous default declarations remain representable", () => {
  const graph = parseDeclarationGraph(ts, {
    entryUrl: "default.d.ts",
    files: [{ url: "default.d.ts", text: "export default class { value: string }" }],
    failed: [],
  });

  const declaration: any = graph.files[0]!.declarations[0];
  assert.equal(declaration.kind, "class");
  assert.equal(declaration.name, null);
  assert.equal(declaration.modifiers.exported, true);
  assert.equal(declaration.modifiers.default, true);
});
