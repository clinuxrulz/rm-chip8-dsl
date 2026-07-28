import { describe, it, expect, beforeEach } from "vitest";
import { clearRegistry } from "@random-mesh/rm-chip8-dsl";
import { createCpu } from "typescript-chip8";
import { program } from "../src/breakout.js";

beforeEach(() => {
  clearRegistry();
});

// Minimal type for the runtime shape of the CPU emulator
interface CpuDebug {
  registers: Uint8Array;
  memory: Uint8Array;
  pc: number;
  i: number;
  sp: number;
  delayTimer: number;
  soundTimer: number;
  io: {
    display: number[][];
    pressedKeys: number;
    lastKeyPressed: number;
    keyDown(key: number): void;
    keyUp(key: number): void;
    isKeyDown(key: number): boolean;
    clearDisplay(): void;
    drawSprite(sprite: Uint8Array, x: number, y: number): boolean;
  };
  load(data: Buffer): void;
  cycle(): void;
}

function makeCpu(): CpuDebug {
  return createCpu() as unknown as CpuDebug;
}

/** Render the 64x32 screen buffer to an ASCII string */
function dumpScreen(display: number[][]): string {
  const lines: string[] = [];
  for (let y = 0; y < 32; y++) {
    lines.push(display[y].map((p: number) => (p ? "\u2588" : " ")).join(""));
  }
  return lines.join("\n");
}

/** Format all 16 V-registers as a hex string */
function dumpRegs(r: Uint8Array): string {
  return Array.from({ length: 16 }, (_, i) => `V${i.toString(16).toUpperCase()}=${r[i].toString(16).padStart(2, "0")}`).join(" ");
}

function dumpCpu(cpu: CpuDebug, label: string): void {
  console.log(`\n── ${label} ──`);
  console.log(`PC=0x${cpu.pc.toString(16).padStart(3, "0")}  I=0x${cpu.i.toString(16).padStart(3, "0")}  SP=${cpu.sp}  DT=${cpu.delayTimer}  ST=${cpu.soundTimer}`);
  console.log(dumpRegs(cpu.registers));
}

/** Count lit pixels on screen */
function countPixels(cpu: CpuDebug): number {
  let n = 0;
  for (let y = 0; y < 32; y++)
    for (let x = 0; x < 64; x++)
      if (cpu.io.display[y][x]) n++;
  return n;
}

/** Decode an opcode for debug printing */
function opcodeStr(cpu: CpuDebug, pc: number): string {
  const op = (cpu.memory[pc] << 8) | cpu.memory[pc + 1];
  return `0x${op.toString(16).padStart(4, "0")}`;
}

/** Step N instructions */
function stepN(cpu: CpuDebug, n: number): void {
  for (let i = 0; i < n; i++) cpu.cycle();
}

// ──────────────────────────────────────────────────

