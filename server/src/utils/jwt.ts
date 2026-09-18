import jwt from "jsonwebtoken";
import { config } from "../config";

export interface JwtPayload {
  userId: string;
}

export const signToken = (payload: JwtPayload): string => {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
};

export const verifyToken = (token: string): JwtPayload => {
  return jwt.verify(token, config.jwtSecret) as JwtPayload;
};
