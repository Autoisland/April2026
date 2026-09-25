import type { Diagram } from "../model.js";
import { buildKeyMap } from "./util.js";

function d2Label(text: string): string {
  return text.replace(/"/g, '\\"').replace(/[\r\n]+/g, " ");
}

export function toD2(diagram: Diagram): string {
  const keys = buildKeyMap([...diagram.zones.map((z) => z.id), ...diagram.nodes.map((n) => n.id)]);
  const lines: string[] = [];

  // Fully-qualified path for each node (zone.node when it belongs to a zone).
  const nodePath = new Map<string, string>();
  for (const node of diagram.nodes) {
    const nodeKey = keys.get(node.id)!;
    if (node.zone && keys.has(node.zone)) {
      nodePath.set(node.id, `${keys.get(node.zone)!}.${nodeKey}`);
    } else {
      nodePath.set(node.id, nodeKey);
    }
  }

  const zonedNodeIds = new Set<string>();
  for (const zone of diagram.zones) {
    const members = diagram.nodes.filter((n) => n.zone === zone.id);
    lines.push(`${keys.get(zone.id)!}: "${d2Label(zone.label)}" {`);
    for (const node of members) {
      lines.push(`  ${keys.get(node.id)!}: "${d2Label(node.label)}"`);
      zonedNodeIds.add(node.id);
    }
    lines.push("}");
  }

  for (const node of diagram.nodes) {
    if (!zonedNodeIds.has(node.id)) {
      lines.push(`${keys.get(node.id)!}: "${d2Label(node.label)}"`);
    }
  }

  for (const edge of diagram.edges) {
    const from = nodePath.get(edge.from)!;
    const to = nodePath.get(edge.to)!;
    const label = edge.label ? `: "${d2Label(edge.label)}"` : "";
    if (edge.style === "dashed") {
      lines.push(`${from} -> ${to}${label} {`);
      lines.push("  style.stroke-dash: 3");
      lines.push("}");
    } else {
      lines.push(`${from} -> ${to}${label}`);
    }
  }

  return lines.join("\n") + "\n";
}
