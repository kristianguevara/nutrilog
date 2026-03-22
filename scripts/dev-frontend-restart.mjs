#!/usr/bin/env node
/**
 * Runs the Vite dev server (via pnpm workspace filter) and restarts if it exits with an error.
 * Clean exit (code 0) or SIGINT/SIGTERM (Ctrl+C) does not restart.
 * Run from the repository root.
 *
 * Usage: node scripts/dev-frontend-restart.mjs [extra args forwarded to pnpm ...]
 * Default: pnpm --filter @nutrilog/web dev
 */
import { spawn } from "node:child_process";
import process from "node:process";

const fromCli = process.argv.slice(2);
const pnpmArgs = fromCli.length > 0 ? fromCli : ["--filter", "@nutrilog/web", "dev"];

function run() {
  const child = spawn("pnpm", pnpmArgs, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (err) => {
    console.error("\n[dev] Failed to spawn pnpm:", err.message);
    console.error("[dev] Restarting in 2s…\n");
    setTimeout(run, 2000);
  });

  child.on("exit", (code, signal) => {
    if (signal === "SIGINT" || signal === "SIGTERM") {
      process.exit(code ?? 0);
    }
    if (code === 130) {
      process.exit(0);
    }
    if (code === 0 || code === null) {
      process.exit(0);
    }
    console.error(`\n[dev] pnpm exited with code ${code}. Restarting in 2s…\n`);
    setTimeout(run, 2000);
  });
}

run();
