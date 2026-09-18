import { Server } from "socket.io";

let io: Server | null = null;

export const setIO = (server: Server) => {
  io = server;
};

export const getIO = (): Server | null => io;

export const tableRoom = (tableId: string) => `table:${tableId}`;

export const emitToTable = (tableId: string, event: string, payload: unknown) => {
  io?.to(tableRoom(tableId)).emit(event, payload);
};
