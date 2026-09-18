import { Router } from "express";
import { tableController } from "../controllers/tableController";
import { requireAuth } from "../middleware/auth";

export const tableRoutes = Router();

tableRoutes.use(requireAuth);

tableRoutes.post("/", tableController.create);
tableRoutes.get("/", tableController.list);
tableRoutes.post("/join", tableController.join);
tableRoutes.get("/:id", tableController.get);
tableRoutes.post("/:id/leave", tableController.leave);

tableRoutes.post("/:id/chips/add", tableController.addChips);
tableRoutes.post("/:id/chips/remove", tableController.removeChips);
tableRoutes.post("/:id/players/remove", tableController.removePlayer);
tableRoutes.post("/:id/pause", tableController.pause);
tableRoutes.post("/:id/resume", tableController.resume);
tableRoutes.patch("/:id/settings", tableController.updateSettings);

tableRoutes.post("/:id/rounds", tableController.startRound);
tableRoutes.post("/:id/end", tableController.endRound);

tableRoutes.get("/:id/history", tableController.history);
