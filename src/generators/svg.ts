import type { Diagram, DiagramNode } from "../model.js";
import { getBlockType, getCategoryColor } from "../catalog.js";
import { escapeXml } from "./util.js";

const PAD = 28;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function bounds(diagram: Diagram): Rect {
  const rects: Rect[] = [...diagram.zones, ...diagram.nodes];
  if (rects.length === 0) {
    return { x: 0, y: 0, w: 480, h: 320 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX - PAD, y: minY - PAD, w: maxX - minX + PAD * 2, h: maxY - minY + PAD * 2 };
}

function borderPoint(node: DiagramNode, tx: number, ty: number): { x: number; y: number } {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const hw = node.w / 2;
  const hh = node.h / 2;
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const t = Math.min(scaleX, scaleY);
  return { x: cx + dx * t, y: cy + dy * t };
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function nodeShape(node: DiagramNode, fill: string, stroke: string): string {
  const shape = getBlockType(node.type)?.shape ?? "rounded";
  const { x, y, w, h } = node;
  const style = `fill="${fill}" stroke="${stroke}" stroke-width="2"`;
  switch (shape) {
    case "hexagon": {
      const inset = Math.min(18, w / 4);
      const pts = [
        `${round(x + inset)},${round(y)}`,
        `${round(x + w - inset)},${round(y)}`,
        `${round(x + w)},${round(y + h / 2)}`,
        `${round(x + w - inset)},${round(y + h)}`,
        `${round(x + inset)},${round(y + h)}`,
        `${round(x)},${round(y + h / 2)}`,
      ].join(" ");
      return `<polygon points="${pts}" ${style} />`;
    }
    case "cylinder": {
      const ry = Math.min(10, h / 6);
      const d = [
        `M ${round(x)} ${round(y + ry)}`,
        `a ${round(w / 2)} ${round(ry)} 0 0 1 ${round(w)} 0`,
        `v ${round(h - ry * 2)}`,
        `a ${round(w / 2)} ${round(ry)} 0 0 1 ${round(-w)} 0`,
        "z",
      ].join(" ");
      const top = `M ${round(x)} ${round(y + ry)} a ${round(w / 2)} ${round(ry)} 0 0 0 ${round(w)} 0`;
      return `<path d="${d}" ${style} /><path d="${top}" fill="none" stroke="${stroke}" stroke-width="2" />`;
    }
    case "rect":
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="4" ${style} />`;
    case "cloud":
    case "rounded":
    default:
      return `<rect x="${round(x)}" y="${round(y)}" width="${round(w)}" height="${round(h)}" rx="14" ${style} />`;
  }
}

function withAlpha(hex: string, alpha: string): string {
  return `${hex}${alpha}`;
}

export function toSvg(diagram: Diagram): string {
  const b = bounds(diagram);
  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${round(b.x)} ${round(b.y)} ${round(b.w)} ${round(b.h)}" width="${round(b.w)}" height="${round(b.h)}" font-family="system-ui, sans-serif">`,
  );
  parts.push(
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" /></marker></defs>',
  );
  parts.push(`<rect x="${round(b.x)}" y="${round(b.y)}" width="${round(b.w)}" height="${round(b.h)}" fill="#0f172a" />`);
  parts.push(`<title>${escapeXml(diagram.title)}</title>`);

  for (const zone of diagram.zones) {
    parts.push(
      `<rect x="${round(zone.x)}" y="${round(zone.y)}" width="${round(zone.w)}" height="${round(zone.h)}" rx="12" fill="#1e293b" stroke="#334155" stroke-width="1.5" stroke-dasharray="6 4" />`,
    );
    parts.push(
      `<text x="${round(zone.x + 12)}" y="${round(zone.y + 22)}" fill="#94a3b8" font-size="13" font-weight="600">${escapeXml(zone.label)}</text>`,
    );
  }

  const nodeById = new Map(diagram.nodes.map((n) => [n.id, n]));
  for (const edge of diagram.edges) {
    const from = nodeById.get(edge.from);
    const to = nodeById.get(edge.to);
    if (!from || !to) continue;
    const fc = { x: from.x + from.w / 2, y: from.y + from.h / 2 };
    const tc = { x: to.x + to.w / 2, y: to.y + to.h / 2 };
    const p1 = borderPoint(from, tc.x, tc.y);
    const p2 = borderPoint(to, fc.x, fc.y);
    const dash = edge.style === "dashed" ? ' stroke-dasharray="6 4"' : "";
    parts.push(
      `<line x1="${round(p1.x)}" y1="${round(p1.y)}" x2="${round(p2.x)}" y2="${round(p2.y)}" stroke="#64748b" stroke-width="1.8"${dash} marker-end="url(#arrow)" />`,
    );
    if (edge.label) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const width = edge.label.length * 6.5 + 10;
      parts.push(
        `<rect x="${round(mx - width / 2)}" y="${round(my - 10)}" width="${round(width)}" height="18" rx="4" fill="#0f172a" stroke="#334155" stroke-width="1" />`,
      );
      parts.push(
        `<text x="${round(mx)}" y="${round(my + 3)}" fill="#cbd5e1" font-size="11" text-anchor="middle">${escapeXml(edge.label)}</text>`,
      );
    }
  }

  for (const node of diagram.nodes) {
    const category = getBlockType(node.type)?.category ?? "";
    const color = getCategoryColor(category);
    parts.push(nodeShape(node, withAlpha(color, "22"), color));
    const cx = node.x + node.w / 2;
    const cy = node.y + node.h / 2;
    parts.push(
      `<text x="${round(cx)}" y="${round(cy + 4)}" fill="#e2e8f0" font-size="13" font-weight="600" text-anchor="middle">${escapeXml(node.label)}</text>`,
    );
  }

  parts.push("</svg>");
  return parts.join("\n");
}
