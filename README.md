# @random-mesh/rm-chip8-dsl

A TypeScript DSL that compiles to CHIP-8 bytecode. Write CHIP-8 programs using a familiar scope-based API with full TypeScript type safety.

## Installation

```bash
pnpm add @random-mesh/rm-chip8-dsl
```

## Quick Start

```typescript
import { chip8, cls, ldV, v, drw, ldI, db, jp, label } from "@random-mesh/rm-chip8-dsl";

// Compile a CHIP-8 program that draws a sprite in an infinite loop
const program = chip8(() => {
  const loop = label("loop");
  const sprite = db(0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C);

  cls();
  ldV(v(0), 10);
  ldV(v(1), 10);

  loop.here();
  ldI(sprite);
  drw(v(0), v(1), 8);
  addV(v(0), 8);
  jp(loop);
});

// Access the compiled output
program.toBytes();       // number[]
program.toBinary();      // Uint8Array
program.toHexString();   // "00e0 600a ..."
```

## Documentation

- [Getting Started](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/getting-started.md)
- [Instruction Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/instructions.md)
- [Control Flow](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/control-flow.md)
- [API Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/api.md)

## Features

- Full CHIP-8 instruction set (35 opcodes)
- Expression chaining on V-register nodes (`v(0).add(v(1)).and(v(3))`)
- Labels with forward reference support
- `db()` data directive for embedding bytes and sprites
- `if_()` / `If()` conditional bodies
- `while_()` loops with `break_()` and `continue_()`
- `fn_()` subroutines with forward-call and mutual recursion support
- Zero runtime dependencies
- Output: bytes array, `Uint8Array`, or hex string

## License

MIT
