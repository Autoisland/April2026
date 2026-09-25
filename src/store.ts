import { randomUUID } from "node:crypto";
import type { Diagram } from "./model.js";

export function sampleDiagram(): Diagram {
  return {
    id: "sample-falcon-reference",
    title: "Falcon Reference Architecture",
    zones: [
      { id: "estate", label: "Protected Estate", x: 48, y: 96, w: 300, h: 380 },
      { id: "platform", label: "CrowdStrike Platform", x: 452, y: 96, w: 372, h: 380 },
    ],
    nodes: [
      { id: "host", type: "endpoint-host", label: "Managed Hosts", x: 86, y: 152, w: 224, h: 64, zone: "estate" },
      { id: "idp", type: "idp", label: "Identity Provider", x: 86, y: 252, w: 224, h: 64, zone: "estate" },
      { id: "cloud", type: "cloud-account", label: "Cloud Accounts", x: 86, y: 352, w: 224, h: 64, zone: "estate" },
      { id: "edr", type: "falcon-edr", label: "Falcon EDR", x: 490, y: 152, w: 224, h: 64, zone: "platform" },
      { id: "identity", type: "falcon-identity", label: "Falcon Identity", x: 490, y: 252, w: 224, h: 64, zone: "platform" },
      { id: "siem", type: "falcon-ngsiem", label: "Next-Gen SIEM", x: 526, y: 372, w: 224, h: 72, zone: "platform" },
    ],
    edges: [
      { id: "e1", from: "host", to: "edr", label: "sensor telemetry", style: "solid" },
      { id: "e2", from: "idp", to: "identity", label: "auth events", style: "solid" },
      { id: "e3", from: "cloud", to: "siem", label: "cloud logs", style: "dashed" },
      { id: "e4", from: "edr", to: "siem", label: "detections", style: "solid" },
      { id: "e5", from: "identity", to: "siem", label: "detections", style: "solid" },
    ],
  };
}

export class DiagramStore {
  private diagrams = new Map<string, Diagram>();

  constructor(seed = true) {
    if (seed) {
      const sample = sampleDiagram();
      this.diagrams.set(sample.id, { ...sample, updatedAt: new Date().toISOString() });
    }
  }

  list(): Diagram[] {
    return [...this.diagrams.values()].sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  }

  get(id: string): Diagram | undefined {
    return this.diagrams.get(id);
  }

  save(diagram: Diagram): Diagram {
    const id = diagram.id && diagram.id.trim() ? diagram.id : randomUUID();
    const stored: Diagram = { ...diagram, id, updatedAt: new Date().toISOString() };
    this.diagrams.set(id, stored);
    return stored;
  }

  delete(id: string): boolean {
    return this.diagrams.delete(id);
  }
}
