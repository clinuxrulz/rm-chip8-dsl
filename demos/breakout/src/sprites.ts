import { label, db } from "@random-mesh/rm-chip8-dsl";

export const ballSprite = label("ball");
export const paddleSprite = label("paddle");
export const brickSprite = label("brick");
export const heartSprite = label("heart");

export function emitSprites(): void {
  ballSprite.here();
  db(0b11000000, 0b11000000);

  paddleSprite.here();
  db(0b11111111);

  brickSprite.here();
  db(0xFF, 0xFF, 0xFF, 0xFF);

  heartSprite.here();
  db(0b01100000, 0b11110000, 0b01100000);
}
