import express from "express";
import cors from "cors";
import { config } from "./config";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", simulation: "FICHAS SEM VALOR MONETARIO" });
  });

  app.use("/api", apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
