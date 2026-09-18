import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    env: {
      DATABASE_URL: "file:./test.db",
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
    poolOptions: { forks: { singleFork: true } },
  },
});
