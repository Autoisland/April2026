import { describe, it, expect } from "vitest";
import { validateDiagram } from "../src/model.js";

describe("validateDiagram", () => {
  it("accepts a valid diagram and normalizes defaults", () => {
    const result = validateDiagram({
      title: "  My Arch  ",
      zones: [{ id: "z1", label: "Zone 1" }],
      nodes: [{ id: "n1", type: "falcon-edr", label: "EDR", x: 10, y: 20, zone: "z1" }],
      edges: [{ id: "e1", from: "n1", to: "n1" }],
    });
    expect(result.ok).toBe(true);
    expect(result.diagram?.title).toBe("My Arch");
    expect(result.diagram?.nodes[0].w).toBe(150);
    expect(result.diagram?.edges[0].style).toBe("solid");
  });

  it("rejects unknown block types", () => {
    const result = validateDiagram({ nodes: [{ id: "n1", type: "not-real" }] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain('unknown type "not-real"');
  });

  it("rejects edges that reference missing nodes", () => {
    const result = validateDiagram({
      nodes: [{ id: "n1", type: "falcon-edr" }],
      edges: [{ id: "e1", from: "n1", to: "ghost" }],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain('unknown target node "ghost"');
  });

  it("drops zone references that do not exist", () => {
    const result = validateDiagram({ nodes: [{ id: "n1", type: "falcon-edr", zone: "nope" }] });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain('unknown zone "nope"');
  });

  it("flags duplicate node ids", () => {
    const result = validateDiagram({
      nodes: [
        { id: "dup", type: "falcon-edr" },
        { id: "dup", type: "idp" },
      ],
    });
    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("duplicate node id");
  });

  it("rejects non-object payloads", () => {
    expect(validateDiagram("nope").ok).toBe(false);
    expect(validateDiagram(null).ok).toBe(false);
  });
});
