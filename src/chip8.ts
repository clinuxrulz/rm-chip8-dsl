// == RM-CHIP8-DSL: A TypeScript DSL that compiles to CHIP-8 bytecode ==
// Architecture follows the same node-graph DAG pattern as rm-wasm.

const __brand = Symbol();

// === Types ===

export type VRegIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

type Chip8Type = "u8" | "addr" | "vreg" | "ireg" | "void";

export interface BaseNode<A extends string = string> {
  [__brand]: A;
  _t: Chip8Type;
  type: string;
  params?: BaseNode[];
  value?: unknown;
  _offset?: number;
}

// === VReg expression methods ===

interface VRegOps {
  ld(other: VRegLike): Node<"vreg">;
  or(other: VRegLike): Node<"vreg">;
  and(other: VRegLike): Node<"vreg">;
  xor(other: VRegLike): Node<"vreg">;
  add(other: VRegLike): Node<"vreg">;
  sub(other: VRegLike): Node<"vreg">;
  shr(): Node<"vreg">;
  subn(other: VRegLike): Node<"vreg">;
  shl(): Node<"vreg">;
}

// === Node types ===

export type VRegLike = number | VRegIndex | BaseNode<"vreg">;

export type Node<A extends string = string> = BaseNode<A> & (A extends "vreg" ? VRegOps : {});

export function isNode(v: unknown): v is BaseNode {
  return typeof v === "object" && v !== null && __brand in v;
}

// === Label ===

export interface Label {
  here(): void;
}

class LabelImpl implements Label {
  name: string;
  _addr: number = -1;
  _emitted: boolean = false;
  constructor(name: string) { this.name = name; }
  here(): void {
    if (this._emitted) throw new Error(`[rm-chip8] Label "${this.name}" already emitted`);
    assertBlockScope("label.here", scope => {
      scope.push(node({ _t: "void", type: "label", value: { label: this } }));
    });
    this._emitted = true;
  }
}

export function label(name?: string): Label {
  return new LabelImpl(name ?? `L${nextLabelId++}`);
}

let nextLabelId = 0;

// === NodeImpl ===

export class NodeImpl {
  [__brand]: string;
  _t: Chip8Type; type: string; params?: BaseNode[]; value?: unknown; _offset?: number;
  constructor(config: { _t?: Chip8Type; type: string; params?: BaseNode[]; value?: unknown }) {
    this[__brand] = (config._t ?? config.type) as string;
    this._t = (config._t ?? config.type) as Chip8Type;
    this.type = config.type;
    this.params = config.params;
    this.value = config.value;
  }
}

function initVRegOps() {
  const proto = NodeImpl.prototype as any;

  const vregOps: [string, string][] = [
    ["ld", "ldR"], ["or", "or"], ["and", "and"], ["xor", "xor"],
    ["add", "addR"], ["sub", "sub"], ["subn", "subn"],
  ];

  for (const [methodName, nodeType] of vregOps) {
    proto[methodName] = function (other: any) {
      const otherNode = wrapVReg(other);
      assertBlockScope(methodName, scope => {
        scope.push(node({ _t: "void", type: nodeType, params: [this as BaseNode, otherNode] }));
      });
      return this;
    };
  }

  proto["shr"] = function () {
    assertBlockScope("shr", scope => {
      scope.push(node({ _t: "void", type: "shr", params: [this as BaseNode] }));
    });
    return this;
  };

  proto["shl"] = function () {
    assertBlockScope("shl", scope => {
      scope.push(node({ _t: "void", type: "shl", params: [this as BaseNode] }));
    });
    return this;
  };
}
initVRegOps();

export const Node = NodeImpl as unknown as new (config: {
  _t?: Chip8Type; type: string; params?: BaseNode[]; value?: unknown;
}) => Node;

// === Helpers ===

export function node(config: { _t?: Chip8Type; type: string; params?: BaseNode[]; value?: unknown }): BaseNode {
  return new NodeImpl(config as any) as BaseNode;
}

