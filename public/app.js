let idSeq = 1;
const uid = (prefix) => `${prefix}-${Date.now().toString(36)}-${idSeq++}`;

const state = {
  id: "",
  title: "Falcon Reference Architecture",
  zones: [],
  nodes: [],
  edges: [],
  selection: null,
  connectMode: false,
  connectFrom: null,
  catalog: { categories: [], blockTypes: [] },
};

const el = (id) => document.getElementById(id);
const canvas = el("canvas");

async function api(path, options) {
  const res = await fetch(path, options);
  if (!res.ok) {
    let detail = "";
    try {
      detail = JSON.stringify(await res.json());
    } catch {
      detail = res.statusText;
    }
    throw new Error(`${res.status} ${detail}`);
  }
  return res;
}

function status(msg) {
  const s = el("status");
  s.textContent = msg;
  s.classList.add("show");
  clearTimeout(status._t);
  status._t = setTimeout(() => s.classList.remove("show"), 1800);
}

function categoryColor(categoryId) {
  const c = state.catalog.categories.find((x) => x.id === categoryId);
  return c ? c.color : "#64748b";
}
function blockType(typeId) {
  return state.catalog.blockTypes.find((b) => b.id === typeId);
}

function borderPoint(node, tx, ty) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? node.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? node.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}

function resizeCanvas() {
  const wrap = canvas.parentElement;
  canvas.setAttribute("width", wrap.clientWidth);
  canvas.setAttribute("height", wrap.clientHeight);
}

function svgPoint(evt) {
  const pt = canvas.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

function render() {
  const parts = [];
  parts.push(
    '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b"/></marker></defs>',
  );

  for (const z of state.zones) {
    const sel = state.selection && state.selection.kind === "zone" && state.selection.id === z.id;
    parts.push(
      `<g data-zone="${z.id}"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="12" fill="#16233a" fill-opacity="0.6" stroke="${sel ? "#38bdf8" : "#334155"}" stroke-width="${sel ? 2.5 : 1.5}" stroke-dasharray="6 4"/>` +
        `<text x="${z.x + 12}" y="${z.y + 22}" fill="#94a3b8" font-size="13" font-weight="600">${escapeHtml(z.label)}</text></g>`,
    );
  }

  const nodeById = Object.fromEntries(state.nodes.map((n) => [n.id, n]));
  for (const e of state.edges) {
    const from = nodeById[e.from];
    const to = nodeById[e.to];
    if (!from || !to) continue;
    const p1 = borderPoint(from, to.x + to.w / 2, to.y + to.h / 2);
    const p2 = borderPoint(to, from.x + from.w / 2, from.y + from.h / 2);
    const sel = state.selection && state.selection.kind === "edge" && state.selection.id === e.id;
    const dash = e.style === "dashed" ? 'stroke-dasharray="6 4"' : "";
    parts.push(
      `<g data-edge-hit="${e.id}" class="edge-hit">` +
        `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="transparent" stroke-width="12"/>` +
        `<line class="edge ${sel ? "selected" : ""}" x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${sel ? "#38bdf8" : "#64748b"}" stroke-width="1.8" ${dash} marker-end="url(#arrow)"/>`,
    );
    if (e.label) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const w = e.label.length * 6.5 + 10;
      parts.push(
        `<rect x="${mx - w / 2}" y="${my - 10}" width="${w}" height="18" rx="4" fill="#0b1220" stroke="#334155"/>` +
          `<text x="${mx}" y="${my + 3}" fill="#cbd5e1" font-size="11" text-anchor="middle">${escapeHtml(e.label)}</text>`,
      );
    }
    parts.push("</g>");
  }

  for (const n of state.nodes) {
    const color = categoryColor(blockType(n.type)?.category);
    const sel = state.selection && state.selection.kind === "node" && state.selection.id === n.id;
    const connectSrc = state.connectFrom === n.id;
    parts.push(
      `<g class="node-group ${sel ? "selected" : ""}" data-node="${n.id}">` +
        `<rect class="node-shape" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="${color}22" stroke="${connectSrc ? "#38bdf8" : color}" stroke-width="${sel || connectSrc ? 3 : 2}"/>` +
        `<text x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 4}" fill="#e2e8f0" font-size="13" font-weight="600" text-anchor="middle">${escapeHtml(n.label)}</text>` +
        `</g>`,
    );
  }

  canvas.innerHTML = parts.join("");
}

