import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("April2026 API", () => {
  const app = createApp();

  it("reports health", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("lists seeded tasks", async () => {
    const res = await request(app).get("/api/tasks");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it("creates a task", async () => {
    const res = await request(app)
      .post("/api/tasks")
      .send({ title: "Write documentation" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ title: "Write documentation", done: false });
    expect(typeof res.body.id).toBe("number");
  });

  it("rejects an empty task title", async () => {
    const res = await request(app).post("/api/tasks").send({ title: "   " });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it("serves the static index page", async () => {
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.text).toContain("April2026");
  });
});
