/**
 * Usage: npm run hash-password
 * Prompts for a password and prints the ADMIN_PASSWORD_HASH line for .env.
 */
import { createInterface } from "node:readline";
import { Writable } from "node:stream";
import { hashPassword } from "../src/lib/password";

const muted = new Writable({ write: (_chunk, _enc, cb) => cb() });
const rl = createInterface({ input: process.stdin, output: muted, terminal: true });

process.stdout.write("Password: ");
rl.question("", async (password) => {
  rl.close();
  process.stdout.write("\n");
  if (password.length < 12) {
    console.error("Use at least 12 characters.");
    process.exit(1);
  }
  console.log(`\nADMIN_PASSWORD_HASH=${await hashPassword(password)}\n`);
});
