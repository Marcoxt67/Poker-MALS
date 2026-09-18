import { Request, Response } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authService, loginSchema, registerSchema } from "../services/authService";
import { AppError } from "../utils/AppError";

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const input = registerSchema.parse(req.body);
    const result = await authService.register(input);
    res.status(201).json(result);
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const input = loginSchema.parse(req.body);
    const result = await authService.login(input);
    res.status(200).json(result);
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) throw AppError.unauthorized();
    const user = await authService.me(req.user.id);
    res.status(200).json({ user });
  }),
};
