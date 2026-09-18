import http from "http";
import { config } from "./config";
import { createApp } from "./app";
import { initSocketServer } from "./socket/socketServer";

const app = createApp();
const httpServer = http.createServer(app);
initSocketServer(httpServer);

httpServer.listen(config.port, () => {
  console.log(`Poker MALS server listening on port ${config.port}`);
  console.log("SIMULACAO - FICHAS SEM VALOR MONETARIO");
});
