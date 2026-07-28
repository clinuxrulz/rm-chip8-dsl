import { describe, it, expect, beforeEach } from "vitest";
import {
  chip8, u8, v, label,
  cls, ret, jp, call,
  seV, sneV, seR, sneR,
  ldV, addV, ldR,
  ldI, jpV0, rnd, drw,
  skp, sknp,
  ldVDt, ldVK, ldDtV, ldStV,
  addI, ldSprite, bcd, ldIVx, ldVxI,
  db,
  if_, If, while_, break_, continue_,
  fn_,
  clearRegistry, isNode,
} from "../src/chip8";

beforeEach(() => {
  clearRegistry();
});

describe("Literals", () => {
  it("u8 literal", () => {
    const p = chip8(() => { ldV(v(0), 0x42); });
    expect(p.toBytes()).toEqual([0x60, 0x42]);
  });

  it("u8 literal via u8()", () => {
    const p = chip8(() => { ldV(v(0), u8(0xFF)); });
    expect(p.toBytes()).toEqual([0x60, 0xFF]);
  });

  it("addr via direct number to ldI", () => {
    const p = chip8(() => { ldI(0xABC); });
    expect(p.toBytes()).toEqual([0xAA, 0xBC]);
  });
});

describe("Registers", () => {
  it("v() returns a node", () => {
    expect(isNode(v(5))).toBe(true);
  });

  it("v() works with all register indices", () => {
    for (let i = 0; i < 16; i++) {
      const p = chip8(() => ldV(v(i as any), 0x01));
      expect(p.toBytes()[0]).toBe(0x60 | i);
    }
  });

  it("v() accepts a plain number for convenience", () => {
    const p = chip8(() => addV(7, 0x01));
    expect(p.toBytes()).toEqual([0x77, 0x01]);
  });
});

describe("Labels", () => {
  it("label resolves to correct address", () => {
    const p = chip8(() => {
      const lbl = label("start");
      lbl.here();
      ldV(v(0), 0x01);
      ldV(v(1), 0x02);
      jp(lbl);
    });
    const bytes = p.toBytes();
    expect(bytes[4]).toBe(0x12);
    expect(bytes[5]).toBe(0x00);
  });

  it("label after instructions resolves correctly", () => {
    const lbl = label("end");
    const p = chip8(() => {
      ldV(v(0), 0x01);
      ldV(v(1), 0x02);
      lbl.here();
      jp(lbl);
    });
    const bytes = p.toBytes();
    expect(bytes[4]).toBe(0x12);
    expect(bytes[5]).toBe(0x04);
  });

  it("forward label reference works", () => {
    const p = chip8(() => {
      const loop = label("loop");
      jp(loop);
      ldV(v(0), 0x00);
      loop.here();
    });
    expect(p.toBytes()[0]).toBe(0x12);
    expect(p.toBytes()[1]).toBe(0x04);
  });

  it("double here() throws", () => {
    expect(() => {
      chip8(() => {
        const lbl = label("x");
        lbl.here();
        lbl.here();
      });
    }).toThrow("already emitted");
  });
});

describe("All instructions (standalone)", () => {
  const cases: [string, () => void, number, number][] = [
    ["cls", () => cls(), 0x00, 0xE0],
    ["ret", () => ret(), 0x00, 0xEE],
    ["jp", () => jp(0x345), 0x13, 0x45],
    ["call", () => call(0x789), 0x27, 0x89],
    ["seV", () => seV(v(0xA), 0x42), 0x3A, 0x42],
    ["sneV", () => sneV(v(3), 0xAB), 0x43, 0xAB],
    ["seR", () => seR(v(1), v(2)), 0x51, 0x20],
    ["sneR", () => sneR(v(4), v(7)), 0x94, 0x70],
    ["ldV", () => ldV(v(0xF), 0x7B), 0x6F, 0x7B],
    ["addV", () => addV(v(7), 0x1F), 0x77, 0x1F],
    ["ldR", () => ldR(v(0), v(0xF)), 0x80, 0xF0],
    ["ldI", () => ldI(0xABC), 0xAA, 0xBC],
    ["jpV0", () => jpV0(0x321), 0xB3, 0x21],
    ["rnd", () => rnd(v(0xC), 0x7F), 0xCC, 0x7F],
    ["drw", () => drw(v(0), v(1), 0x8), 0xD0, 0x18],
    ["skp", () => skp(v(2)), 0xE2, 0x9E],
    ["sknp", () => sknp(v(3)), 0xE3, 0xA1],
    ["ldVDt", () => ldVDt(v(4)), 0xF4, 0x07],
    ["ldVK", () => ldVK(v(5)), 0xF5, 0x0A],
    ["ldDtV", () => ldDtV(v(6)), 0xF6, 0x15],
    ["ldStV", () => ldStV(v(7)), 0xF7, 0x18],
    ["addI", () => addI(v(8)), 0xF8, 0x1E],
    ["ldSprite", () => ldSprite(v(9)), 0xF9, 0x29],
    ["bcd", () => bcd(v(0xA)), 0xFA, 0x33],
    ["ldIVx", () => ldIVx(v(0xB)), 0xFB, 0x55],
    ["ldVxI", () => ldVxI(v(0xC)), 0xFC, 0x65],
  ];

  for (const [name, build, b1, b2] of cases) {
    it(`${name} : ${b1.toString(16).toUpperCase()}${b2.toString(16).toUpperCase()}`, () => {
      expect(chip8(build).toBytes()).toEqual([b1, b2]);
    });
  }
});