function wrapVReg(v: VRegLike): BaseNode<"vreg"> {
  if (isNode(v)) return v as BaseNode<"vreg">;
  if (typeof v === "number") return node({ _t: "vreg", type: "vreg", value: { reg: Math.floor(v) } }) as BaseNode<"vreg">;
  throw new Error(`[rm-chip8] Invalid register: ${v}`);
}

function wrapU8(v: number | BaseNode): BaseNode {
  if (isNode(v)) return v;
  if (typeof v === "number") {
    const n = Math.floor(v);
    if (n < 0 || n > 255) throw new Error(`[rm-chip8] u8 value out of range: ${n}`);
    return node({ _t: "u8", type: "u8", value: { n } });
  }
  throw new Error(`[rm-chip8] Invalid u8 value: ${v}`);
}

function pushNode(type: string, config?: { params?: BaseNode[]; value?: unknown }): void {
  assertBlockScope(type, scope => {
    scope.push(node({ _t: "void", type, ...config }));
  });
}

// === Literal & Register constructors ===

export function u8(value: number | Node): Node<"u8"> {
  if (isNode(value)) return node({ _t: "u8", type: "construct", params: [value] }) as Node<"u8">;
  const n = Math.floor(value);
  if (n < 0 || n > 255) throw new Error(`[rm-chip8] u8 out of range: ${n}`);
  return node({ _t: "u8", type: "u8", value: { n } }) as Node<"u8">;
}

export function addr(value: number | Label): Node<"addr"> {
  if (typeof value === "number") {
    const n = Math.floor(value);
    if (n < 0 || n > 0xFFF) throw new Error(`[rm-chip8] addr out of range: ${n}`);
    return node({ _t: "addr", type: "addr", value: { n } }) as Node<"addr">;
  }
  return node({ _t: "addr", type: "addr", value: { label: value } }) as Node<"addr">;
}

export function v(reg: VRegIndex): Node<"vreg"> {
  return node({ _t: "vreg", type: "vreg", value: { reg } }) as Node<"vreg">;
}

// === Scope management ===

let currentScope: BaseNode[] | null = null;

function assertBlockScope(context: string, fn: (scope: BaseNode[]) => void): void {
  if (!currentScope) throw new Error(`[rm-chip8] ${context} used outside of a chip8() program block`);
  fn(currentScope);
}

function withScope<T>(scope: BaseNode[], fn: () => T): T {
  const oldScope = currentScope;
  currentScope = scope;
  try { return fn(); }
  finally { currentScope = oldScope; }
}

// === Standalone instruction functions ===

export function cls(): void { pushNode("cls"); }
export function ret(): void { pushNode("ret"); }
export function jp(target: number | Label): void { pushNode("jp", { value: { addr: target } }); }
export function call(target: number | Label): void { pushNode("call", { value: { addr: target } }); }

