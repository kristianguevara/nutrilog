#!/usr/bin/env node
/**
 * Runs `vercel dev` and restarts it if the process exits with an error.
 * Clean exit (code 0) or SIGINT/SIGTERM (Ctrl+C) does not restart.
 * Usage: node scripts/dev-api-restart.mjs [args passed to vercel]
 * Default: vercel dev --listen 5173
 */
import { spawn } from "node:child_process";
import process from "node:process";

const fromCli = process.argv.slice(2);
const vercelArgs = fromCli.length > 0 ? fromCli : ["dev", "--listen", "5173"];

function run() {
  const child = spawn("vercel", vercelArgs, {
    stdio: "inherit",
    env: process.env,
  });

  child.on("error", (err) => {
    console.error("\n[dev:api] Failed to spawn vercel:", err.message);
    console.error("[dev:api] Restarting in 2s…\n");
    setTimeout(run, 2000);
  });

  child.on("exit", (code, signal) => {
    if (signal === "SIGINT" || signal === "SIGTERM") {
      process.exit(code ?? 0);
    }
    // Common exit code when child is stopped with Ctrl+C (Unix)
    if (code === 130) {
      process.exit(0);
    }
    if (code === 0 || code === null) {
      process.exit(0);
    }
    console.error(`\n[dev:api] vercel exited with code ${code}. Restarting in 2s…\n`);
    setTimeout(run, 2000);
  });
}

run();