describe("VReg expression chaining", () => {
  const cases: [string, () => void, number, number][] = [
    ["ld (8XY0)", () => v(0).ld(v(1)), 0x80, 0x10],
    ["or (8XY1)", () => v(0).or(v(1)), 0x80, 0x11],
    ["and (8XY2)", () => v(0xA).and(v(0xB)), 0x8A, 0xB2],
    ["xor (8XY3)", () => v(3).xor(v(4)), 0x83, 0x43],
    ["add (8XY4)", () => v(1).add(v(2)), 0x81, 0x24],
    ["sub (8XY5)", () => v(0xF).sub(v(0xE)), 0x8F, 0xE5],
    ["shr (8XY6)", () => v(0).shr(), 0x80, 0x06],
    ["subn (8XY7)", () => v(2).subn(v(3)), 0x82, 0x37],
    ["shl (8XYE)", () => v(0).shl(), 0x80, 0x0E],
  ];

  for (const [name, build, b1, b2] of cases) {
    it(name, () => {
      expect(chip8(build).toBytes()).toEqual([b1, b2]);
    });
  }

  it("chaining multiple ops", () => {
    const p = chip8(() => v(0).ld(v(1)).add(v(2)).and(v(3)));
    expect(p.toBytes()).toEqual([0x80, 0x10, 0x80, 0x24, 0x80, 0x32]);
  });

  it("chaining with standalone functions interleaved", () => {
    const p = chip8(() => {
      ldV(v(0), 0x0A);
      v(0).add(v(1));
      ldV(v(2), 0xFF);
    });
    expect(p.toBytes()).toEqual([0x60, 0x0A, 0x80, 0x14, 0x62, 0xFF]);
  });
});

describe("Data directive (db)", () => {
  it("embeds raw bytes", () => {
    expect(chip8(() => db(0xF0, 0x90, 0xF0, 0x90, 0x90)).toBytes())
      .toEqual([0xF0, 0x90, 0xF0, 0x90, 0x90]);
  });

  it("db label usable as ldI target", () => {
    const p = chip8(() => {
      const sprite = db(0xF0, 0x90);
      ldI(sprite);
    });
    expect(p.toBytes()).toEqual([0xF0, 0x90, 0xA2, 0x00]);
  });

  it("db with drw and instructions", () => {
    const p = chip8(() => {
      const spr = db(0x3C, 0x7E, 0xFF);
      ldV(v(0), 10);
      ldV(v(1), 10);
      ldI(spr);
      drw(v(0), v(1), 3);
    });
    expect(p.toBytes()).toEqual([
      0x3C, 0x7E, 0xFF,
      0x60, 0x0A, 0x61, 0x0A,
      0xA2, 0x00, 0xD0, 0x13,
    ]);
  });
});

describe("if_ control flow", () => {
  it("if_ emits sneV + jp + body + end label", () => {
    const p = chip8(() => {
      if_(v(0), () => { ldV(v(1), 0x01); });
    });
    const bytes = p.toBytes();
    expect(bytes.length).toBe(6);
    expect(bytes[0]).toBe(0x40);
    expect(bytes[1]).toBe(0x00);
    expect(bytes[2]).toBe(0x12);
    expect(bytes[3]).toBe(0x06);
    expect(bytes[4]).toBe(0x61);
    expect(bytes[5]).toBe(0x01);
  });

  it("If alias works the same", () => {
    const p = chip8(() => {
      If(v(0), () => { ldV(v(1), 0x01); });
    });
    expect(p.toBytes().length).toBe(6);
  });
});