export function seV(vx: VRegLike, val: number | Node<"u8">): void {
  pushNode("seV", { params: [wrapVReg(vx), wrapU8(val as any)] });
}
export function sneV(vx: VRegLike, val: number | Node<"u8">): void {
  pushNode("sneV", { params: [wrapVReg(vx), wrapU8(val as any)] });
}
export function seR(vx: VRegLike, vy: VRegLike): void {
  pushNode("seR", { params: [wrapVReg(vx), wrapVReg(vy)] });
}
export function sneR(vx: VRegLike, vy: VRegLike): void {
  pushNode("sneR", { params: [wrapVReg(vx), wrapVReg(vy)] });
}
export function ldV(vx: VRegLike, val: number | Node<"u8">): void {
  pushNode("ldV", { params: [wrapVReg(vx), wrapU8(val as any)] });
}
export function addV(vx: VRegLike, val: number | Node<"u8">): void {
  pushNode("addV", { params: [wrapVReg(vx), wrapU8(val as any)] });
}
export function ldR(vx: VRegLike, vy: VRegLike): void {
  pushNode("ldR", { params: [wrapVReg(vx), wrapVReg(vy)] });
}
export function ldI(target: number | Label): void {
  pushNode("ldI", { value: { addr: target } });
}
export function jpV0(target: number | Label): void {
  pushNode("jpV0", { value: { addr: target } });
}
export function rnd(vx: VRegLike, mask: number | Node<"u8">): void {
  pushNode("rnd", { params: [wrapVReg(vx), wrapU8(mask as any)] });
}
export function drw(vx: VRegLike, vy: VRegLike, n: number): void {
  if (n < 0 || n > 15) throw new Error(`[rm-chip8] drw: n must be 0-15, got ${n}`);
  pushNode("drw", { params: [wrapVReg(vx), wrapVReg(vy)], value: { n } });
}
export function skp(vx: VRegLike): void { pushNode("skp", { params: [wrapVReg(vx)] }); }
export function sknp(vx: VRegLike): void { pushNode("sknp", { params: [wrapVReg(vx)] }); }
export function ldVDt(vx: VRegLike): void { pushNode("ldVDt", { params: [wrapVReg(vx)] }); }
export function ldVK(vx: VRegLike): void { pushNode("ldVK", { params: [wrapVReg(vx)] }); }
export function ldDtV(vx: VRegLike): void { pushNode("ldDtV", { params: [wrapVReg(vx)] }); }
export function ldStV(vx: VRegLike): void { pushNode("ldStV", { params: [wrapVReg(vx)] }); }
export function addI(vx: VRegLike): void { pushNode("addI", { params: [wrapVReg(vx)] }); }
export function ldSprite(vx: VRegLike): void { pushNode("ldSprite", { params: [wrapVReg(vx)] }); }
export function bcd(vx: VRegLike): void { pushNode("bcd", { params: [wrapVReg(vx)] }); }
export function ldIVx(vx: VRegLike): void { pushNode("ldIVx", { params: [wrapVReg(vx)] }); }
export function ldVxI(vx: VRegLike): void { pushNode("ldVxI", { params: [wrapVReg(vx)] }); }

export function db(...bytes: number[]): Label {
  const lbl = new LabelImpl(`data_${nextLabelId++}`);
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] < 0 || bytes[i] > 255) {
      throw new Error(`[rm-chip8] db: byte ${i} out of range: ${bytes[i]}`);
    }
  }
  pushNode("data", { value: { bytes, label: lbl } });
  return lbl;
}

// === Control flow: break / continue label stacks ===

const breakLabels: LabelImpl[] = [];
const continueLabels: LabelImpl[] = [];

export function break_(): void {
  if (breakLabels.length === 0) throw new Error("[rm-chip8] break_() used outside of while_()");
  const target = breakLabels[breakLabels.length - 1];
  pushNode("jp", { value: { addr: target } });
}

export function continue_(): void {
  if (continueLabels.length === 0) throw new Error("[rm-chip8] continue_() used outside of while_()");
  const target = continueLabels[continueLabels.length - 1];
  pushNode("jp", { value: { addr: target } });
}

// === Control flow: if_ / while_ ===

export function if_(cond: VRegLike, body: () => void): void {
  const condNode = wrapVReg(cond);
  const end = new LabelImpl(`if_end_${nextLabelId++}`);

  sneV(condNode, 0);
  jp(end);
  body();
  end.here();
}

export function while_(cond: VRegLike, body: () => void): void {
  const condNode = wrapVReg(cond);
  const loopLabel = new LabelImpl(`while_loop_${nextLabelId++}`);
  const contLabel = new LabelImpl(`while_cont_${nextLabelId++}`);
  const exitLabel = new LabelImpl(`while_exit_${nextLabelId++}`);

  breakLabels.push(exitLabel);
  continueLabels.push(contLabel);

  loopLabel.here();
  seV(condNode, 0);
  jp(exitLabel);
  body();
  contLabel.here();
  jp(loopLabel);
  exitLabel.here();

  breakLabels.pop();
  continueLabels.pop();
}

export const If = if_;

// === Subroutines: fn_ ===

interface FuncDef {
  label: LabelImpl;
  body: () => void;
  bodyNodes: BaseNode[];
}

const funcDefs: FuncDef[] = [];

