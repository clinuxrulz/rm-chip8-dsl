# API Reference

## Entry Point

### `chip8(fn: () => void): Chip8Program`

Creates a CHIP-8 program from the instructions emitted inside `fn`.

```typescript
const program = chip8(() => {
  cls();
  ldV(v(0), 0x42);
});
```

The function body is executed immediately to capture instructions. Subroutine bodies registered via `fn_()` are deferred until after the main body completes, enabling forward references and mutual recursion.

## Output

### `Chip8Program`

```typescript
interface Chip8Program {
  toBytes(): number[];
  toBinary(): Uint8Array;
  toHexString(): string;
}
```

| Method | Returns | Description |
|--------|---------|-------------|
| `toBytes()` | `number[]` | Array of byte values (0-255) |
| `toBinary()` | `Uint8Array` | `Uint8Array` view of the bytes |
| `toHexString()` | `string` | Space-separated hex pairs like `"00e0 600a"` |

## Literals

### `u8(value: number | Node): Node<"u8">`

Creates or validates an unsigned 8-bit literal node. Throws if value is outside 0-255.

```typescript
ldV(v(0), u8(0xFF));
```

Plain numbers passed to instruction functions are implicitly validated through `wrapU8`.

### `addr(value: number | Label): Node<"addr">`

Creates an address literal node. Throws if value is outside 0-0xFFF.

## Registers

### `v(reg: VRegIndex): Node<"vreg">`

Creates a V-register node. `VRegIndex` is `0 | 1 | ... | 15`.

```typescript
type VRegIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
```

### `VRegLike`

```typescript
type VRegLike = number | VRegIndex | BaseNode<"vreg">;
```

All instruction functions that accept a register accept `VRegLike`, so you can pass a plain number instead of `v(n)`.

### VReg Methods (Chaining)

Each method emits the corresponding instruction and returns `this` for chaining.

| Method | Opcode | Description |
|--------|--------|-------------|
| `vx.ld(vy)` | `8XY0` | Vx = Vy |
| `vx.or(vy)` | `8XY1` | Vx \|= Vy |
| `vx.and(vy)` | `8XY2` | Vx &= Vy |
| `vx.xor(vy)` | `8XY3` | Vx ^= Vy |
| `vx.add(vy)` | `8XY4` | Vx += Vy (VF = carry) |
| `vx.sub(vy)` | `8XY5` | Vx -= Vy (VF = borrow) |
| `vx.shr()` | `8XY6` | Vx >>= 1 (VF = LSB) |
| `vx.subn(vy)` | `8XY7` | Vx = Vy - Vx |
| `vx.shl()` | `8XYE` | Vx <<= 1 (VF = MSB) |

```typescript
v(0).ld(v(1)).add(v(2)).and(v(3));
```

## Labels

### `label(name?: string): Label`

Creates a label with an optional debug name.

### `Label`

```typescript
interface Label {
  here(): void;
}
```

- `label.here()` anchors the label to the current bytecode position
- Throws if `here()` is called twice on the same label
- Supports forward references (use label as a target before calling `here()`)

## Instructions (Standalone)

### Display

```typescript
cls(): void;  // 00E0
```

### Flow Control

```typescript
ret(): void;                    // 00EE
jp(target: number | Label): void;   // 1NNN
call(target: number | Label): void; // 2NNN
```

### Conditional Skips

```typescript
seV(vx: VRegLike, val: number | Node<"u8">): void;   // 3XNN
sneV(vx: VRegLike, val: number | Node<"u8">): void;  // 4XNN
seR(vx: VRegLike, vy: VRegLike): void;                  // 5XY0
sneR(vx: VRegLike, vy: VRegLike): void;                 // 9XY0
```

### Load / Add Immediate

```typescript
ldV(vx: VRegLike, val: number | Node<"u8">): void;   // 6XNN
addV(vx: VRegLike, val: number | Node<"u8">): void;  // 7XNN
```

### Register Operations

```typescript
ldR(vx: VRegLike, vy: VRegLike): void;    // 8XY0
or(vx: VRegLike, vy: VRegLike): void;     // 8XY1
and(vx: VRegLike, vy: VRegLike): void;    // 8XY2
xor(vx: VRegLike, vy: VRegLike): void;    // 8XY3
addR(vx: VRegLike, vy: VRegLike): void;   // 8XY4 (register add with carry)
sub(vx: VRegLike, vy: VRegLike): void;    // 8XY5
shr(vx: VRegLike): void;                  // 8XY6
subn(vx: VRegLike, vy: VRegLike): void;   // 8XY7
shl(vx: VRegLike): void;                  // 8XYE
```

### Address / I-Register

```typescript
ldI(target: number | Label): void;  // ANNN
jpV0(target: number | Label): void; // BNNN
```

### Random

```typescript
rnd(vx: VRegLike, mask: number | Node<"u8">): void; // CXNN
```

### Display

```typescript
drw(vx: VRegLike, vy: VRegLike, n: number): void; // DXYN (n must be 0-15)
```

### Key Input

```typescript
skp(vx: VRegLike): void;   // EX9E
sknp(vx: VRegLike): void;  // EXA1
ldVK(vx: VRegLike): void;  // FX0A
```

### Timers

```typescript
ldVDt(vx: VRegLike): void;  // FX07
ldDtV(vx: VRegLike): void;  // FX15
ldStV(vx: VRegLike): void;  // FX18
```

### I-Register Operations

```typescript
addI(vx: VRegLike): void;       // FX1E
ldSprite(vx: VRegLike): void;   // FX29
bcd(vx: VRegLike): void;        // FX33
ldIVx(vx: VRegLike): void;      // FX55
ldVxI(vx: VRegLike): void;      // FX65
```

### Data Directive

```typescript
db(...bytes: number[]): Label;  // embeds raw bytes, returns a Label
```

## Control Flow

```typescript
if_(cond: VRegLike, body: () => void): void;
If(cond: VRegLike, body: () => void): void;  // alias
while_(cond: VRegLike, body: () => void): void;
break_(): void;
continue_(): void;
```

See [Control Flow](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/control-flow.md) for details.

## Subroutines

```typescript
fn_(name: string, body: () => void): () => void;
```

`fn_()` returns a callable. Invoking the callable inside a `chip8()` body emits a `call` instruction to the subroutine. Subroutines support forward references and mutual recursion.

## Utility

```typescript
isNode(v: unknown): v is BaseNode;

clearRegistry(): void;  // resets internal state (labels, func defs, break/continue stacks)
```

## Types

```typescript
type VRegIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;
type VRegLike = number | VRegIndex | BaseNode<"vreg">;

interface BaseNode<A extends string = string> { ... }
type Node<A extends string = string> = BaseNode<A> & (A extends "vreg" ? VRegOps : {});

interface Label {
  here(): void;
}

interface Chip8Program {
  toBytes(): number[];
  toBinary(): Uint8Array;
  toHexString(): string;
}
```

## See Also

- [Getting Started](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/getting-started.md)
- [Instruction Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/instructions.md)
- [Control Flow](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/control-flow.md)
