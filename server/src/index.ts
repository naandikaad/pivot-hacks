import express from "express";
import cors from "cors";
import { sessionRouter } from "./routes/session.js";

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/session", sessionRouter);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal error";
  res.status(400).json({ error: message });
});

const PORT = Number(process.env.PORT ?? 8787);
app.listen(PORT, () => {
  console.log(`Voice knowledge tester server listening on http://localhost:${PORT}`);
});
