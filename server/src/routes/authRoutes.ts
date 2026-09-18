import { Router } from "express";
import { authController } from "../controllers/authController";
import { requireAuth } from "../middleware/auth";

export const authRoutes = Router();

authRoutes.post("/register", authController.register);
authRoutes.post("/login", authController.login);
authRoutes.get("/me", requireAuth, authController.me);
