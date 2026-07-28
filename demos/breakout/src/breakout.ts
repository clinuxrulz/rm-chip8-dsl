import {
  chip8, cls, ldV, v, label, jp, ret, seV, sneV, seR, sneR,
  addV, ldR, ldI, drw, skp, sknp, ldVDt, ldDtV, ldStV, ldVK,
  db, if_, fn_, addI, bcd, ldSprite, ldIVx, ldVxI,
} from "@random-mesh/rm-chip8-dsl";
import { emitSprites, ballSprite, paddleSprite, brickSprite, heartSprite } from "./sprites.js";
import {
  T0, T1, BX, BY, BXS, BYS, LAUNCHED,
  PX, OPX, SC, LI, PY,
  BC, BD, BE,
  PADDLE_Y, PADDLE_W, PADDLE_H,
  BALL_W, BALL_H, BRICK_W, BRICK_H,
  BRICK_COLS, BRICK_ROWS, BRICK_TOP,
  INITIAL_LIVES, KEY_LEFT, KEY_RIGHT, KEY_LAUNCH,
} from "./registers.js";

const progStart = label("progStart");
const mainLoop = label("mainLoop");
const bcdBuf = label("bcdBuf");
const brickState = label("brickState");
const bitmaskTbl = label("bitmaskTbl");

export const program = chip8(() => {
  // ==================== DATA SECTION ====================
  jp(progStart);
  emitSprites();
  bcdBuf.here();
  db(0, 0, 0);
  brickState.here();
  db(0xFF, 0xFF, 0xFF, 0xFF);
  bitmaskTbl.here();
  db(0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80);

  // ==================== INIT ====================
  progStart.here();
  cls();

  // Reset brick state to all alive (for game-over restart)
  // Use two ldIVx calls with explicit I reset for I-quirk safety
  // (some emulators increment I after ldIVx/ldVxI)
  ldV(v(T0), 0xFF);
  ldR(v(T1), v(T0));
  ldI(brickState);
  ldIVx(v(T1));
  ldI(brickState);
  ldV(v(BC), 2);
  addI(v(BC));
  ldIVx(v(T1));

  ldV(v(PX), 26);
  ldR(v(OPX), v(PX));
  ldV(v(PY), PADDLE_Y);
  ldV(v(SC), 0);
  ldV(v(LI), INITIAL_LIVES);
  ldV(v(LAUNCHED), 0);
  ldV(v(BXS), 1);
  ldV(v(BYS), 255);
  ldR(v(BX), v(PX));
  addV(v(BX), (PADDLE_W - BALL_W) / 2);
  ldV(v(BY), PADDLE_Y - BALL_H);

  // Draw initial bricks
  drawAllBricks();

  // Draw initial paddle, ball, score, and lives
  ldI(paddleSprite);
  drw(v(PX), v(PY), PADDLE_H);
  ldI(ballSprite);
  drw(v(BX), v(BY), BALL_H);
  drawScore();
  drawLives();

  // ==================== MAIN LOOP ====================
  mainLoop.here();

  // ── 1. Input ──
  // Key 4 = left
  inputLeft();
  // Key 6 = right
  inputRight();
  // Key 5 = launch
  inputLaunch();

  // ── 2. Erase ball ──
  ldI(ballSprite);
  drw(v(BX), v(BY), BALL_H);

  // ── 3. Move ball ──
  if_(v(LAUNCHED), () => {
    v(BX).add(v(BXS));
    v(BY).add(v(BYS));
  });

  // ── 4. Wall collisions ──
  wallCollisions();

  // ── 5. Paddle collision ──
  paddleCollision();

  // ── 6. Brick collision ──
  brickCollision();

  // ── 7. Bottom / lose life ──
  checkBottom();

  // ── 8. Draw ball ──
  ldI(ballSprite);
  drw(v(BX), v(BY), BALL_H);

  // ── 9. Draw paddle ──
  ldI(paddleSprite);
  drw(v(OPX), v(PY), PADDLE_H);
  ldI(paddleSprite);
  drw(v(PX), v(PY), PADDLE_H);
  ldR(v(OPX), v(PX));

  // ── 10. Score display ──
  drawScore();

  // ── 11. Lives display ──
  drawLives();

  // ── 12. Frame timer ──
  ldV(v(BC), 3);
  ldDtV(v(BC));
  const frameTimer = label("frameTimer");
  frameTimer.here();
  ldVDt(v(BC));
  if_(v(BC), () => jp(frameTimer));

  // ── 13. Loop ──
  jp(mainLoop);
});

// ==================== SUBROUTINES ====================

