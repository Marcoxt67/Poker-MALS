import { Router } from "express";
import { authRoutes } from "./authRoutes";
import { tableRoutes } from "./tableRoutes";
import { roundRoutes } from "./roundRoutes";
import { userRoutes } from "./userRoutes";

export const apiRouter = Router();

apiRouter.use("/auth", authRoutes);
apiRouter.use("/tables", tableRoutes);
apiRouter.use("/rounds", roundRoutes);
apiRouter.use("/users", userRoutes);