export function fn_(name: string, body: () => void): () => void {
  const fnLabel = new LabelImpl(`_fn_${name}`);
  funcDefs.push({ label: fnLabel, body, bodyNodes: [] });

  return () => {
    pushNode("call", { value: { addr: fnLabel } });
  };
}

// === Chip8Program ===

export interface Chip8Program {
  toBinary(): Uint8Array;
  toHexString(): string;
  toBytes(): number[];
}

class Chip8ProgramImpl implements Chip8Program {
  private nodes: BaseNode[];
  private funcs: FuncDef[];

  constructor(nodes: BaseNode[], funcs: FuncDef[]) {
    this.nodes = nodes;
    this.funcs = funcs;
  }

  toBytes(): number[] {
    return compile(this.nodes, this.funcs);
  }

  toBinary(): Uint8Array {
    return new Uint8Array(this.toBytes());
  }

  toHexString(): string {
    const bytes = this.toBytes();
    let hex = "";
    for (let i = 0; i < bytes.length; i += 2) {
      if (i > 0) hex += " ";
      hex += bytes[i].toString(16).padStart(2, "0");
      hex += bytes[i + 1].toString(16).padStart(2, "0");
    }
    return hex;
  }
}

// === Compilation (Two-Pass) ===

function compile(mainNodes: BaseNode[], funcs: FuncDef[]): number[] {
  let offset = 0x200;

  for (const n of mainNodes) {
    if (n.type === "label") {
      (n.value as any).label._addr = offset;
    } else if (n.type === "data") {
      const v = n.value as any;
      v.label._addr = offset;
      n._offset = offset;
      offset += v.bytes.length;
    } else {
      n._offset = offset;
      offset += 2;
    }
  }

  for (const def of funcs) {
    def.label._addr = offset;
    for (const n of def.bodyNodes) {
      if (n.type === "label") {
        (n.value as any).label._addr = offset;
      } else if (n.type === "data") {
        const v = n.value as any;
        v.label._addr = offset;
        n._offset = offset;
        offset += v.bytes.length;
      } else {
        n._offset = offset;
        offset += 2;
      }
    }
  }

  function resolveAddr(target: number | Label): number {
    if (typeof target === "number") return target;
    const lbl = target as LabelImpl;
    if (lbl._addr === -1) throw new Error(`[rm-chip8] Label "${lbl.name}" was never emitted`);
    return lbl._addr;
  }

  const result: number[] = [];

  function emitNodes(nodes: BaseNode[]): void {
    for (const n of nodes) {
      if (n.type === "label") continue;
      if (n.type === "data") {
        const bytes = (n.value as any).bytes as number[];
        for (const b of bytes) result.push(b & 0xFF);
        continue;
      }
      const [b1, b2] = encodeInstruction(n, resolveAddr);
      result.push(b1 & 0xFF, b2 & 0xFF);
    }
  }

  emitNodes(mainNodes);
  for (const def of funcs) emitNodes(def.bodyNodes);

  return result;
}

function regIndex(node: BaseNode): number {
  const v = node.value as any;
  if (v && typeof v.reg === "number") return v.reg;
  throw new Error(`[rm-chip8] Expected vreg node, got ${node.type}`);
}

function u8Value(node: BaseNode): number {
  const v = node.value as any;
  if (v && typeof v.n === "number") return v.n;
  throw new Error(`[rm-chip8] Expected u8 node, got ${node.type}`);
}

