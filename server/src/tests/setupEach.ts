import { beforeEach, afterAll } from "vitest";
import { resetDb } from "./testUtils";
import { prisma } from "../database/prisma";

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await prisma.$disconnect();
});
