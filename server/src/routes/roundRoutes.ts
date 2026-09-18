import { Router } from "express";
import { roundController } from "../controllers/roundController";
import { requireAuth } from "../middleware/auth";

export const roundRoutes = Router();

roundRoutes.use(requireAuth);

roundRoutes.get("/:roundId", roundController.get);
roundRoutes.post("/:roundId/bet", roundController.bet);
roundRoutes.post("/:roundId/call", roundController.call);
roundRoutes.post("/:roundId/raise", roundController.raise);
roundRoutes.post("/:roundId/fold", roundController.fold);
roundRoutes.post("/:roundId/winner", roundController.winner);
