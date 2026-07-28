# Control Flow

## Labels

Labels mark positions in the compiled bytecode for jump/call targets.

```typescript
import { chip8, label, jp, ldV, v } from "@random-mesh/rm-chip8-dsl";

const loop = label("loop");

const program = chip8(() => {
  ldV(v(0), 10);
  loop.here();     // anchor the label at this position
  addV(v(0), 255); // decrement V0
  jp(loop);        // jump back to loop
});
```

- `label(name?)` creates a new `Label` with an optional debug name
- `label.here()` anchors the label to the current bytecode position
- Labels support forward references (jump before `here()`)
- Calling `here()` twice on the same label throws an error

## Conditional: `if_()` / `If()`

Executes a body only when a register is non-zero.

```typescript
import { chip8, if_, If, v } from "@random-mesh/rm-chip8-dsl";

chip8(() => {
  if_(v(0), () => {
    ldV(v(1), 0x01);  // runs only if V0 != 0
  });

  // Alias:
  If(v(0), () => {
    ldV(v(1), 0x02);
  });
});
```

Compiled pattern: `sneV V0, 0` + `jp end` + body + `end:`.

## Loop: `while_()`

Repeatedly executes a body while a register is non-zero.

```typescript
import { chip8, while_, addV, v } from "@random-mesh/rm-chip8-dsl";

chip8(() => {
  ldV(v(0), 5);
  while_(v(0), () => {
    addV(v(0), 255); // decrement until V0 reaches 0
  });
});
```

Compiled pattern: `loop: seV V0, 0` + `jp exit` + body + `jp loop` + `exit:`.

### `break_()` and `continue_()`

Use inside a `while_()` body:

```typescript
import { chip8, while_, if_, break_, continue_, v } from "@random-mesh/rm-chip8-dsl";

chip8(() => {
  ldV(v(0), 10);
  while_(v(0), () => {
    if_(v(1), () => break_());      // exit the loop
    addV(v(0), 255);
    if_(v(0), () => continue_());   // jump back to condition check
    ldV(v(1), 0xFF);                // skipped if continue_ fires
  });
});
```

- `break_()` jumps to the exit of the innermost `while_()`
- `continue_()` jumps to the condition check of the innermost `while_()`
- Both throw if used outside of a `while_()` body
- Nested `while_()` loops are supported — `break_()` / `continue_()` target the innermost loop

## Subroutines: `fn_()`

Define reusable subroutines with `fn_()`.

```typescript
import { chip8, fn_, cls, ldV, v } from "@random-mesh/rm-chip8-dsl";

const beep = fn_("beep", () => {
  ldStV(v(0));  // set sound timer
  ret();
});

const program = chip8(() => {
  cls();
  ldV(v(0), 10);
  beep();  // emits a call to the subroutine
});
```

Key details:

- `fn_(name, body)` registers a subroutine and returns a callable
- Call the returned function to emit a `call` instruction targeting the subroutine
- Subroutine bodies are compiled in registration order (the order `fn_()` is called)
- Subroutines **must** end with `ret()`

### Forward Calls

Functions can call other functions defined later in the source:

```typescript
const outer = fn_("outer", () => {
  inner();  // forward reference - works because fn_ body execution is deferred
  ret();
});

const inner = fn_("inner", () => {
  ldV(v(1), 0x01);
  ret();
});
```

### Mutual Recursion

Two functions can call each other:

```typescript
const fnA = fn_("fnA", () => {
  fnB();
  ret();
});

const fnB = fn_("fnB", () => {
  fnA();
  ret();
});

const program = chip8(() => {
  fnA();
});
```

## See Also

- [Getting Started](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/getting-started.md)
- [Instruction Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/instructions.md)
- [API Reference](https://github.com/clinuxrulz/rm-chip8-dsl/blob/main/docs/api.md)
