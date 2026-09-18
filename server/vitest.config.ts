import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      // Points the SDK at the local emulator started in globalSetup, so the
      // suite never touches the real Firebase project.
      FIREBASE_DATABASE_EMULATOR_HOST: "127.0.0.1:9000",
      FIREBASE_DATABASE_URL: "https://poker-test-default-rtdb.firebaseio.com",
      FIREBASE_PROJECT_ID: "poker-test",
      JWT_SECRET: "test-secret-key-for-vitest",
      JWT_EXPIRES_IN: "1h",
      PORT: "4001",
      CORS_ORIGIN: "http://localhost:5173",
      DEFAULT_USER_CHIPS: "1000",
    },
    globalSetup: ["./src/tests/globalSetup.ts"],
    setupFiles: ["./src/tests/setupEach.ts"],
    testTimeout: 20000,
    hookTimeout: 30000,
    pool: "forks",
    // One process, one module graph: the suite then shares a single Realtime
    // Database client instead of opening a new socket per test file.
    isolate: false,
    poolOptions: { forks: { singleFork: true } },
  },
});
