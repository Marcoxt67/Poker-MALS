import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError";

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  if (err instanceof ZodError) {
    const message = err.errors[0]?.message ?? "Dados inválidos.";
    return res.status(400).json({ error: message, code: "VALIDATION_ERROR" });
  }

  console.error(err);
  return res.status(500).json({ error: "Erro interno do servidor.", code: "INTERNAL_ERROR" });
};

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Rota não encontrada.", code: "NOT_FOUND" });
};
