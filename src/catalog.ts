export type BlockShape = "rounded" | "rect" | "cylinder" | "hexagon" | "cloud";

export interface BlockType {
  id: string;
  label: string;
  category: string;
  shape: BlockShape;
  description: string;
}

export interface Category {
  id: string;
  label: string;
  color: string;
}

export const CATEGORIES: Category[] = [
  { id: "endpoint", label: "Endpoint & Workload", color: "#ef4444" },
  { id: "identity", label: "Identity", color: "#f59e0b" },
  { id: "cloud", label: "Cloud & SaaS", color: "#38bdf8" },
  { id: "network", label: "Network", color: "#22c55e" },
  { id: "siem", label: "SIEM / SOAR", color: "#a855f7" },
  { id: "data", label: "Data & Telemetry", color: "#14b8a6" },
  { id: "alliance", label: "Alliance Partner", color: "#e879f9" },
];

export const BLOCK_TYPES: BlockType[] = [
  { id: "falcon-edr", label: "Falcon EDR", category: "endpoint", shape: "rounded", description: "CrowdStrike Falcon endpoint detection and response sensor." },
  { id: "falcon-identity", label: "Falcon Identity", category: "identity", shape: "rounded", description: "Identity threat detection and protection." },
  { id: "falcon-cloud", label: "Falcon Cloud Security", category: "cloud", shape: "cloud", description: "Cloud workload and posture protection (CNAPP)." },
  { id: "falcon-ngsiem", label: "Falcon Next-Gen SIEM", category: "siem", shape: "hexagon", description: "Log analytics and detection platform." },
  { id: "falcon-soar", label: "Falcon Fusion SOAR", category: "siem", shape: "hexagon", description: "Automated response and orchestration workflows." },
  { id: "idp", label: "Identity Provider", category: "identity", shape: "rounded", description: "Okta / Entra ID / Ping identity source." },
  { id: "endpoint-host", label: "Managed Host", category: "endpoint", shape: "rect", description: "Laptop, server, or VM running the sensor." },
  { id: "firewall", label: "Next-Gen Firewall", category: "network", shape: "rect", description: "Perimeter or internal segmentation firewall." },
  { id: "proxy", label: "Secure Web Gateway", category: "network", shape: "rect", description: "Egress inspection and web filtering." },
  { id: "cloud-account", label: "Cloud Account", category: "cloud", shape: "cloud", description: "AWS / Azure / GCP subscription or account." },
  { id: "saas-app", label: "SaaS Application", category: "cloud", shape: "cloud", description: "Business SaaS integrated for logs or control." },
  { id: "data-lake", label: "Data Lake", category: "data", shape: "cylinder", description: "Long-term telemetry and log storage." },
  { id: "telemetry-bus", label: "Telemetry Bus", category: "data", shape: "cylinder", description: "Event streaming / ingestion pipeline." },
  { id: "threat-intel", label: "Threat Intelligence", category: "data", shape: "hexagon", description: "IOC and adversary intelligence feed." },
  { id: "partner-connector", label: "Alliance Connector", category: "alliance", shape: "rounded", description: "Marketplace / alliance partner integration." },
  { id: "ticketing", label: "Ticketing / ITSM", category: "alliance", shape: "rect", description: "ServiceNow / Jira workflow integration." },
];

export interface Catalog {
  categories: Category[];
  blockTypes: BlockType[];
}

export function getCatalog(): Catalog {
  return { categories: CATEGORIES, blockTypes: BLOCK_TYPES };
}

const BLOCK_TYPE_INDEX = new Map<string, BlockType>(BLOCK_TYPES.map((b) => [b.id, b]));

export function getBlockType(id: string): BlockType | undefined {
  return BLOCK_TYPE_INDEX.get(id);
}

const CATEGORY_INDEX = new Map<string, Category>(CATEGORIES.map((c) => [c.id, c]));

export function getCategoryColor(categoryId: string): string {
  return CATEGORY_INDEX.get(categoryId)?.color ?? "#64748b";
}

export function getCategoryLabel(categoryId: string): string {
  return CATEGORY_INDEX.get(categoryId)?.label ?? categoryId;
}
