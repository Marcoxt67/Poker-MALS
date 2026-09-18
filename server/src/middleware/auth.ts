import { NextFunction, Request, Response } from "express";
import { authService } from "../services/authService";
import { AppError } from "../utils/AppError";
import { verifyToken } from "../utils/jwt";

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string | null;
  chips: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const requireAuth = async (req: Request, _res: Response, next: NextFunction) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw AppError.unauthorized("Token de autenticação ausente.");
    }

    const token = header.slice("Bearer ".length);
    const payload = verifyToken(token);

    const user = await authService.findById(payload.userId);
    if (!user) {
      throw AppError.unauthorized("Usuário não encontrado.");
    }

    req.user = {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      avatar: user.avatar ?? null,
      chips: user.chips,
    };

    next();
  } catch (err) {
    if (err instanceof AppError) return next(err);
    next(AppError.unauthorized("Token inválido ou expirado."));
  }
};
