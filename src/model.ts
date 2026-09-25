import { getBlockType } from "./catalog.js";

export type EdgeStyle = "solid" | "dashed";

export interface DiagramNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  zone?: string;
}

export interface DiagramEdge {
  id: string;
  from: string;
  to: string;
  label?: string;
  style?: EdgeStyle;
}

export interface DiagramZone {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Diagram {
  id: string;
  title: string;
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  zones: DiagramZone[];
  updatedAt?: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  diagram?: Diagram;
}

const DEFAULT_SIZE = { w: 150, h: 64 };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function coerceNode(raw: unknown, index: number, errors: string[]): DiagramNode | null {
  if (typeof raw !== "object" || raw === null) {
    errors.push(`node[${index}] must be an object`);
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!id) {
    errors.push(`node[${index}] is missing a string id`);
    return null;
  }
  const type = typeof r.type === "string" ? r.type : "";
  if (!getBlockType(type)) {
    errors.push(`node "${id}" has unknown type "${type}"`);
    return null;
  }
  const label = typeof r.label === "string" && r.label.trim() ? r.label.trim() : (getBlockType(type)?.label ?? id);
  return {
    id,
    type,
    label,
    x: isFiniteNumber(r.x) ? r.x : 40,
    y: isFiniteNumber(r.y) ? r.y : 40,
    w: isFiniteNumber(r.w) && r.w > 0 ? r.w : DEFAULT_SIZE.w,
    h: isFiniteNumber(r.h) && r.h > 0 ? r.h : DEFAULT_SIZE.h,
    zone: typeof r.zone === "string" && r.zone.trim() ? r.zone.trim() : undefined,
  };
}

function coerceZone(raw: unknown, index: number, errors: string[]): DiagramZone | null {
  if (typeof raw !== "object" || raw === null) {
    errors.push(`zone[${index}] must be an object`);
    return null;
  }
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id.trim() : "";
  if (!id) {
    errors.push(`zone[${index}] is missing a string id`);
    return null;
  }
  return {
    id,
    label: typeof r.label === "string" && r.label.trim() ? r.label.trim() : id,
    x: isFiniteNumber(r.x) ? r.x : 20,
    y: isFiniteNumber(r.y) ? r.y : 20,
    w: isFiniteNumber(r.w) && r.w > 0 ? r.w : 320,
    h: isFiniteNumber(r.h) && r.h > 0 ? r.h : 220,
  };
}

export function validateDiagram(raw: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, errors: ["diagram payload must be an object"] };
  }
  const r = raw as Record<string, unknown>;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim() : "Untitled diagram";

  const rawZones = Array.isArray(r.zones) ? r.zones : [];
  const zones: DiagramZone[] = [];
  const zoneIds = new Set<string>();
  rawZones.forEach((z, i) => {
    const zone = coerceZone(z, i, errors);
    if (zone) {
      if (zoneIds.has(zone.id)) errors.push(`duplicate zone id "${zone.id}"`);
      zoneIds.add(zone.id);
      zones.push(zone);
    }
  });

  const rawNodes = Array.isArray(r.nodes) ? r.nodes : [];
  const nodes: DiagramNode[] = [];
  const nodeIds = new Set<string>();
  rawNodes.forEach((n, i) => {
    const node = coerceNode(n, i, errors);
    if (node) {
      if (nodeIds.has(node.id)) errors.push(`duplicate node id "${node.id}"`);
      nodeIds.add(node.id);
      if (node.zone && !zoneIds.has(node.zone)) {
        errors.push(`node "${node.id}" references unknown zone "${node.zone}"`);
        node.zone = undefined;
      }
      nodes.push(node);
    }
  });

  const rawEdges = Array.isArray(r.edges) ? r.edges : [];
  const edges: DiagramEdge[] = [];
  const edgeIds = new Set<string>();
  rawEdges.forEach((e, i) => {
    if (typeof e !== "object" || e === null) {
      errors.push(`edge[${i}] must be an object`);
      return;
    }
    const er = e as Record<string, unknown>;
    const id = typeof er.id === "string" ? er.id.trim() : "";
    const from = typeof er.from === "string" ? er.from.trim() : "";
    const to = typeof er.to === "string" ? er.to.trim() : "";
    if (!id) {
      errors.push(`edge[${i}] is missing a string id`);
      return;
    }
    if (edgeIds.has(id)) errors.push(`duplicate edge id "${id}"`);
    edgeIds.add(id);
    if (!nodeIds.has(from)) errors.push(`edge "${id}" references unknown source node "${from}"`);
    if (!nodeIds.has(to)) errors.push(`edge "${id}" references unknown target node "${to}"`);
    if (!nodeIds.has(from) || !nodeIds.has(to)) return;
    edges.push({
      id,
      from,
      to,
      label: typeof er.label === "string" && er.label.trim() ? er.label.trim() : undefined,
      style: er.style === "dashed" ? "dashed" : "solid",
    });
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : "";
  return {
    ok: true,
    errors: [],
    diagram: { id, title, nodes, edges, zones },
  };
}