function inputLeft(): void {
  const k = label("kL");
  const no = label("noLeft");
  const ballNo = label("ballNoL");
  ldV(v(BC), KEY_LEFT);
  skp(v(BC));
  jp(no);
  if_(v(PX), () => {
    addV(v(PX), 255);
    seV(v(LAUNCHED), 0);
    jp(ballNo);
    addV(v(BX), 255);
    ballNo.here();
  });
  no.here();
}

function inputRight(): void {
  const k = label("kR");
  const no = label("noRight");
  const ballNo = label("ballNoR");
  ldV(v(BC), KEY_RIGHT);
  skp(v(BC));
  jp(no);
  ldV(v(BC), 63 - PADDLE_W);
  v(BC).sub(v(PX));
  if_(v(BC), () => {
    addV(v(PX), 1);
    seV(v(LAUNCHED), 0);
    jp(ballNo);
    addV(v(BX), 1);
    ballNo.here();
  });
  no.here();
}

function inputLaunch(): void {
  const no = label("noLaunch");
  const already = label("already");
  ldV(v(BC), KEY_LAUNCH);
  skp(v(BC));
  jp(no);
  seV(v(LAUNCHED), 0);
  jp(already);
  ldV(v(LAUNCHED), 1);
  ldV(v(BYS), 255);
  ldV(v(BXS), 1);
  already.here();
  no.here();
}

function wallCollisions(): void {
  // Right wall
  const rc = label("rc");
  const lc = label("lc");
  const tc = label("tc");
  seV(v(BX), 63);
  jp(rc);
  ldV(v(BX), 62);
  ldV(v(BXS), 255);
  rc.here();
  // Left wall
  seV(v(BX), 255);
  jp(lc);
  ldV(v(BX), 0);
  ldV(v(BXS), 1);
  lc.here();
  // Top wall
  seV(v(BY), 255);
  jp(tc);
  ldV(v(BY), 0);
  ldV(v(BYS), 1);
  tc.here();
}

function paddleCollision(): void {
  const n1 = label("pcn1");
  const n2 = label("pcn2");
  const n3 = label("pcn3");
  const n4 = label("pcn4");

  // Y: ball bottom >= paddle top?
  ldR(v(BC), v(BY));
  addV(v(BC), BALL_H);
  v(BC).sub(v(PY));
  if_(v(0xF), () => {
    // Y: ball top <= paddle bottom?
    ldR(v(BC), v(PY));
    addV(v(BC), PADDLE_H);
    v(BC).sub(v(BY));
    if_(v(0xF), () => {
      // X: ball right > paddle left?
      ldR(v(BC), v(BX));
      addV(v(BC), BALL_W);
      v(BC).sub(v(PX));
      if_(v(0xF), () => {
        // X: ball left < paddle right?
        ldR(v(BC), v(PX));
        addV(v(BC), PADDLE_W);
        v(BC).sub(v(BX));
        if_(v(0xF), () => {
          // Paddle hit — reverse Y, sound
          ldV(v(BC), 0);
          v(BC).sub(v(BYS));
          ldR(v(BYS), v(BC));
          ldV(v(BC), 5);
          ldStV(v(BC));
        });
      });
    });
  });
}

function brickCollision(): void {
  const outside = label("brickOut");
  const noBrick = label("noBrick");
  const brickOk = label("brickOk");

  if_(v(LAUNCHED), () => {
    // Calculate grid_row from ball center
    ldR(v(BC), v(BY));
    addV(v(BC), 1);
    ldV(v(BD), BRICK_TOP);
    v(BC).sub(v(BD));
    // VF = ball_y + 1 >= BRICK_TOP
    if_(v(0xF), () => {
      // Now BC = ball_y + 1 - BRICK_TOP
      // Check BC < BRICK_ROWS * BRICK_H
      ldV(v(BD), BRICK_ROWS * BRICK_H);
      v(BD).sub(v(BC));
      if_(v(0xF), () => {
        // In brick zone — calculate grid_row = BC / 4
        v(BC).shr();
        v(BC).shr();

        // grid_col = (ball_x + 1) / 8
        ldR(v(BD), v(BX));
        addV(v(BD), 1);
        v(BD).shr();
        v(BD).shr();
        v(BD).shr();

        // Load brick state byte: brickState[row]
        ldI(brickState);
        addI(v(BC));
        ldVxI(v(T0));
        ldR(v(BE), v(T0));

        // Load bitmask for col
        ldI(bitmaskTbl);
        addI(v(BD));
        ldVxI(v(T0));

        // Check bit: byte AND bitmask
        ldR(v(T1), v(BE));
        v(T1).and(v(T0));
        if_(v(T1), () => {
          // Brick alive — destroy it
          // Reverse Y
          ldV(v(T0), 0);
          v(T0).sub(v(BYS));
          ldR(v(BYS), v(T0));

          // Erase sprite at brick position
          // brick_x = grid_col * 8
          ldR(v(T0), v(BD));
          v(T0).shl();
          v(T0).shl();
          v(T0).shl();
          // brick_y = BRICK_TOP + grid_row * 4
          ldR(v(T1), v(BC));
          v(T1).shl();
          v(T1).shl();
          addV(v(T1), BRICK_TOP);

          ldI(brickSprite);
          drw(v(T0), v(T1), BRICK_H);

          // Clear brick state bit
          // Load brick state byte again
          ldI(brickState);
          addI(v(BC));
          ldVxI(v(T0));
          ldR(v(T1), v(T0));

          // Load bitmask again
          ldI(bitmaskTbl);
          addI(v(BD));
          ldVxI(v(T0));

          // byte = byte AND NOT bitmask
          ldV(v(BE), 255);
          v(BE).xor(v(T0));
          v(T1).and(v(BE));

          // Store back
          ldR(v(T0), v(T1));
          ldI(brickState);
          addI(v(BC));
          ldIVx(v(T0));

          // Score + sound
          addV(v(SC), 1);
          ldV(v(T0), 3);
          ldStV(v(T0));
        });
      });
    });
  });
}

