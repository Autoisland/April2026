import type { Diagram } from "../model.js";

export function sanitizeKey(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_]/g, "_");
  return /^[a-zA-Z_]/.test(cleaned) ? cleaned : `_${cleaned}`;
}

/**
 * Build a deterministic, collision-free map from node/zone ids to safe keys,
 * preserving input order so generator output is stable and testable.
 */
export function buildKeyMap(ids: string[]): Map<string, string> {
  const map = new Map<string, string>();
  const used = new Set<string>();
  for (const id of ids) {
    const key = sanitizeKey(id);
    let candidate = key;
    let n = 1;
    while (used.has(candidate)) {
      candidate = `${key}_${n++}`;
    }
    used.add(candidate);
    map.set(id, candidate);
  }
  return map;
}

export function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function nodeOrder(diagram: Diagram): string[] {
  return diagram.nodes.map((n) => n.id);
}
