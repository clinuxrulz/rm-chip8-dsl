import { writeFileSync, mkdirSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { program } from "./breakout.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(__dirname, "..", "dist");
const outFile = resolve(outDir, "breakout.ch8");

mkdirSync(outDir, { recursive: true });
writeFileSync(outFile, program.toBinary());

console.log(`Wrote ${program.toBytes().length} bytes to ${outFile}`);
