import path from "path";
import { spawn, ChildProcess } from "child_process";

/**
 * Boots a local Realtime Database emulator for the suite so tests never touch
 * the real Firebase project.
 */

const EMULATOR_PORT = 9000;
const repoRoot = path.resolve(__dirname, "../../..");

const waitForEmulator = async (timeoutMs = 90_000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${EMULATOR_PORT}/.json?ns=poker-test`);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("O emulador do Realtime Database não subiu a tempo.");
};

export default async function setup() {
  const emulator: ChildProcess = spawn(
    "npx",
    ["firebase", "emulators:start", "--only", "database", "--project", "poker-test"],
    { cwd: repoRoot, stdio: "ignore", detached: true },
  );

  await waitForEmulator();

  return async () => {
    if (emulator.pid) {
      try {
        process.kill(-emulator.pid, "SIGKILL");
      } catch {
        emulator.kill("SIGKILL");
      }
    }
  };
}
