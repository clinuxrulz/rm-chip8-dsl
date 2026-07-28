# Instruction Reference

All 35 standard CHIP-8 opcodes are exposed as standalone functions. Instructions that operate on V-registers accept `VRegLike` (a `v()` node or a plain number 0-15).

## Display / Clear

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `cls()` | `00E0` | Clear the display |

## Flow Control

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `ret()` | `00EE` | Return from subroutine |
| `jp(target)` | `1NNN` | Jump to address or label |
| `call(target)` | `2NNN` | Call subroutine at address or label |

## Conditional Skips

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `seV(vx, val)` | `3XNN` | Skip next if Vx == NN |
| `sneV(vx, val)` | `4XNN` | Skip next if Vx != NN |
| `seR(vx, vy)` | `5XY0` | Skip next if Vx == Vy |
| `sneR(vx, vy)` | `9XY0` | Skip next if Vx != Vy |

## Load / Add Immediate

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `ldV(vx, val)` | `6XNN` | Vx = NN |
| `addV(vx, val)` | `7XNN` | Vx += NN (no carry flag update) |

## Register-to-Register Operations (8XY_)

These are available as both standalone functions and chained methods on vreg nodes.

| Method | Standalone | Opcode | Operation |
|--------|-----------|--------|-----------|
| `vx.ld(vy)` | `ldR(vx, vy)` | `8XY0` | Vx = Vy |
| `vx.or(vy)` | `or(vx, vy)` | `8XY1` | Vx \|= Vy |
| `vx.and(vy)` | `and(vx, vy)` | `8XY2` | Vx &= Vy |
| `vx.xor(vy)` | `xor(vx, vy)` | `8XY3` | Vx ^= Vy |
| `vx.add(vy)` | `addR(vx, vy)` | `8XY4` | Vx += Vy (VF = carry) |
| `vx.sub(vy)` | `sub(vx, vy)` | `8XY5` | Vx -= Vy (VF = borrow) |
| `vx.shr()` | `shr(vx)` | `8XY6` | Vx >>= 1 (VF = LSB) |
| `vx.subn(vy)` | `subn(vx, vy)` | `8XY7` | Vx = Vy - Vx |
| `vx.shl()` | `shl(vx)` | `8XYE` | Vx <<= 1 (VF = MSB) |

Chained example:

```typescript
import { chip8, v } from "@random-mesh/rm-chip8-dsl";

chip8(() => {
  v(0).ld(v(1)).add(v(2)).and(v(3));
  // Emits: 8XY0, 8XY4, 8XY2
});
```

## Address / I-Register

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `ldI(target)` | `ANNN` | I = address or label |
| `jpV0(target)` | `BNNN` | Jump to address + V0 |

## Random

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `rnd(vx, mask)` | `CXNN` | Vx = rand() & NN |

## Display

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `drw(vx, vy, n)` | `DXYN` | Draw sprite at (Vx, Vy), height N |

`n` must be 0–15.

## Key Input

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `skp(vx)` | `EX9E` | Skip next if key Vx pressed |
| `sknp(vx)` | `EXA1` | Skip next if key Vx not pressed |
| `ldVK(vx)` | `FX0A` | Wait for keypress, store in Vx |

## Timers

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `ldVDt(vx)` | `FX07` | Vx = delay timer |
| `ldDtV(vx)` | `FX15` | Delay timer = Vx |
| `ldStV(vx)` | `FX18` | Sound timer = Vx |

## I-Register Operations

| Instruction | Opcode | Function |
|-------------|--------|----------|
| `addI(vx)` | `FX1E` | I += Vx |
| `ldSprite(vx)` | `FX29` | I = sprite address for digit Vx |
| `bcd(vx)` | `FX33` | Store BCD of Vx at I, I+1, I+2 |
| `ldIVx(vx)` | `FX55` | Store V0..Vx at I..I+x |
| `ldVxI(vx)` | `FX65` | Load V0..Vx from I..I+x |

## Data Directive

| Function | Description |
|----------|-------------|
| `db(...bytes: number[])` | Embed raw bytes at the current position; returns a `Label` |

```typescript
const sprite = db(0xF0, 0x90, 0xF0, 0x90, 0x90);
ldI(sprite);
drw(v(0), v(1), 5);
```

## See Also

- [Getting Started](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/getting-started.md)
- [Control Flow](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/control-flow.md)
- [API Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/api.md)
