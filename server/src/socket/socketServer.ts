import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { config } from "../config";
import { verifyToken } from "../utils/jwt";
import { prisma } from "../database/prisma";
import { setIO, tableRoom } from "./io";

export const initSocketServer = (httpServer: HttpServer) => {
  const io = new Server(httpServer, {
    cors: { origin: config.corsOrigin, credentials: true },
  });

  setIO(io);

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Token ausente."));
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.userId } });
      if (!user) return next(new Error("Usuário não encontrado."));
      socket.data.userId = user.id;
      next();
    } catch {
      next(new Error("Token inválido."));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join_table", async (tableId: string) => {
      if (typeof tableId !== "string") return;
      const player = await prisma.tablePlayer.findUnique({
        where: { tableId_userId: { tableId, userId: socket.data.userId } },
      });
      if (!player || player.status !== "ACTIVE") return;
      socket.join(tableRoom(tableId));
    });

    socket.on("leave_table_room", (tableId: string) => {
      if (typeof tableId !== "string") return;
      socket.leave(tableRoom(tableId));
    });
  });

  return io;
};