describe("while_ loop", () => {
  it("while_ with condition decrement", () => {
    const p = chip8(() => {
      ldV(v(0), 5);
      while_(v(0), () => {
        addV(v(0), 255);  // decrement (wraps around)
      });
    });
    // ldV (2) + while: seV+jp+addV+jp (4 instr × 2 = 8) = 10 bytes
    expect(p.toBytes().length).toBe(10);
  });

  it("break_ exits early", () => {
    const p = chip8(() => {
      ldV(v(0), 10);
      while_(v(0), () => {
        if_(v(1), () => { break_; });
        addV(v(0), 255);  // decrement
      });
    });
    expect(p.toBytes().length).toBeGreaterThan(4);
  });

  it("continue_ jumps back to condition check", () => {
    const p = chip8(() => {
      ldV(v(0), 10);
      while_(v(0), () => {
        addV(v(0), 255);  // decrement
        if_(v(0), () => { continue_(); });
        ldV(v(1), 0xFF);
      });
    });
    expect(p.toBytes().length).toBeGreaterThan(4);
  });

  it("nested while_ loops", () => {
    const p = chip8(() => {
      ldV(v(0), 3);
      while_(v(0), () => {
        ldV(v(1), 3);
        while_(v(1), () => {
          addV(v(1), 255);  // decrement
          if_(v(1), () => { break_(); });
        });
        addV(v(0), 255);  // decrement
      });
    });
    expect(p.toBytes().length).toBeGreaterThan(4);
  });

  it("break_ outside while_ throws", () => {
    expect(() => {
      chip8(() => { break_(); });
    }).toThrow("outside of while_");
  });

  it("continue_ outside while_ throws", () => {
    expect(() => {
      chip8(() => { continue_(); });
    }).toThrow("outside of while_");
  });
});

describe("fn_ subroutines", () => {
  it("fn_ defines a subroutine and emits call", () => {
    const myFunc = fn_("myFunc", () => {
      ldV(v(0), 0xFF);
      ret();
    });

    const p = chip8(() => {
      cls();
      myFunc();
      ldV(v(1), 0);
    });

    const bytes = p.toBytes();
    // main: cls (00E0) at 0x200, call myFunc at 0x202, ldV V1,0 at 0x204
    // func at 0x206: ldV V0,FF (60FF), ret (00EE)
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0xE0);
    // call myFunc (0x206) → 0x22 0x06
    expect(bytes[2]).toBe(0x22);
    expect(bytes[3]).toBe(0x06);
    // func body
    expect(bytes[6]).toBe(0x60);
    expect(bytes[7]).toBe(0xFF);
    expect(bytes[8]).toBe(0x00);
    expect(bytes[9]).toBe(0xEE);
  });

  it("fn_ can call another fn_ defined before it", () => {
    // inner must be defined before outer (no forward refs)
    const inner = fn_("inner", () => {
      ldV(v(1), 0x01);
      ret();
    });

    const outer = fn_("outer", () => {
      inner();
      ret();
    });

    const p = chip8(() => {
      cls();
      outer();
    });

    const bytes = p.toBytes();
    // main: cls (2), call outer (2) = 4 bytes starting at 0x200
    // inner (registered first) at 0x204: ldV V1,1, ret = 4 bytes
    // outer at 0x208: call inner, ret = 4 bytes
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0xE0);
    // call outer (at 0x208) → 0x22 0x08
    expect(bytes[2]).toBe(0x22);
    expect(bytes[3]).toBe(0x08);
    // inner body: ldV V1,1, ret
    expect(bytes[4]).toBe(0x61);
    expect(bytes[5]).toBe(0x01);
    expect(bytes[6]).toBe(0x00);
    expect(bytes[7]).toBe(0xEE);
    // outer body: call inner (at 0x204) → 0x22 0x04, ret
    expect(bytes[8]).toBe(0x22);
    expect(bytes[9]).toBe(0x04);
    expect(bytes[10]).toBe(0x00);
    expect(bytes[11]).toBe(0xEE);
  });

  it("fn_ used for drawing sprite", () => {
    const spriteData = label("sprite_data");

    const drawSprite = fn_("drawSprite", () => {
      ldI(spriteData);
      drw(v(0), v(1), 8);
      ret();
    });

    const p = chip8(() => {
      ldV(v(0), 10);
      ldV(v(1), 10);
      drawSprite();
      spriteData.here();
      db(0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C);
    });

    const bytes = p.toBytes();
    // main: ldV V0,10 (60 0A) at 0x200, ldV V1,10 (61 0A) at 0x202, call drawSprite at 0x204
    // drawSprite at 0x206: ldI sprite, drw, ret
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("fn_ forward call (defined after caller)", () => {
    const outer = fn_("outer", () => {
      inner();
      ret();
    });

    const inner = fn_("inner", () => {
      ldV(v(1), 0x01);
      ret();
    });

    const p = chip8(() => {
      cls();
      outer();
    });

    const bytes = p.toBytes();
    // main: cls (2) + call outer (2) = 4 bytes starting at 0x200
    // outer (registered first) at 0x204: call inner, ret = 4 bytes
    // inner (registered second) at 0x208: ldV V1,1, ret = 4 bytes
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0xE0);
    expect(bytes[2]).toBe(0x22);
    expect(bytes[3]).toBe(0x04);
    expect(bytes[4]).toBe(0x22);
    expect(bytes[5]).toBe(0x08);
    expect(bytes[6]).toBe(0x00);
    expect(bytes[7]).toBe(0xEE);
    expect(bytes[8]).toBe(0x61);
    expect(bytes[9]).toBe(0x01);
    expect(bytes[10]).toBe(0x00);
    expect(bytes[11]).toBe(0xEE);
  });

  it("mutual recursion between two functions", () => {
    const fnA = fn_("fnA", () => {
      fnB();
      ret();
    });

    const fnB = fn_("fnB", () => {
      fnA();
      ret();
    });

    const p = chip8(() => {
      fnA();
    });

    const bytes = p.toBytes();
    // main: call fnA at 0x200
    // fnA (first) at 0x202: call fnB, ret = 4 bytes
    // fnB (second) at 0x206: call fnA, ret = 4 bytes
    expect(bytes[0]).toBe(0x22);
    expect(bytes[1]).toBe(0x02);
    expect(bytes[2]).toBe(0x22);
    expect(bytes[3]).toBe(0x06);
    expect(bytes[4]).toBe(0x00);
    expect(bytes[5]).toBe(0xEE);
    expect(bytes[6]).toBe(0x22);
    expect(bytes[7]).toBe(0x02);
    expect(bytes[8]).toBe(0x00);
    expect(bytes[9]).toBe(0xEE);
  });
});

