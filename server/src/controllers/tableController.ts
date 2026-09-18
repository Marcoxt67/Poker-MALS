import { Request, Response } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import {
  adminChipsSchema,
  createTableSchema,
  tableService,
  updateSettingsSchema,
} from "../services/tableService";
import { roundService } from "../services/roundService";
import { historyService } from "../services/historyService";

const joinSchema = z.object({ code: z.string().trim().min(1, "Informe o código da mesa.") });
const removePlayerSchema = z.object({ targetUserId: z.string().min(1) });

const userId = (req: Request) => {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
};

export const tableController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const input = createTableSchema.parse(req.body);
    const table = await tableService.createTable(userId(req), input);
    res.status(201).json({ table });
  }),

  list: asyncHandler(async (req: Request, res: Response) => {
    const mine = req.query.mine === "true";
    const tables = await tableService.listTables(userId(req), mine);
    res.status(200).json({ tables });
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    const table = await tableService.getTableForUser(userId(req), req.params.id);
    res.status(200).json({ table });
  }),

  join: asyncHandler(async (req: Request, res: Response) => {
    const input = joinSchema.parse(req.body);
    const table = await tableService.joinTable(userId(req), input.code);
    res.status(200).json({ table });
  }),

  leave: asyncHandler(async (req: Request, res: Response) => {
    const result = await tableService.leaveTable(userId(req), req.params.id);
    res.status(200).json(result);
  }),

  addChips: asyncHandler(async (req: Request, res: Response) => {
    const input = adminChipsSchema.parse(req.body);
    const result = await tableService.adminAddChips(userId(req), req.params.id, input);
    res.status(200).json(result);
  }),

  removeChips: asyncHandler(async (req: Request, res: Response) => {
    const input = adminChipsSchema.parse(req.body);
    const result = await tableService.adminRemoveChips(userId(req), req.params.id, input);
    res.status(200).json(result);
  }),

  removePlayer: asyncHandler(async (req: Request, res: Response) => {
    const input = removePlayerSchema.parse(req.body);
    const result = await tableService.removePlayer(userId(req), req.params.id, input.targetUserId);
    res.status(200).json(result);
  }),

  pause: asyncHandler(async (req: Request, res: Response) => {
    const result = await tableService.pauseTable(userId(req), req.params.id);
    res.status(200).json(result);
  }),

  resume: asyncHandler(async (req: Request, res: Response) => {
    const result = await tableService.resumeTable(userId(req), req.params.id);
    res.status(200).json(result);
  }),

  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    const input = updateSettingsSchema.parse(req.body);
    const result = await tableService.updateSettings(userId(req), req.params.id, input);
    res.status(200).json({ table: result });
  }),

  startRound: asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.startRound(userId(req), req.params.id);
    res.status(201).json({ round });
  }),

  endRound: asyncHandler(async (req: Request, res: Response) => {
    const result = await roundService.endRound(userId(req), req.params.id);
    res.status(200).json(result);
  }),

  history: asyncHandler(async (req: Request, res: Response) => {
    const history = await historyService.getTableHistory(userId(req), req.params.id);
    res.status(200).json({ history });
  }),
};
