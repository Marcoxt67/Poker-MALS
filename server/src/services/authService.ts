import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../database/prisma";
import { config } from "../config";
import { AppError } from "../utils/AppError";
import { signToken } from "../utils/jwt";

export const registerSchema = z
  .object({
    username: z
      .string()
      .trim()
      .min(3, "Nome de usuário deve possuir pelo menos 3 caracteres.")
      .max(24, "Nome de usuário deve possuir no máximo 24 caracteres.")
      .regex(/^[a-zA-Z0-9_]+$/, "Nome de usuário deve conter apenas letras, números e underscore."),
    displayName: z.string().trim().min(2, "Nome de exibição deve possuir pelo menos 2 caracteres.").max(40),
    email: z.string().trim().email("Informe um email válido."),
    password: z.string().min(6, "A senha deve possuir pelo menos 6 caracteres."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem.",
    path: ["confirmPassword"],
  });

export const loginSchema = z.object({
  identifier: z.string().trim().min(1, "Informe seu email ou nome de usuário."),
  password: z.string().min(1, "Informe sua senha."),
});

const publicUser = (user: {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatar: string | null;
  chips: number;
  createdAt: Date;
}) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  email: user.email,
  avatar: user.avatar,
  chips: user.chips,
  createdAt: user.createdAt,
});

export const authService = {
  async register(input: z.infer<typeof registerSchema>) {
    const existingEmail = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
    if (existingEmail) throw AppError.conflict("Este email já está em uso.");

    const existingUsername = await prisma.user.findUnique({ where: { username: input.username } });
    if (existingUsername) throw AppError.conflict("Este nome de usuário já está em uso.");

    const passwordHash = await bcrypt.hash(input.password, 10);

    const user = await prisma.user.create({
      data: {
        username: input.username,
        displayName: input.displayName,
        email: input.email.toLowerCase(),
        passwordHash,
        chips: config.defaultUserChips,
      },
    });

    const token = signToken({ userId: user.id });
    return { user: publicUser(user), token };
  },

  async login(input: z.infer<typeof loginSchema>) {
    const identifier = input.identifier.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: input.identifier }],
      },
    });

    if (!user) throw AppError.unauthorized("Email/usuário ou senha inválidos.");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw AppError.unauthorized("Email/usuário ou senha inválidos.");

    const token = signToken({ userId: user.id });
    return { user: publicUser(user), token };
  },

  async me(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw AppError.notFound("Usuário não encontrado.");
    return publicUser(user);
  },
};
