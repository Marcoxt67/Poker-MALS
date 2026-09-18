import bcrypt from "bcryptjs";
import { z } from "zod";
import { config } from "../config";
import { UserNode } from "../database/models";
import { newId, nowIso, paths, readPath, removePath, transact, writePath } from "../database/realtime";
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

export const publicUser = (user: UserNode) => ({
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  email: user.email,
  avatar: user.avatar ?? null,
  chips: user.chips,
  createdAt: user.createdAt,
});

/**
 * The Realtime Database has no unique constraints, so `usernames/{lower}` and
 * `emails/{lower}` act as reservation nodes: claiming one is a transaction that
 * only succeeds when it is still free.
 */
const reserve = async (path: string, userId: string, takenMessage: string) => {
  await transact<string>(path, (current) => {
    if (current !== null) return { error: AppError.conflict(takenMessage) };
    return { next: userId };
  });
};

export const authService = {
  async register(input: z.infer<typeof registerSchema>) {
    const usernameLower = input.username.toLowerCase();
    const emailLower = input.email.toLowerCase();
    const userId = newId();

    const passwordHash = await bcrypt.hash(input.password, 10);

    await reserve(paths.email(emailLower), userId, "Este email já está em uso.");
    try {
      await reserve(paths.username(usernameLower), userId, "Este nome de usuário já está em uso.");
    } catch (err) {
      await removePath(paths.email(emailLower));
      throw err;
    }

    const user: UserNode = {
      id: userId,
      username: input.username,
      usernameLower,
      displayName: input.displayName,
      email: emailLower,
      passwordHash,
      avatar: null,
      chips: config.defaultUserChips,
      createdAt: nowIso(),
    };

    await writePath(paths.user(userId), user);

    return { user: publicUser(user), token: signToken({ userId }) };
  },

  async login(input: z.infer<typeof loginSchema>) {
    const identifier = input.identifier.toLowerCase();

    const userId =
      (await readPath<string>(paths.email(identifier))) ?? (await readPath<string>(paths.username(identifier)));

    if (!userId) throw AppError.unauthorized("Email/usuário ou senha inválidos.");

    const user = await readPath<UserNode>(paths.user(userId));
    if (!user) throw AppError.unauthorized("Email/usuário ou senha inválidos.");

    const valid = await bcrypt.compare(input.password, user.passwordHash);
    if (!valid) throw AppError.unauthorized("Email/usuário ou senha inválidos.");

    return { user: publicUser(user), token: signToken({ userId }) };
  },

  async me(userId: string) {
    const user = await readPath<UserNode>(paths.user(userId));
    if (!user) throw AppError.notFound("Usuário não encontrado.");
    return publicUser(user);
  },

  async findById(userId: string) {
    return readPath<UserNode>(paths.user(userId));
  },
};