function escapeHtml(t) {
  return String(t)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderPalette() {
  const container = el("palette");
  container.querySelectorAll(".palette-group").forEach((n) => n.remove());
  for (const cat of state.catalog.categories) {
    const blocks = state.catalog.blockTypes.filter((b) => b.category === cat.id);
    if (blocks.length === 0) continue;
    const group = document.createElement("div");
    group.className = "palette-group";
    group.innerHTML = `<h3>${escapeHtml(cat.label)}</h3>`;
    for (const b of blocks) {
      const btn = document.createElement("button");
      btn.className = "palette-block";
      btn.style.borderLeftColor = cat.color;
      btn.innerHTML = `<span class="dot" style="background:${cat.color}"></span>${escapeHtml(b.label)}`;
      btn.title = b.description;
      btn.addEventListener("click", () => addNode(b.id));
      group.appendChild(btn);
    }
    container.appendChild(group);
  }
}

function addNode(typeId) {
  const bt = blockType(typeId);
  if (!bt) return;
  const n = {
    id: uid("node"),
    type: typeId,
    label: bt.label,
    x: 120 + (state.nodes.length % 5) * 40,
    y: 120 + (state.nodes.length % 5) * 40,
    w: 150,
    h: 64,
    zone: undefined,
  };
  assignZone(n);
  state.nodes.push(n);
  select({ kind: "node", id: n.id });
  render();
  status(`Added ${bt.label}`);
}

function assignZone(node) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const zone = state.zones.find((z) => cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h);
  node.zone = zone ? zone.id : undefined;
}

function addZone() {
  const z = { id: uid("zone"), label: "New Zone", x: 60 + state.zones.length * 30, y: 60 + state.zones.length * 30, w: 320, h: 240 };
  state.zones.push(z);
  select({ kind: "zone", id: z.id });
  render();
}

function select(sel) {
  state.selection = sel;
  updateInspector();
  render();
}

function updateInspector() {
  const panels = { node: el("inspector-node"), edge: el("inspector-edge"), zone: el("inspector-zone") };
  el("inspector-empty").hidden = !!state.selection;
  for (const k of Object.keys(panels)) panels[k].hidden = true;
  if (!state.selection) return;
  const { kind, id } = state.selection;
  if (kind === "node") {
    const n = state.nodes.find((x) => x.id === id);
    if (!n) return;
    panels.node.hidden = false;
    el("node-label").value = n.label;
    el("node-type").textContent = blockType(n.type)?.description ?? n.type;
    const zoneSel = el("node-zone");
    zoneSel.innerHTML = '<option value="">— none —</option>' + state.zones.map((z) => `<option value="${z.id}">${escapeHtml(z.label)}</option>`).join("");
    zoneSel.value = n.zone ?? "";
  } else if (kind === "edge") {
    const e = state.edges.find((x) => x.id === id);
    if (!e) return;
    panels.edge.hidden = false;
    el("edge-label").value = e.label ?? "";
    el("edge-style").value = e.style ?? "solid";
  } else if (kind === "zone") {
    const z = state.zones.find((x) => x.id === id);
    if (!z) return;
    panels.zone.hidden = false;
    el("zone-label").value = z.label;
  }
}

function deleteSelected() {
  if (!state.selection) return;
  const { kind, id } = state.selection;
  if (kind === "node") {
    state.nodes = state.nodes.filter((n) => n.id !== id);
    state.edges = state.edges.filter((e) => e.from !== id && e.to !== id);
  } else if (kind === "edge") {
    state.edges = state.edges.filter((e) => e.id !== id);
  } else if (kind === "zone") {
    state.zones = state.zones.filter((z) => z.id !== id);
    state.nodes.forEach((n) => {
      if (n.zone === id) n.zone = undefined;
    });
  }
  select(null);
  status("Deleted");
}

function toggleConnect() {
  state.connectMode = !state.connectMode;
  state.connectFrom = null;
  el("btn-connect").setAttribute("aria-pressed", String(state.connectMode));
  status(state.connectMode ? "Connect: click a source block" : "Connect mode off");
  render();
}