describe("Breakout emulation debug", () => {
  it("compiles", () => {
    expect(() => program.toBytes()).not.toThrow();
  });

  it("init: bricks visible, ball on paddle", () => {
    const bytes = program.toBytes();
    const cpu = makeCpu();

    // Load ROM at 0x200
    for (let i = 0; i < bytes.length; i++) cpu.memory[0x200 + i] = bytes[i];

    // The first instruction is JP over data section.
    // After that comes CLS, init registers, draw bricks.
    // Run enough cycles to finish init (before the main loop starts).
    // The init consists of:
    //   JP over data (1 cycle), then CLS (1), then ~21 ld/add instructions,
    //   then the drawAllBricks nested loops (~32 draws).
    // Let's run 200 cycles to be safe and see what we have.
    stepN(cpu, 200);

    dumpCpu(cpu, "After init");
    console.log(dumpScreen(cpu.io.display));
    console.log(`Pixels on: ${countPixels(cpu)}`);

    // We should see bricks and at least something on screen
    const px = countPixels(cpu);
    console.log(`\nPixels: ${px}`);
    expect(px).toBeGreaterThan(0);

    // Check the brick state data (bytes 0xFF = all bricks alive)
    // Brick state is stored in memory after the BCD buffer.
    // Find the brickState label offset by looking at the compiled output.
    // We can find it by scanning for the 0xFF bytes in the ROM data section.
    for (let addr = 0x200; addr < 0x200 + bytes.length - 4; addr++) {
      if (cpu.memory[addr] === 0xFF &&
          cpu.memory[addr + 1] === 0xFF &&
          cpu.memory[addr + 2] === 0xFF &&
          cpu.memory[addr + 3] === 0xFF) {
        console.log(`Brick state table found at 0x${addr.toString(16)}`);
        break;
      }
    }
  });

  it("single-step first 80 instructions with full dump", () => {
    const bytes = program.toBytes();
    const cpu = makeCpu();

    for (let i = 0; i < bytes.length; i++) cpu.memory[0x200 + i] = bytes[i];

    for (let step = 0; step < 80; step++) {
      const pc = cpu.pc;
      const op = opcodeStr(cpu, pc);
      console.log(`\n#${step.toString().padStart(2, " ")}  [${op}]  PC=0x${pc.toString(16).padStart(3, "0")}  I=0x${cpu.i.toString(16).padStart(3, "0")}`);
      console.log(`  ${dumpRegs(cpu.registers)}`);

      // For DRW instructions, dump the sprite data and coords
      if (op.startsWith("0xD")) {
        const rx = cpu.memory[pc + 1] >> 4;
        const ry = cpu.memory[pc + 1] & 0x0f;
        const n = cpu.memory[pc + 1] & 0x0f;
        const sprite = Array.from(cpu.memory.slice(cpu.i, cpu.i + n));
        console.log(`  >> DRW: I=0x${cpu.i.toString(16)} V[${rx}]=${cpu.registers[rx]} V[${ry}]=${cpu.registers[ry]} n=${n}`);
        console.log(`  >> Sprite data: [${sprite.map(b => `0x${b.toString(16).padStart(2, "0")}`).join(", ")}]`);
      }

      cpu.cycle();

      if (op.startsWith("0xD")) {
        // Check pixel count change after draw
        console.log(`  >> Pixels after draw: ${countPixels(cpu)}`);
      }
    }

    console.log(`\nFinal screen (pixels: ${countPixels(cpu)}):`);
    console.log(dumpScreen(cpu.io.display));
  });

  it("runs game loop with launch key and dumps periodically", () => {
    const bytes = program.toBytes();
    const cpu = makeCpu();
    for (let i = 0; i < bytes.length; i++) cpu.memory[0x200 + i] = bytes[i];

    // Run init
    stepN(cpu, 200);
    dumpCpu(cpu, "After init");
    console.log(`Pixels: ${countPixels(cpu)}`);

    // Run a few main-loop iterations without launching
    // The main loop waits on delay timer. Each frame sets DT=3.
    // The emulator decrements DT every cycle, so 3 cycles clears it.
    // Full frame = ~ 40-50 instructions including all drawing/collision checks
    for (let frame = 0; frame < 3; frame++) {
      stepN(cpu, 100);
    }
    dumpCpu(cpu, "After 3 frames (no launch)");
    console.log(`Pixels: ${countPixels(cpu)}`);

    // Press launch key (5)
    cpu.io.keyDown(5);
    console.log("\n>>> Key 5 pressed (launch) <<<");

    // Run some frames with the key held
    for (let frame = 0; frame < 5; frame++) {
      stepN(cpu, 150);
      const pc = cpu.pc;
      const bx = cpu.registers[2]; // BX = V2
      const by = cpu.registers[3]; // BY = V3
      const launched = cpu.registers[6]; // LAUNCHED = V6
      const px = cpu.registers[7]; // PX = V7
      console.log(`\nFrame ${frame + 1}: PC=0x${pc.toString(16)} PX=${px} BX=${bx} BY=${by} launched=${launched} pixels=${countPixels(cpu)}`);
    }

    cpu.io.keyUp(5);
    dumpCpu(cpu, "After launch + 5 frames");
    console.log(`Pixels: ${countPixels(cpu)}`);
    console.log(dumpScreen(cpu.io.display));

    // Check that ball moved (BY should have changed from its initial position)
    const by = cpu.registers[3];
    console.log(`\nBall Y position: ${by} (initial should be around 26)`);
  });

  it("behavior: ball launches, moves, and hits bricks correctly", () => {
    const bytes = program.toBytes();
    const cpu = makeCpu();
    for (let i = 0; i < bytes.length; i++) cpu.memory[0x200 + i] = bytes[i];

    // Run past init into main loop
    stepN(cpu, 500);

    const launched = cpu.registers[6];
    expect(launched).toBe(0); // not launched yet

    // Press launch key and run enough cycles to reach input handler
    cpu.io.keyDown(5);
    stepN(cpu, 300);
    expect(cpu.registers[6]).toBe(1); // launched!

    const by0 = cpu.registers[3];
    expect(by0).toBeLessThan(27); // ball moved up from y=26

    // Run until ball hits bottom row of bricks or reverses direction
    let prevBy = by0;
    let bounced = false;
    for (let frame = 0; frame < 30; frame++) {
      stepN(cpu, 200);
      const by = cpu.registers[3];
      const bys = cpu.registers[5];
      if (bys === 1 && prevBy < by) {
        bounced = true;
        break;
      }
      prevBy = by;
    }
    expect(bounced).toBe(true);
    expect(cpu.registers[9]).toBeGreaterThanOrEqual(1); // score > 0

    cpu.io.keyUp(5);
  });

  it("behavior: ball moves correctly after launch", () => {
    const bytes = program.toBytes();
    const cpu = makeCpu();
    for (let i = 0; i < bytes.length; i++) cpu.memory[0x200 + i] = bytes[i];

    stepN(cpu, 500);

    const bx0 = cpu.registers[2];
    const by0 = cpu.registers[3];
    expect(cpu.registers[6]).toBe(0); // not launched

    // Launch ball
    cpu.io.keyDown(5);
    stepN(cpu, 300);
    expect(cpu.registers[6]).toBe(1); // launched
    expect(cpu.registers[2]).not.toBe(bx0); // ball moved in X
    expect(cpu.registers[3]).not.toBe(by0); // ball moved in Y

    // Ball should be moving up (BYS=255) initially
    expect(cpu.registers[5]).toBe(255);

    // Run many frames - ball should change direction at some point
    let directionChanged = false;
    let scoreIncreased = false;
    for (let frame = 0; frame < 40; frame++) {
      const beforeBy = cpu.registers[3];
      const beforeBys = cpu.registers[5];
      const beforeSc = cpu.registers[9];
      stepN(cpu, 200);
      const afterBys = cpu.registers[5];
      const afterSc = cpu.registers[9];
      // Check for any Y direction change (brick, wall, or paddle hit)
      if (beforeBys !== afterBys) directionChanged = true;
      if (afterSc > beforeSc) scoreIncreased = true;
    }

    cpu.io.keyUp(5);
    expect(directionChanged).toBe(true); // ball should have bounced off something
    expect(scoreIncreased).toBe(true);   // should have hit at least one brick
  });

  it("traces DRW instructions in main loop to diagnose XOR erase bug", () => {
    const bytes = program.toBytes();
    const cpu = makeCpu();
    for (let i = 0; i < bytes.length; i++) cpu.memory[0x200 + i] = bytes[i];

    // Run init
    stepN(cpu, 200);
    console.log("=== Init done ===");

    // Now we're in the main loop.
    // The main loop order:
    //   1. Input (key skips)
    //   2. Erase ball (DRW)
    //   3. Move ball
    //   4. Wall collisions
    //   5. Paddle collision
    //   6. Brick collision
    //   7. Bottom check
    //   8. Draw ball (DRW)
    //   9. Draw paddle (DRW sprite, DRW sprite)
    //   10. Score
    //   11. Lives
    //   12. Frame timer

    // Run exactly one main loop iteration, tracing DRW instructions
    for (let i = 0; i < 120; i++) {
      const pc = cpu.pc;
      const op = (cpu.memory[pc] << 8) | cpu.memory[pc + 1];

      if ((op & 0xF000) === 0xD000) {
        const rx = (op & 0x0F00) >> 8;
        const ry = (op & 0x00F0) >> 4;
        const n = op & 0x000F;
        const spriteData = Array.from(cpu.memory.slice(cpu.i, cpu.i + n));
        const pixelsBefore = countPixels(cpu);
        const iReg = cpu.i;
        const x = cpu.registers[rx];
        const y = cpu.registers[ry];

        console.log(
          `\n[DRW #${i}] I=0x${iReg.toString(16)} ` +
          `V[${rx}]=${x} V[${ry}]=${y} n=${n} ` +
          `sprite=[${spriteData.map(b => `0x${b.toString(16)}`).join(",")}] ` +
          `pixels_before=${pixelsBefore}`
        );

        cpu.cycle();
        console.log(`  -> pixels_after=${countPixels(cpu)} VF=${cpu.registers[0xf]}`);
      } else {
        cpu.cycle();
      }
    }

    console.log("\n=== After 120 cycles in main loop ===");
    console.log(dumpScreen(cpu.io.display));
    console.log(`Total pixels: ${countPixels(cpu)}`);
    dumpCpu(cpu, "State");
  });
});
