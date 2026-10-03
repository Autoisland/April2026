import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { DiagramStore } from "../src/store.js";

function freshApp() {
  return createApp(new DiagramStore());
}

describe("API", () => {
  let app: ReturnType<typeof createApp>;
  beforeEach(() => {
    app = freshApp();
  });

  it("reports health with supported formats", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.formats).toEqual(["mermaid", "d2", "svg"]);
  });

  it("returns the block catalog", async () => {
    const res = await request(app).get("/api/catalog");
    expect(res.status).toBe(200);
    expect(res.body.categories.length).toBeGreaterThan(0);
    expect(res.body.blockTypes.some((b: { id: string }) => b.id === "falcon-edr")).toBe(true);
  });

  it("serves the seeded sample diagram", async () => {
    const res = await request(app).get("/api/diagrams/sample-falcon-reference");
    expect(res.status).toBe(200);
    expect(res.body.nodes.length).toBeGreaterThan(0);
  });

  it("creates, retrieves, and deletes a diagram", async () => {
    const payload = {
      title: "Test",
      zones: [],
      nodes: [{ id: "n1", type: "falcon-edr", label: "EDR", x: 0, y: 0, w: 150, h: 64 }],
      edges: [],
    };
    const created = await request(app).post("/api/diagrams").send(payload);
    expect(created.status).toBe(201);
    const id = created.body.id;
    expect(id).toBeTruthy();

    const fetched = await request(app).get(`/api/diagrams/${id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.title).toBe("Test");

    const removed = await request(app).delete(`/api/diagrams/${id}`);
    expect(removed.status).toBe(204);

    const missing = await request(app).get(`/api/diagrams/${id}`);
    expect(missing.status).toBe(404);
  });

  it("rejects an invalid diagram with details", async () => {
    const res = await request(app)
      .post("/api/diagrams")
      .send({ nodes: [{ id: "n1", type: "bogus" }] });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid diagram");
    expect(Array.isArray(res.body.details)).toBe(true);
  });

  it("exports mermaid, d2, and svg", async () => {
    const payload = {
      title: "Exp",
      zones: [{ id: "z1", label: "Zone" }],
      nodes: [
        { id: "a", type: "falcon-edr", label: "A", x: 0, y: 0, w: 150, h: 64, zone: "z1" },
        { id: "b", type: "falcon-ngsiem", label: "B", x: 300, y: 0, w: 120, h: 72 },
      ],
      edges: [{ id: "e", from: "a", to: "b", label: "logs" }],
    };
    const mermaid = await request(app).post("/api/export/mermaid").send(payload);
    expect(mermaid.status).toBe(200);
    expect(mermaid.text).toContain("flowchart TD");
    expect(mermaid.headers["content-type"]).toContain("text/plain");

    const d2 = await request(app).post("/api/export/d2").send(payload);
    expect(d2.status).toBe(200);
    expect(d2.text).toContain("->");

    const svg = await request(app).post("/api/export/svg").buffer(true).send(payload);
    expect(svg.status).toBe(200);
    expect(svg.headers["content-type"]).toContain("image/svg+xml");
    const svgText = svg.text || (Buffer.isBuffer(svg.body) ? svg.body.toString() : "");
    expect(svgText).toContain("<svg");
  });

  it("rejects an unknown export format", async () => {
    const res = await request(app).post("/api/export/pdf").send({ nodes: [], edges: [], zones: [] });
    expect(res.status).toBe(400);
    expect(res.body.supported).toEqual(["mermaid", "d2", "svg"]);
  });
});