function handleConnectClick(nodeId) {
  if (!state.connectFrom) {
    state.connectFrom = nodeId;
    status("Now click a target block");
    render();
    return;
  }
  if (state.connectFrom === nodeId) {
    state.connectFrom = null;
    render();
    return;
  }
  const edge = { id: uid("edge"), from: state.connectFrom, to: nodeId, label: "", style: "solid" };
  state.edges.push(edge);
  state.connectFrom = null;
  select({ kind: "edge", id: edge.id });
  status("Connection added");
}

// Drag handling
let drag = null;
canvas.addEventListener("pointerdown", (evt) => {
  const nodeG = evt.target.closest("[data-node]");
  const edgeG = evt.target.closest("[data-edge-hit]");
  const zoneG = evt.target.closest("[data-zone]");
  if (nodeG) {
    const id = nodeG.getAttribute("data-node");
    if (state.connectMode) {
      handleConnectClick(id);
      return;
    }
    const n = state.nodes.find((x) => x.id === id);
    select({ kind: "node", id });
    const p = svgPoint(evt);
    drag = { kind: "node", id, dx: p.x - n.x, dy: p.y - n.y };
    canvas.setPointerCapture(evt.pointerId);
  } else if (edgeG) {
    select({ kind: "edge", id: edgeG.getAttribute("data-edge-hit") });
  } else if (zoneG) {
    const id = zoneG.getAttribute("data-zone");
    const z = state.zones.find((x) => x.id === id);
    select({ kind: "zone", id });
    const p = svgPoint(evt);
    drag = { kind: "zone", id, dx: p.x - z.x, dy: p.y - z.y };
    canvas.setPointerCapture(evt.pointerId);
  } else {
    select(null);
  }
});

canvas.addEventListener("pointermove", (evt) => {
  if (!drag) return;
  const p = svgPoint(evt);
  if (drag.kind === "node") {
    const n = state.nodes.find((x) => x.id === drag.id);
    if (!n) return;
    n.x = Math.round(p.x - drag.dx);
    n.y = Math.round(p.y - drag.dy);
  } else if (drag.kind === "zone") {
    const z = state.zones.find((x) => x.id === drag.id);
    if (!z) return;
    z.x = Math.round(p.x - drag.dx);
    z.y = Math.round(p.y - drag.dy);
  }
  render();
});

canvas.addEventListener("pointerup", () => {
  if (drag && drag.kind === "node") {
    const n = state.nodes.find((x) => x.id === drag.id);
    if (n) assignZone(n);
    updateInspector();
  }
  drag = null;
  render();
});

function modelPayload() {
  return {
    id: state.id,
    title: state.title,
    zones: state.zones,
    nodes: state.nodes,
    edges: state.edges,
  };
}

async function save() {
  try {
    const method = state.id ? "PUT" : "POST";
    const path = state.id ? `/api/diagrams/${encodeURIComponent(state.id)}` : "/api/diagrams";
    const res = await api(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(modelPayload()),
    });
    const saved = await res.json();
    state.id = saved.id;
    await refreshLoadList();
    el("load-select").value = saved.id;
    status("Saved");
  } catch (err) {
    status(`Save failed: ${err.message}`);
  }
}

async function refreshLoadList() {
  const res = await api("/api/diagrams");
  const list = await res.json();
  const sel = el("load-select");
  sel.innerHTML = '<option value="">Load saved…</option>' + list.map((d) => `<option value="${d.id}">${escapeHtml(d.title)}</option>`).join("");
}

async function loadDiagram(id) {
  if (!id) return;
  const res = await api(`/api/diagrams/${encodeURIComponent(id)}`);
  const d = await res.json();
  state.id = d.id;
  state.title = d.title;
  state.zones = d.zones || [];
  state.nodes = d.nodes || [];
  state.edges = d.edges || [];
  state.selection = null;
  el("title").value = state.title;
  updateInspector();
  render();
  status(`Loaded "${d.title}"`);
}

function newDiagram() {
  state.id = "";
  state.title = "Untitled diagram";
  state.zones = [];
  state.nodes = [];
  state.edges = [];
  state.selection = null;
  el("title").value = state.title;
  updateInspector();
  render();
  status("New diagram");
}

async function exportAs(format) {
  try {
    const res = await api(`/api/export/${format}`, {
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify(modelPayload()),
    });
    const body = await res.text();
    showExport(format, body);
    return body;
  } catch (err) {
    status(`Export failed: ${err.message}`);
    return null;
  }
}

