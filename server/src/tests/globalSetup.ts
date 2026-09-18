import path from "path";
import { execSync } from "child_process";
import fs from "fs";

export default async function setup() {
  const schemaPath = path.resolve(__dirname, "../../../prisma/schema.prisma");
  const testDbPath = path.resolve(__dirname, "../../../prisma/test.db");

  if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);

  execSync(`npx prisma db push --schema "${schemaPath}" --skip-generate --accept-data-loss`, {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: "file:./test.db" },
  });

  return async () => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  };
}
