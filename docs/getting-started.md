# Getting Started

## Overview

`rm-chip8-dsl` is a TypeScript embedded domain-specific language for generating [CHIP-8](https://en.wikipedia.org/wiki/CHIP-8) bytecode. Programs are written as plain TypeScript functions that call instruction functions - the DSL captures the instruction stream and compiles it to binary during a finalization step.

## Installation

```bash
pnpm add @random-mesh/rm-chip8-dsl
```

Requirements: TypeScript 5.8+, `moduleResolution: "node16"` or `"bundler"`.

## Your First Program

Every program is wrapped in a `chip8()` call:

```typescript
import { chip8, cls, ldV, v } from "@random-mesh/rm-chip8-dsl";

const program = chip8(() => {
  cls();          // Clear the screen (00E0)
  ldV(v(0), 0x0A); // V0 = 10  (600A)
});
```

`chip8()` returns a `Chip8Program` object:

```typescript
program.toBytes();       // [0x00, 0xE0, 0x60, 0x0A]
program.toBinary();      // Uint8Array([...])
program.toHexString();   // "00e0 600a"
```

## Using Registers

Registers V0-VF are created with the `v()` function. It returns a typed node that supports method chaining:

```typescript
import { chip8, v } from "@random-mesh/rm-chip8-dsl";

chip8(() => {
  v(0).ld(v(1));    // V0 = V1  (8XY0)
  v(1).add(v(2));   // V1 += V2 (8XY4)
  v(3).xor(v(4));   // V3 ^= V4 (8XY3)
});
```

Chained methods return the same register node, so you can chain:

```typescript
v(0).ld(v(1)).add(v(2)).and(v(3));
```

Standalone instruction functions also accept plain numbers for registers:

```typescript
ldV(0, 0xFF);   // V0 = 255, same as ldV(v(0), 0xFF)
addV(7, 0x01);  // V7 += 1
```

## Labels

Labels mark positions in the bytecode and can be used as jump targets:

```typescript
import { chip8, label, jp, ldV, v } from "@random-mesh/rm-chip8-dsl";

chip8(() => {
  const loop = label("loop");
  loop.here();
  ldV(v(0), 0x01);
  jp(loop);  // jump back to loop
});
```

Labels support forward references - you can jump to a label before it is placed:

```typescript
const loop = label("loop");
jp(loop);      // forward reference - fine
loop.here();   // anchor the label later
```

## Data Directive

Embed raw bytes with `db()`:

```typescript
import { chip8, db } from "@random-mesh/rm-chip8-dsl";

chip8(() => {
  const sprite = db(0x3C, 0x7E, 0xFF, 0x7E, 0x3C);
  // Use the returned label with ldI
  ldI(sprite);
  drw(v(0), v(1), 5);
});
```

`db()` returns a `Label` that can be used anywhere a label is accepted.

## Output

Call `chip8()` to compile. The returned object provides three output formats:

| Method | Returns | Description |
|--------|---------|-------------|
| `toBytes()` | `number[]` | Array of byte values (0-255) |
| `toBinary()` | `Uint8Array` | `Uint8Array` view of the bytes |
| `toHexString()` | `string` | Space-separated hex pairs |

## Next Steps

- [Instruction Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/instructions.md) - all 35 CHIP-8 opcodes
- [Control Flow](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/control-flow.md) - labels, `if_`, `while_`, `fn_` subroutines
- [API Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/api.md) - complete API listing