function encodeInstruction(
  n: BaseNode,
  resolveAddr: (target: number | Label) => number,
): [number, number] {
  const type = n.type;
  const p = n.params || [];
  const v = n.value as any;

  switch (type) {
    case "cls": return [0x00, 0xE0];
    case "ret": return [0x00, 0xEE];

    case "jp": {
      const a = resolveAddr(v.addr);
      return [0x10 | ((a >> 8) & 0x0F), a & 0xFF];
    }
    case "call": {
      const a = resolveAddr(v.addr);
      return [0x20 | ((a >> 8) & 0x0F), a & 0xFF];
    }

    case "seV": {
      const x = regIndex(p[0]);
      const nn = u8Value(p[1]);
      return [0x30 | x, nn];
    }
    case "sneV": {
      const x = regIndex(p[0]);
      const nn = u8Value(p[1]);
      return [0x40 | x, nn];
    }
    case "seR": {
      const x = regIndex(p[0]);
      const y = regIndex(p[1]);
      return [0x50 | x, y << 4];
    }

    case "ldV": {
      const x = regIndex(p[0]);
      const nn = u8Value(p[1]);
      return [0x60 | x, nn];
    }
    case "addV": {
      const x = regIndex(p[0]);
      const nn = u8Value(p[1]);
      return [0x70 | x, nn];
    }

    case "ldR": return [0x80 | regIndex(p[0]), (regIndex(p[1]) << 4) | 0x00];
    case "or":  return [0x80 | regIndex(p[0]), (regIndex(p[1]) << 4) | 0x01];
    case "and": return [0x80 | regIndex(p[0]), (regIndex(p[1]) << 4) | 0x02];
    case "xor": return [0x80 | regIndex(p[0]), (regIndex(p[1]) << 4) | 0x03];
    case "addR":return [0x80 | regIndex(p[0]), (regIndex(p[1]) << 4) | 0x04];
    case "sub": return [0x80 | regIndex(p[0]), (regIndex(p[1]) << 4) | 0x05];
    case "shr": return [0x80 | regIndex(p[0]), (regIndex(p[0]) << 4) | 0x06];
    case "subn":return [0x80 | regIndex(p[0]), (regIndex(p[1]) << 4) | 0x07];
    case "shl": return [0x80 | regIndex(p[0]), (regIndex(p[0]) << 4) | 0x0E];

    case "sneR": return [0x90 | regIndex(p[0]), regIndex(p[1]) << 4];

    case "ldI": {
      const a = resolveAddr(v.addr);
      return [0xA0 | ((a >> 8) & 0x0F), a & 0xFF];
    }
    case "jpV0": {
      const a = resolveAddr(v.addr);
      return [0xB0 | ((a >> 8) & 0x0F), a & 0xFF];
    }
    case "rnd": return [0xC0 | regIndex(p[0]), u8Value(p[1])];

    case "drw": {
      return [0xD0 | regIndex(p[0]), (regIndex(p[1]) << 4) | (v.n as number)];
    }

    case "skp":  return [0xE0 | regIndex(p[0]), 0x9E];
    case "sknp": return [0xE0 | regIndex(p[0]), 0xA1];

    case "ldVDt":   return [0xF0 | regIndex(p[0]), 0x07];
    case "ldVK":    return [0xF0 | regIndex(p[0]), 0x0A];
    case "ldDtV":   return [0xF0 | regIndex(p[0]), 0x15];
    case "ldStV":   return [0xF0 | regIndex(p[0]), 0x18];
    case "addI":    return [0xF0 | regIndex(p[0]), 0x1E];
    case "ldSprite":return [0xF0 | regIndex(p[0]), 0x29];
    case "bcd":     return [0xF0 | regIndex(p[0]), 0x33];
    case "ldIVx":   return [0xF0 | regIndex(p[0]), 0x55];
    case "ldVxI":   return [0xF0 | regIndex(p[0]), 0x65];

    default:
      throw new Error(`[rm-chip8] Unknown instruction type: ${type}`);
  }
}

// === Entry Point ===

export function chip8(fn: () => void): Chip8Program {
  const oldScope = currentScope;
  const scope: BaseNode[] = [];
  currentScope = scope;
  try {
    fn();
  } finally {
    currentScope = oldScope;
  }

  for (const def of funcDefs) {
    def.bodyNodes = [];
    withScope(def.bodyNodes, def.body);
  }

  const snapshot = funcDefs.map(def => ({
    label: def.label,
    body: def.body,
    bodyNodes: [...def.bodyNodes],
  }));

  return new Chip8ProgramImpl(scope, snapshot);
}

// === Registry ===

export function clearRegistry(): void {
  nextLabelId = 0;
  funcDefs.length = 0;
  breakLabels.length = 0;
  continueLabels.length = 0;
}
