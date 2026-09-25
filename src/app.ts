import express, { type Express, type Request, type Response } from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getCatalog } from "./catalog.js";
import { validateDiagram } from "./model.js";
import { DiagramStore } from "./store.js";
import { exportDiagram, isExportFormat, EXPORT_FORMATS } from "./generators/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp(store: DiagramStore = new DiagramStore()): Express {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  const publicDir = path.resolve(__dirname, "..", "public");
  app.use(express.static(publicDir));

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", uptime: process.uptime(), formats: EXPORT_FORMATS });
  });

  app.get("/api/catalog", (_req: Request, res: Response) => {
    res.json(getCatalog());
  });

  app.get("/api/diagrams", (_req: Request, res: Response) => {
    res.json(store.list());
  });

  app.get("/api/diagrams/:id", (req: Request, res: Response) => {
    const diagram = store.get(req.params.id);
    if (!diagram) {
      res.status(404).json({ error: "diagram not found" });
      return;
    }
    res.json(diagram);
  });

  app.post("/api/diagrams", (req: Request, res: Response) => {
    const result = validateDiagram(req.body);
    if (!result.ok || !result.diagram) {
      res.status(400).json({ error: "invalid diagram", details: result.errors });
      return;
    }
    const saved = store.save(result.diagram);
    res.status(201).json(saved);
  });

  app.put("/api/diagrams/:id", (req: Request, res: Response) => {
    const result = validateDiagram(req.body);
    if (!result.ok || !result.diagram) {
      res.status(400).json({ error: "invalid diagram", details: result.errors });
      return;
    }
    const saved = store.save({ ...result.diagram, id: req.params.id });
    res.json(saved);
  });

  app.delete("/api/diagrams/:id", (req: Request, res: Response) => {
    const removed = store.delete(req.params.id);
    if (!removed) {
      res.status(404).json({ error: "diagram not found" });
      return;
    }
    res.status(204).end();
  });

  app.post("/api/export/:format", (req: Request, res: Response) => {
    const format = req.params.format;
    if (!isExportFormat(format)) {
      res.status(400).json({ error: `unknown format "${format}"`, supported: EXPORT_FORMATS });
      return;
    }
    const result = validateDiagram(req.body);
    if (!result.ok || !result.diagram) {
      res.status(400).json({ error: "invalid diagram", details: result.errors });
      return;
    }
    const { contentType, body } = exportDiagram(format, result.diagram);
    res.type(contentType).send(body);
  });

  return app;
}
