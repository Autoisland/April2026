import type { Diagram } from "../model.js";
import { toMermaid } from "./mermaid.js";
import { toD2 } from "./d2.js";
import { toSvg } from "./svg.js";

export type ExportFormat = "mermaid" | "d2" | "svg";

export const EXPORT_FORMATS: ExportFormat[] = ["mermaid", "d2", "svg"];

export function isExportFormat(value: string): value is ExportFormat {
  return (EXPORT_FORMATS as string[]).includes(value);
}

export function exportDiagram(format: ExportFormat, diagram: Diagram): { contentType: string; body: string } {
  switch (format) {
    case "mermaid":
      return { contentType: "text/plain; charset=utf-8", body: toMermaid(diagram) };
    case "d2":
      return { contentType: "text/plain; charset=utf-8", body: toD2(diagram) };
    case "svg":
      return { contentType: "image/svg+xml; charset=utf-8", body: toSvg(diagram) };
  }
}

export { toMermaid, toD2, toSvg };