describe("Full program compilation", () => {
  it("draw sprite with infinite loop", () => {
    const loop = label("loop");
    const spriteData = label("sprite_data");

    const p = chip8(() => {
      cls();
      ldV(v(0), 10);
      ldV(v(1), 10);

      loop.here();
      ldI(spriteData);
      drw(v(0), v(1), 8);
      addV(v(0), 8);
      jp(loop);

      spriteData.here();
      db(0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C);
    });

    const bytes = p.toBytes();
    expect(bytes[0]).toBe(0x00);
    expect(bytes[1]).toBe(0xE0);
  });

  it("toBinary returns Uint8Array", () => {
    expect(chip8(() => cls()).toBinary()).toBeInstanceOf(Uint8Array);
  });

  it("toHexString returns formatted hex pairs", () => {
    expect(chip8(() => { cls(); ret(); }).toHexString()).toBe("00e0 00ee");
  });

  it("multiple instructions produce correct length", () => {
    const p = chip8(() => {
      cls();
      ret();
      ldV(v(0), 0xFF);
      jp(0x200);
    });
    expect(p.toBytes().length).toBe(8);
  });
});

describe("Edge cases and errors", () => {
  it("all registers V0-VF work with ldV", () => {
    for (let r = 0; r < 16; r++) {
      const p = chip8(() => ldV(r as any, r * 15 + 1));
      expect(p.toBytes()[0]).toBe(0x60 | r);
    }
  });

  it("drw with n=0", () => {
    expect(chip8(() => drw(v(0), v(1), 0)).toBytes()).toEqual([0xD0, 0x10]);
  });

  it("drw with n=15", () => {
    expect(chip8(() => drw(v(0), v(1), 15)).toBytes()).toEqual([0xD0, 0x1F]);
  });

  it("call + ret", () => {
    expect(chip8(() => { call(0x300); ret(); }).toBytes()).toEqual([0x23, 0x00, 0x00, 0xEE]);
  });

  it("usage outside chip8() throws", () => {
    expect(() => {
      const lbl = label("x");
      lbl.here();
    }).toThrow("outside of a chip8");
  });

  it("vreg ops outside chip8() throws", () => {
    expect(() => v(0).add(v(1))).toThrow("outside of a chip8");
  });

  it("standalone instr outside chip8() throws", () => {
    expect(() => cls()).toThrow("outside of a chip8");
  });
});
