import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import { config } from "../config";
import { verifyToken } from "../utils/jwt";
import { authService } from "../services/authService";
import { tableService } from "../services/tableService";
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
      const user = await authService.findById(payload.userId);
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
      const player = await tableService.findTablePlayer(tableId, socket.data.userId);
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
