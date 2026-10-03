import { describe, it, expect } from "vitest";
import type { Diagram } from "../src/model.js";
import { toMermaid } from "../src/generators/mermaid.js";
import { toD2 } from "../src/generators/d2.js";
import { toSvg } from "../src/generators/svg.js";
import { buildKeyMap, sanitizeKey } from "../src/generators/util.js";

const fixture: Diagram = {
  id: "fix",
  title: "Fixture",
  zones: [{ id: "zone-a", label: "Zone A", x: 0, y: 0, w: 300, h: 200 }],
  nodes: [
    { id: "node-1", type: "falcon-edr", label: "EDR", x: 20, y: 40, w: 150, h: 64, zone: "zone-a" },
    { id: "node-2", type: "falcon-ngsiem", label: "SIEM", x: 400, y: 40, w: 120, h: 72 },
    { id: "node-3", type: "data-lake", label: "Lake", x: 400, y: 200, w: 150, h: 64 },
  ],
  edges: [
    { id: "e1", from: "node-1", to: "node-2", label: "telemetry", style: "solid" },
    { id: "e2", from: "node-2", to: "node-3", style: "dashed" },
  ],
};

describe("util key map", () => {
  it("sanitizes and de-duplicates keys deterministically", () => {
    expect(sanitizeKey("node-1")).toBe("node_1");
    expect(sanitizeKey("1abc")).toBe("_1abc");
    const map = buildKeyMap(["a-b", "a.b", "a b"]);
    expect(new Set(map.values()).size).toBe(3);
  });
});

describe("toMermaid", () => {
  const out = toMermaid(fixture);
  it("starts with a flowchart declaration", () => {
    expect(out.startsWith("flowchart TD")).toBe(true);
  });
  it("emits a subgraph for the zone containing its node", () => {
    expect(out).toContain('subgraph zone_a["Zone A"]');
    expect(out).toContain('node_1("EDR")');
  });
  it("uses hexagon shape for SIEM and cylinder for the data lake", () => {
    expect(out).toContain('node_2{{"SIEM"}}');
    expect(out).toContain('node_3[("Lake")]');
  });
  it("emits labeled and dashed edges", () => {
    expect(out).toContain("node_1 -->|telemetry| node_2");
    expect(out).toContain("node_2 -.-> node_3");
  });
});

describe("toD2", () => {
  const out = toD2(fixture);
  it("nests zoned nodes and references them by full path in edges", () => {
    expect(out).toContain('zone_a: "Zone A" {');
    expect(out).toContain("zone_a.node_1 -> node_2");
  });
  it("adds a stroke-dash for dashed edges", () => {
    expect(out).toContain("style.stroke-dash: 3");
  });
});

describe("toSvg", () => {
  const out = toSvg(fixture);
  it("produces a valid svg root with a viewBox", () => {
    expect(out).toContain("<svg ");
    expect(out).toContain('viewBox="');
    expect(out.trim().endsWith("</svg>")).toBe(true);
  });
  it("renders labels and an arrow marker", () => {
    expect(out).toContain(">EDR<");
    expect(out).toContain(">telemetry<");
    expect(out).toContain('marker-end="url(#arrow)"');
  });
  it("escapes the diagram title", () => {
    const risky = toSvg({ ...fixture, title: "<script>alert(1)</script>" });
    expect(risky).toContain("&lt;script&gt;");
    expect(risky).not.toContain("<script>");
  });
});
