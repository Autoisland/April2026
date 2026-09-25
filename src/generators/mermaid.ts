import type { Diagram, DiagramNode } from "../model.js";
import { getBlockType } from "../catalog.js";
import { buildKeyMap } from "./util.js";

function mermaidLabel(text: string): string {
  return text.replace(/"/g, "&quot;").replace(/[\r\n]+/g, " ");
}

function shapeFor(node: DiagramNode): { open: string; close: string } {
  const shape = getBlockType(node.type)?.shape ?? "rounded";
  switch (shape) {
    case "rect":
      return { open: '["', close: '"]' };
    case "cylinder":
      return { open: '[("', close: '")]' };
    case "hexagon":
      return { open: '{{"', close: '"}}' };
    case "cloud":
    case "rounded":
    default:
      return { open: '("', close: '")' };
  }
}

export function toMermaid(diagram: Diagram): string {
  const keys = buildKeyMap([...diagram.zones.map((z) => z.id), ...diagram.nodes.map((n) => n.id)]);
  const lines: string[] = ["flowchart TD"];

  const declareNode = (node: DiagramNode, indent: string) => {
    const key = keys.get(node.id)!;
    const { open, close } = shapeFor(node);
    lines.push(`${indent}${key}${open}${mermaidLabel(node.label)}${close}`);
  };

  const zonedNodeIds = new Set<string>();
  for (const zone of diagram.zones) {
    const members = diagram.nodes.filter((n) => n.zone === zone.id);
    lines.push(`    subgraph ${keys.get(zone.id)!}["${mermaidLabel(zone.label)}"]`);
    for (const node of members) {
      declareNode(node, "        ");
      zonedNodeIds.add(node.id);
    }
    lines.push("    end");
  }

  for (const node of diagram.nodes) {
    if (!zonedNodeIds.has(node.id)) {
      declareNode(node, "    ");
    }
  }

  for (const edge of diagram.edges) {
    const from = keys.get(edge.from)!;
    const to = keys.get(edge.to)!;
    const arrow = edge.style === "dashed" ? "-.->" : "-->";
    const label = edge.label ? `|${mermaidLabel(edge.label)}|` : "";
    lines.push(`    ${from} ${arrow}${label} ${to}`);
  }

  return lines.join("\n") + "\n";
}