function showExport(format, body) {
  el("export-title").textContent = `Export · ${format.toUpperCase()}`;
  const textEl = el("export-text");
  const previewEl = el("export-preview");
  const copyBtn = el("btn-copy");
  if (format === "svg") {
    previewEl.hidden = false;
    previewEl.innerHTML = body;
    textEl.hidden = true;
    copyBtn.hidden = true;
  } else {
    textEl.hidden = false;
    textEl.textContent = body;
    previewEl.hidden = true;
    copyBtn.hidden = false;
    copyBtn.onclick = () => {
      navigator.clipboard?.writeText(body);
      status("Copied to clipboard");
    };
  }
  status(`Generated ${format.toUpperCase()}`);
}

async function exportPng() {
  const svg = await exportAs("svg");
  if (!svg) return;
  const widthMatch = svg.match(/width="([\d.]+)"/);
  const heightMatch = svg.match(/height="([\d.]+)"/);
  const w = widthMatch ? Math.ceil(parseFloat(widthMatch[1])) : 800;
  const h = heightMatch ? Math.ceil(parseFloat(heightMatch[1])) : 600;
  const img = new Image();
  const svgUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = w * 2;
    c.height = h * 2;
    const ctx = c.getContext("2d");
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    const link = document.createElement("a");
    link.download = `${(state.title || "diagram").replace(/\s+/g, "-").toLowerCase()}.png`;
    link.href = c.toDataURL("image/png");
    link.click();
    status("PNG downloaded");
  };
  img.onerror = () => status("PNG render failed");
  img.src = svgUrl;
}

// Inspector inputs
el("title").addEventListener("input", (e) => {
  state.title = e.target.value;
});
el("node-label").addEventListener("input", (e) => {
  const n = state.nodes.find((x) => state.selection?.kind === "node" && x.id === state.selection.id);
  if (n) {
    n.label = e.target.value;
    render();
  }
});
el("node-zone").addEventListener("change", (e) => {
  const n = state.nodes.find((x) => state.selection?.kind === "node" && x.id === state.selection.id);
  if (n) {
    n.zone = e.target.value || undefined;
    status("Zone updated");
  }
});
el("edge-label").addEventListener("input", (e) => {
  const ed = state.edges.find((x) => state.selection?.kind === "edge" && x.id === state.selection.id);
  if (ed) {
    ed.label = e.target.value;
    render();
  }
});
el("edge-style").addEventListener("change", (e) => {
  const ed = state.edges.find((x) => state.selection?.kind === "edge" && x.id === state.selection.id);
  if (ed) {
    ed.style = e.target.value;
    render();
  }
});
el("zone-label").addEventListener("input", (e) => {
  const z = state.zones.find((x) => state.selection?.kind === "zone" && x.id === state.selection.id);
  if (z) {
    z.label = e.target.value;
    render();
  }
});

// Toolbar buttons
el("btn-new").addEventListener("click", newDiagram);
el("btn-add-zone").addEventListener("click", addZone);
el("btn-connect").addEventListener("click", toggleConnect);
el("btn-delete").addEventListener("click", deleteSelected);
el("btn-save").addEventListener("click", save);
el("load-select").addEventListener("change", (e) => loadDiagram(e.target.value));
el("btn-export-mermaid").addEventListener("click", () => exportAs("mermaid"));
el("btn-export-d2").addEventListener("click", () => exportAs("d2"));
el("btn-export-svg").addEventListener("click", () => exportAs("svg"));
el("btn-export-png").addEventListener("click", exportPng);

window.addEventListener("keydown", (e) => {
  if ((e.key === "Delete" || e.key === "Backspace") && state.selection) {
    const tag = document.activeElement?.tagName;
    if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;
    e.preventDefault();
    deleteSelected();
  }
});
window.addEventListener("resize", () => {
  resizeCanvas();
  render();
});

async function init() {
  resizeCanvas();
  try {
    const res = await api("/api/catalog");
    state.catalog = await res.json();
    renderPalette();
    await refreshLoadList();
    await loadDiagram("sample-falcon-reference");
  } catch (err) {
    status(`Init failed: ${err.message}`);
    render();
  }
}

init();
