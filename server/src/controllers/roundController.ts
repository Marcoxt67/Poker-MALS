import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { amountSchema, roundService, winnerSchema } from "../services/roundService";

const userId = (req: Request) => {
  if (!req.user) throw AppError.unauthorized();
  return req.user.id;
};

export const roundController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.getRound(userId(req), req.params.roundId);
    res.status(200).json({ round });
  }),

  bet: asyncHandler(async (req: Request, res: Response) => {
    const input = amountSchema.parse(req.body);
    const round = await roundService.bet(userId(req), req.params.roundId, input.amount);
    res.status(200).json({ round });
  }),

  call: asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.call(userId(req), req.params.roundId);
    res.status(200).json({ round });
  }),

  raise: asyncHandler(async (req: Request, res: Response) => {
    const input = amountSchema.parse(req.body);
    const round = await roundService.raise(userId(req), req.params.roundId, input.amount);
    res.status(200).json({ round });
  }),

  fold: asyncHandler(async (req: Request, res: Response) => {
    const round = await roundService.fold(userId(req), req.params.roundId);
    res.status(200).json({ round });
  }),

  winner: asyncHandler(async (req: Request, res: Response) => {
    const input = winnerSchema.parse(req.body);
    const round = await roundService.selectWinner(userId(req), req.params.roundId, input.winnerUserId);
    res.status(200).json({ round });
  }),
};
