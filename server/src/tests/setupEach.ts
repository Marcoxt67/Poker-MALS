import { beforeEach } from "vitest";
import { resetDb } from "./testUtils";

// The whole suite shares one Realtime Database client (vitest runs it in a
// single process), so the connection must NOT be closed per test file — the
// emulator and the worker are both torn down by globalSetup at the end.
beforeEach(async () => {
  await resetDb();
});
