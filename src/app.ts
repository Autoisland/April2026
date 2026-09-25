import express, { type Express, type Request, type Response } from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface TaskItem {
  id: number;
  title: string;
  done: boolean;
}

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  const publicDir = path.resolve(__dirname, "..", "public");
  app.use(express.static(publicDir));

  const tasks: TaskItem[] = [
    { id: 1, title: "Set up the Cloud Agent environment", done: true },
    { id: 2, title: "Run the app end to end", done: false },
  ];
  let nextId = tasks.length + 1;

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.get("/api/tasks", (_req: Request, res: Response) => {
    res.json(tasks);
  });

  app.post("/api/tasks", (req: Request, res: Response) => {
    const title = typeof req.body?.title === "string" ? req.body.title.trim() : "";
    if (!title) {
      res.status(400).json({ error: "title is required" });
      return;
    }
    const task: TaskItem = { id: nextId++, title, done: false };
    tasks.push(task);
    res.status(201).json(task);
  });

  return app;
}
