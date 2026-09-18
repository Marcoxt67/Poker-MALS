import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { AppError } from "../utils/AppError";
import { historyService } from "../services/historyService";

export const userController = {
  myTransactions: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const transactions = await historyService.getMyTransactions(req.user.id);
    res.status(200).json({ transactions });
  }),
};
