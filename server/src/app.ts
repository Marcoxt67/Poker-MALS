import path from "path";
import fs from "fs";
import express from "express";
import cors from "cors";
import { config } from "./config";
import { apiRouter } from "./routes";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler";

// When the client has been built (e.g. on Render, where the whole repo is
// deployed as a single Web Service), serve the static build directly from
// this server so one service can host both the API and the frontend.
const clientDistPath = path.resolve(__dirname, "../../client/dist");
const clientBuildExists = fs.existsSync(path.join(clientDistPath, "index.html"));

export const createApp = () => {
  const app = express();

  app.use(cors({ origin: config.corsOrigin, credentials: true }));
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", simulation: "FICHAS SEM VALOR MONETARIO" });
  });

  app.use("/api", apiRouter);

  if (clientBuildExists) {
    app.use(express.static(clientDistPath));
    // SPA fallback: any non-API, non-asset GET request returns index.html so
    // client-side routes (React Router) work on a hard refresh / deep link.
    app.get(/^(?!\/api|\/health).*/, (_req, res) => {
      res.sendFile(path.join(clientDistPath, "index.html"));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