function checkBottom(): void {
  const skip = label("skipBottom");
  const resetWait = label("resetWait");

  ldV(v(BC), 32);
  v(BC).sub(v(BY));
  if_(v(0xF), () => jp(skip));

  // BY > 31 → lose life
  addV(v(LI), 255);
  ldV(v(LAUNCHED), 0);

  if_(v(LI), () => {
    // Reset ball on paddle
    resetBall();
    // Brief wait
    ldV(v(BC), 15);
    ldDtV(v(BC));
    resetWait.here();
    ldVDt(v(BC));
    if_(v(BC), () => jp(resetWait));
  });

  // Game over if LI == 0
  sneV(v(LI), 0);
  jp(skip);
  ldVK(v(T0));
  jp(progStart);

  skip.here();
}

function drawScore(): void {
  const labelBase = label("dsBase");
  ldI(bcdBuf);
  bcd(v(SC));

  // Hundreds
  ldVxI(v(T0));
  ldSprite(v(T0));
  ldV(v(BC), 0);
  ldV(v(BD), 0);
  drw(v(BC), v(BD), 5);

  // Tens
  ldV(v(T0), 1);
  ldI(bcdBuf);
  addI(v(T0));
  ldVxI(v(T0));
  ldSprite(v(T0));
  ldV(v(BC), 5);
  ldV(v(BD), 0);
  drw(v(BC), v(BD), 5);

  // Ones
  ldV(v(T0), 2);
  ldI(bcdBuf);
  addI(v(T0));
  ldVxI(v(T0));
  ldSprite(v(T0));
  ldV(v(BC), 10);
  ldV(v(BD), 0);
  drw(v(BC), v(BD), 5);

  // Label for "SCORE" text at top
  labelBase.here();
}

function drawLives(): void {
  const loopLbl = label("livesLoop");
  const skip = label("livesSkip");

  ldV(v(BC), 0);
  loopLbl.here();
  ldR(v(BD), v(LI));
  v(BD).sub(v(BC));
  if_(v(0xF), () => {
    // Draw heart for this life
    ldI(heartSprite);
    ldV(v(BD), 56);
    ldR(v(BE), v(BC));
    v(BE).shl();
    v(BD).add(v(BE));
    ldV(v(BE), 0);
    drw(v(BD), v(BE), 3);
    addV(v(BC), 1);
    jp(loopLbl);
  });
}

function resetBall(): void {
  ldR(v(BX), v(PX));
  addV(v(BX), (PADDLE_W - BALL_W) / 2);
  ldV(v(BY), PADDLE_Y - BALL_H);
  ldV(v(BXS), 1);
  ldV(v(BYS), 255);
  ldV(v(LAUNCHED), 0);
}

function drawAllBricks(): void {
  const rowDone = label("dabRowDone");
  const colDone = label("dabColDone");
  const rowLbl = label("dabRow");

  ldV(v(BC), 0);
  rowLbl.here();
  sneV(v(BC), BRICK_ROWS);
  jp(rowDone);
  ldV(v(BD), 0);
  const colLbl = label("dabCol");
  colLbl.here();
  sneV(v(BD), BRICK_COLS);
  jp(colDone);
  // Draw brick at (col * 8, BRICK_TOP + row * 4)
  ldR(v(T0), v(BD));
  v(T0).shl();
  v(T0).shl();
  v(T0).shl();
  ldR(v(T1), v(BC));
  v(T1).shl();
  v(T1).shl();
  addV(v(T1), BRICK_TOP);
  ldI(brickSprite);
  drw(v(T0), v(T1), BRICK_H);
  addV(v(BD), 1);
  jp(colLbl);
  colDone.here();
  addV(v(BC), 1);
  jp(rowLbl);
  rowDone.here();
}
