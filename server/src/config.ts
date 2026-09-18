import path from "path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

export const config = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: process.env.JWT_SECRET ?? "insecure-dev-secret",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",
  corsOrigin: (process.env.CORS_ORIGIN ?? "http://localhost:5173").split(","),
  defaultUserChips: Number(process.env.DEFAULT_USER_CHIPS ?? 1000),
};
