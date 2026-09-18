import { Router } from "express";
import { userController } from "../controllers/userController";
import { requireAuth } from "../middleware/auth";

export const userRoutes = Router();

userRoutes.use(requireAuth);
userRoutes.get("/me/transactions", userController.myTransactions);
