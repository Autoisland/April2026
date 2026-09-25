let idSeq = 1;
const uid = (p) => `${p}-${Date.now().toString(36)}-${idSeq++}`;
const GRID = 8;
const snap = (v) => Math.round(v / GRID) * GRID;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const el = (id) => document.getElementById(id);
const canvas = el("canvas");

const state = {
  id: "",
  title: "Falcon Reference Architecture",
  zones: [],
  nodes: [],
  edges: [],
  selection: null,
  connectMode: false,
  connecting: null,
  scale: 1,
  origin: { x: 0, y: 0 },
  catalog: { categories: [], blockTypes: [] },
};

const history = { stack: [], index: -1 };

// ---------- icons ----------
const ICONS = {
  endpoint: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  identity: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
  cloud: '<path d="M7 18a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 18z"/>',
  network: '<circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><path d="M8.2 10.9 15.8 7.1M8.2 13.1l7.6 3.8"/>',
  siem: '<path d="M3 12h4l2.5-7 5 14 2.5-7H21"/>',
  data: '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  alliance: '<path d="M9.5 14.5l5-5"/><path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5"/>',
};
const iconPaths = (cat) => ICONS[cat] || '<circle cx="12" cy="12" r="6"/>';
function iconSvgHtml(cat, size) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths(cat)}</svg>`;
}

function escapeHtml(t) {
  return String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

let statusTimer;
function status(msg) {
  const s = el("status");
  s.textContent = msg;
  s.classList.add("show");
  clearTimeout(statusTimer);
  statusTimer = setTimeout(() => s.classList.remove("show"), 1800);
}

const categoryColor = (id) => state.catalog.categories.find((c) => c.id === id)?.color || "#64748b";
const categoryLabel = (id) => state.catalog.categories.find((c) => c.id === id)?.label || id;
const blockType = (id) => state.catalog.blockTypes.find((b) => b.id === id);

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

// ---------- view / zoom / pan ----------
function setView() {
  const w = canvas.clientWidth / state.scale;
  const h = canvas.clientHeight / state.scale;
  canvas.setAttribute("viewBox", `${state.origin.x} ${state.origin.y} ${w} ${h}`);
  canvas.setAttribute("width", canvas.clientWidth);
  canvas.setAttribute("height", canvas.clientHeight);
  el("zoom-value").textContent = `${Math.round(state.scale * 100)}%`;
}
function svgPoint(clientX, clientY) {
  const pt = canvas.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}
function zoomAt(factor, clientX, clientY) {
  const before = svgPoint(clientX, clientY);
  state.scale = clamp(state.scale * factor, 0.25, 3);
  const rect = canvas.getBoundingClientRect();
  state.origin.x = before.x - (clientX - rect.left) / state.scale;
  state.origin.y = before.y - (clientY - rect.top) / state.scale;
  setView();
}
function contentBounds() {
  const rects = [...state.zones, ...state.nodes];
  if (rects.length === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x);
    minY = Math.min(minY, r.y);
    maxX = Math.max(maxX, r.x + r.w);
    maxY = Math.max(maxY, r.y + r.h);
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
function fitToContent() {
  const b = contentBounds();
  if (!b) {
    state.scale = 1;
    state.origin = { x: 0, y: 0 };
    setView();
    return;
  }
  const pad = 60;
  const cw = canvas.clientWidth;
  const ch = canvas.clientHeight;
  state.scale = clamp(Math.min(cw / (b.w + pad * 2), ch / (b.h + pad * 2)), 0.25, 2);
  const vw = cw / state.scale;
  const vh = ch / state.scale;
  state.origin.x = b.x + b.w / 2 - vw / 2;
  state.origin.y = b.y + b.h / 2 - vh / 2;
  setView();
}

// ---------- render ----------
function nodeIcon(node, cx, cy) {
  const cat = blockType(node.type)?.category;
  const size = 30;
  const x = node.x + 12;
  const y = cy - size / 2;
  const color = categoryColor(cat);
  const iconSize = 18;
  const s = iconSize / 24;
  const tx = x + (size - iconSize) / 2;
  const ty = y + (size - iconSize) / 2;
  return (
    `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="8" fill="${color}"/>` +
    `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(3)})" stroke="#fff" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths(cat)}</g>`
  );
}

function render() {
  const parts = [
    '<defs>' +
      '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8a97a5"/></marker>' +
      '<filter id="ns" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#1e3a5f" flood-opacity="0.16"/></filter>' +
      '</defs>',
  ];

  for (const z of state.zones) {
    const sel = state.selection?.kind === "zone" && state.selection.id === z.id;
    parts.push(
      `<g data-zone="${z.id}"><rect x="${z.x}" y="${z.y}" width="${z.w}" height="${z.h}" rx="14" fill="#ffffff" fill-opacity="0.55" stroke="${sel ? "#0077b5" : "#c4ccd4"}" stroke-width="${sel ? 2 : 1.5}" stroke-dasharray="7 5"/>` +
        `<text x="${z.x + 16}" y="${z.y + 26}" fill="#6b7685" font-size="13" font-weight="600" letter-spacing="0.3">${escapeHtml(z.label)}</text></g>`,
    );
  }

  const byId = Object.fromEntries(state.nodes.map((n) => [n.id, n]));
  for (const e of state.edges) {
    const a = byId[e.from];
    const b = byId[e.to];
    if (!a || !b) continue;
    const p1 = borderPoint(a, b.x + b.w / 2, b.y + b.h / 2);
    const p2 = borderPoint(b, a.x + a.w / 2, a.y + a.h / 2);
    const sel = state.selection?.kind === "edge" && state.selection.id === e.id;
    const dash = e.style === "dashed" ? 'stroke-dasharray="7 5"' : "";
    parts.push(
      `<g data-edge-hit="${e.id}" class="edge-hit">` +
        `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="transparent" stroke-width="14"/>` +
        `<line x1="${p1.x}" y1="${p1.y}" x2="${p2.x}" y2="${p2.y}" stroke="${sel ? "#0077b5" : "#8a97a5"}" stroke-width="${sel ? 2.4 : 1.8}" ${dash} marker-end="url(#arrow)"/>`,
    );
    if (e.label) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const w = e.label.length * 6.5 + 14;
      parts.push(
        `<rect x="${mx - w / 2}" y="${my - 10}" width="${w}" height="20" rx="5" fill="#ffffff" stroke="${sel ? "#0077b5" : "#dddddd"}"/>` +
          `<text x="${mx}" y="${my + 4}" fill="#334155" font-size="11" text-anchor="middle">${escapeHtml(e.label)}</text>`,
      );
    }
    parts.push("</g>");
  }

  for (const n of state.nodes) {
    const cat = blockType(n.type)?.category;
    const color = categoryColor(cat);
    const sel = state.selection?.kind === "node" && state.selection.id === n.id;
    const active = state.connecting?.from === n.id;
    const cx = n.x + n.w / 2;
    const cy = n.y + n.h / 2;
    parts.push(`<g class="node-group" data-node="${n.id}">`);
    parts.push(
      `<rect filter="url(#ns)" x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="12" fill="#ffffff" stroke="${sel || active ? "#0077b5" : color}" stroke-width="${sel || active ? 2.6 : 1.6}"/>`,
    );
    parts.push(nodeIcon(n, cx, cy));
    parts.push(
      `<text x="${n.x + 52}" y="${cy - 2}" fill="#22303f" font-size="13.5" font-weight="600">${escapeHtml(n.label)}</text>`,
    );
    parts.push(
      `<text x="${n.x + 52}" y="${cy + 14}" fill="#8a94a0" font-size="10" letter-spacing="0.4">${escapeHtml(categoryLabel(cat).toUpperCase())}</text>`,
    );
    parts.push("</g>");
    if (sel && !state.connectMode) {
      const dots = [
        [cx, n.y],
        [n.x + n.w, cy],
        [cx, n.y + n.h],
        [n.x, cy],
      ];
      for (const [dx, dy] of dots) {
        parts.push(`<circle class="connect-dot" data-connect-dot="${n.id}" cx="${dx}" cy="${dy}" r="5"/>`);
      }
    }
  }

  canvas.innerHTML = parts.join("");
  el("empty-state").classList.toggle("hidden", state.nodes.length + state.zones.length > 0);
}

// ---------- palette ----------
function renderPalette(filter = "") {
  const list = el("palette-list");
  list.innerHTML = "";
  const q = filter.trim().toLowerCase();
  for (const cat of state.catalog.categories) {
    const blocks = state.catalog.blockTypes.filter(
      (b) => b.category === cat.id && (!q || b.label.toLowerCase().includes(q) || b.description.toLowerCase().includes(q)),
    );
    if (blocks.length === 0) continue;
    const group = document.createElement("div");
    group.className = "palette-group";
    group.innerHTML = `<h3>${escapeHtml(cat.label)}</h3>`;
    for (const b of blocks) {
      const btn = document.createElement("button");
      btn.className = "palette-block";
      btn.draggable = true;
      btn.title = b.description;
      btn.innerHTML = `<span class="chip" style="background:${cat.color}">${iconSvgHtml(cat.id, 15)}</span>${escapeHtml(b.label)}`;
      btn.addEventListener("click", () => addNodeCentered(b.id));
      btn.addEventListener("dragstart", (e) => {
        e.dataTransfer.setData("text/plain", b.id);
        e.dataTransfer.effectAllowed = "copy";
      });
      group.appendChild(btn);
    }
    list.appendChild(group);
  }
  if (!list.children.length) {
    list.innerHTML = '<div class="inspector-empty">No blocks match your search.</div>';
  }
}

function makeNode(typeId, x, y) {
  const bt = blockType(typeId);
  const n = { id: uid("node"), type: typeId, label: bt ? bt.label : typeId, x: snap(x), y: snap(y), w: 190, h: 64, zone: undefined };
  assignZone(n);
  return n;
}
function addNodeAt(typeId, x, y) {
  if (!blockType(typeId)) return;
  const n = makeNode(typeId, x - 95, y - 32);
  state.nodes.push(n);
  select({ kind: "node", id: n.id });
  commit();
  render();
  status(`Added ${n.label}`);
}
function addNodeCentered(typeId) {
  const cx = state.origin.x + canvas.clientWidth / state.scale / 2;
  const cy = state.origin.y + canvas.clientHeight / state.scale / 2;
  addNodeAt(typeId, cx + (state.nodes.length % 4) * 16, cy + (state.nodes.length % 4) * 16);
}

function assignZone(node) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const zone = state.zones.find((z) => cx >= z.x && cx <= z.x + z.w && cy >= z.y && cy <= z.y + z.h);
  node.zone = zone ? zone.id : undefined;
}
function addZone() {
  const cx = state.origin.x + canvas.clientWidth / state.scale / 2;
  const cy = state.origin.y + canvas.clientHeight / state.scale / 2;
  const z = { id: uid("zone"), label: "New Zone", x: snap(cx - 170), y: snap(cy - 130), w: 340, h: 260 };
  state.zones.push(z);
  select({ kind: "zone", id: z.id });
  commit();
  render();
}

// ---------- selection / inspector ----------
function select(sel) {
  state.selection = sel;
  updateInspector();
  render();
}
function updateInspector() {
  const panels = { node: el("inspector-node"), edge: el("inspector-edge"), zone: el("inspector-zone") };
  el("inspector-empty").hidden = !!state.selection;
  el("inspector-actions").hidden = !state.selection;
  for (const k of Object.keys(panels)) panels[k].hidden = true;
  if (!state.selection) return;
  const { kind, id } = state.selection;
  if (kind === "node") {
    const n = state.nodes.find((x) => x.id === id);
    if (!n) return;
    panels.node.hidden = false;
    const cat = blockType(n.type)?.category;
    el("node-type-badge").innerHTML =
      `<span class="chip" style="background:${categoryColor(cat)}">${iconSvgHtml(cat, 17)}</span>` +
      `<span class="tb-text"><b>${escapeHtml(blockType(n.type)?.label || n.type)}</b><span>${escapeHtml(blockType(n.type)?.description || "")}</span></span>`;
    el("node-label").value = n.label;
    const zoneSel = el("node-zone");
    zoneSel.innerHTML = '<option value="">— none —</option>' + state.zones.map((z) => `<option value="${z.id}">${escapeHtml(z.label)}</option>`).join("");
    zoneSel.value = n.zone ?? "";
  } else if (kind === "edge") {
    const e = state.edges.find((x) => x.id === id);
    if (!e) return;
    panels.edge.hidden = false;
    el("edge-label").value = e.label ?? "";
    for (const btn of el("edge-style").querySelectorAll("button")) {
      btn.classList.toggle("active", btn.dataset.style === (e.style ?? "solid"));
    }
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
  state.selection = null;
  updateInspector();
  commit();
  render();
  status("Deleted");
}

// ---------- connect ----------
function toggleConnect() {
  state.connectMode = !state.connectMode;
  state.connecting = null;
  el("btn-connect").setAttribute("aria-pressed", String(state.connectMode));
  status(state.connectMode ? "Connect: click a source, then a target" : "Connect mode off");
  render();
}
function handleConnectClick(nodeId) {
  if (!state.connecting) {
    state.connecting = { from: nodeId };
    status("Now click the target block");
    render();
    return;
  }
  if (state.connecting.from === nodeId) {
    state.connecting = null;
    render();
    return;
  }
  createEdge(state.connecting.from, nodeId);
  state.connecting = null;
}
function createEdge(from, to) {
  const e = { id: uid("edge"), from, to, label: "", style: "solid" };
  state.edges.push(e);
  select({ kind: "edge", id: e.id });
  commit();
  status("Connection added");
}

// ---------- pointer interactions ----------
let drag = null;
function updateTempEdge(clientX, clientY) {
  const from = state.nodes.find((n) => n.id === state.connecting.from);
  if (!from) return;
  const p = svgPoint(clientX, clientY);
  const p1 = borderPoint(from, p.x, p.y);
  let line = document.getElementById("temp-edge");
  if (!line) {
    line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("id", "temp-edge");
    line.setAttribute("stroke", "#0077b5");
    line.setAttribute("stroke-width", "2");
    line.setAttribute("stroke-dasharray", "5 4");
    line.setAttribute("pointer-events", "none");
    canvas.appendChild(line);
  }
  line.setAttribute("x1", p1.x);
  line.setAttribute("y1", p1.y);
  line.setAttribute("x2", p.x);
  line.setAttribute("y2", p.y);
}

canvas.addEventListener("pointerdown", (evt) => {
  const dot = evt.target.closest("[data-connect-dot]");
  const nodeG = evt.target.closest("[data-node]");
  const edgeG = evt.target.closest("[data-edge-hit]");
  const zoneG = evt.target.closest("[data-zone]");

  if (dot) {
    state.connecting = { from: dot.getAttribute("data-connect-dot") };
    canvas.setPointerCapture(evt.pointerId);
    drag = { kind: "connect", pointerId: evt.pointerId };
    updateTempEdge(evt.clientX, evt.clientY);
    return;
  }
  if (nodeG) {
    const id = nodeG.getAttribute("data-node");
    if (state.connectMode) {
      handleConnectClick(id);
      return;
    }
    const n = state.nodes.find((x) => x.id === id);
    select({ kind: "node", id });
    const p = svgPoint(evt.clientX, evt.clientY);
    drag = { kind: "node", id, dx: p.x - n.x, dy: p.y - n.y };
    canvas.setPointerCapture(evt.pointerId);
  } else if (edgeG) {
    select({ kind: "edge", id: edgeG.getAttribute("data-edge-hit") });
  } else if (zoneG) {
    const id = zoneG.getAttribute("data-zone");
    const z = state.zones.find((x) => x.id === id);
    select({ kind: "zone", id });
    const p = svgPoint(evt.clientX, evt.clientY);
    drag = { kind: "zone", id, dx: p.x - z.x, dy: p.y - z.y };
    canvas.setPointerCapture(evt.pointerId);
  } else {
    drag = { kind: "pan", lastX: evt.clientX, lastY: evt.clientY, moved: false };
    canvas.setPointerCapture(evt.pointerId);
    canvas.classList.add("grabbing");
  }
});

canvas.addEventListener("pointermove", (evt) => {
  if (!drag) return;
  if (drag.kind === "connect") {
    updateTempEdge(evt.clientX, evt.clientY);
    return;
  }
  if (drag.kind === "pan") {
    state.origin.x -= (evt.clientX - drag.lastX) / state.scale;
    state.origin.y -= (evt.clientY - drag.lastY) / state.scale;
    drag.lastX = evt.clientX;
    drag.lastY = evt.clientY;
    drag.moved = true;
    setView();
    return;
  }
  const p = svgPoint(evt.clientX, evt.clientY);
  if (drag.kind === "node") {
    const n = state.nodes.find((x) => x.id === drag.id);
    if (n) {
      n.x = snap(p.x - drag.dx);
      n.y = snap(p.y - drag.dy);
    }
  } else if (drag.kind === "zone") {
    const z = state.zones.find((x) => x.id === drag.id);
    if (z) {
      z.x = snap(p.x - drag.dx);
      z.y = snap(p.y - drag.dy);
    }
  }
  render();
});

canvas.addEventListener("pointerup", (evt) => {
  if (!drag) return;
  const d = drag;
  drag = null;
  canvas.classList.remove("grabbing");
  if (d.kind === "connect") {
    const target = document.elementFromPoint(evt.clientX, evt.clientY)?.closest("[data-node]");
    const toId = target?.getAttribute("data-node");
    const fromId = state.connecting?.from;
    state.connecting = null;
    document.getElementById("temp-edge")?.remove();
    if (toId && fromId && toId !== fromId) {
      createEdge(fromId, toId);
    } else {
      render();
    }
    return;
  }
  if (d.kind === "node") {
    const n = state.nodes.find((x) => x.id === d.id);
    if (n) assignZone(n);
    updateInspector();
    commit();
  } else if (d.kind === "zone") {
    commit();
  } else if (d.kind === "pan" && !d.moved) {
    select(null);
  }
  render();
});

canvas.addEventListener("wheel", (evt) => {
  evt.preventDefault();
  zoomAt(evt.deltaY < 0 ? 1.1 : 1 / 1.1, evt.clientX, evt.clientY);
}, { passive: false });

// drag from palette
canvas.addEventListener("dragover", (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = "copy";
  canvas.classList.add("dragover");
});
canvas.addEventListener("dragleave", () => canvas.classList.remove("dragover"));
canvas.addEventListener("drop", (e) => {
  e.preventDefault();
  canvas.classList.remove("dragover");
  const typeId = e.dataTransfer.getData("text/plain");
  if (!typeId) return;
  const p = svgPoint(e.clientX, e.clientY);
  addNodeAt(typeId, p.x, p.y);
});

// ---------- history ----------
function snapshot() {
  return JSON.stringify({ id: state.id, title: state.title, zones: state.zones, nodes: state.nodes, edges: state.edges });
}
function resetHistory() {
  history.stack = [snapshot()];
  history.index = 0;
  updateHistoryButtons();
}
function commit() {
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(snapshot());
  history.index = history.stack.length - 1;
  updateHistoryButtons();
}
function restore(snap) {
  const d = JSON.parse(snap);
  state.id = d.id;
  state.title = d.title;
  state.zones = d.zones;
  state.nodes = d.nodes;
  state.edges = d.edges;
  state.selection = null;
  el("title").value = state.title;
  updateInspector();
  render();
}
function undo() {
  if (history.index <= 0) return;
  history.index--;
  restore(history.stack[history.index]);
  updateHistoryButtons();
  status("Undo");
}
function redo() {
  if (history.index >= history.stack.length - 1) return;
  history.index++;
  restore(history.stack[history.index]);
  updateHistoryButtons();
  status("Redo");
}
function updateHistoryButtons() {
  el("btn-undo").disabled = history.index <= 0;
  el("btn-redo").disabled = history.index >= history.stack.length - 1;
}

// ---------- persistence ----------
function modelPayload() {
  return { id: state.id, title: state.title, zones: state.zones, nodes: state.nodes, edges: state.edges };
}
async function save() {
  try {
    const method = state.id ? "PUT" : "POST";
    const path = state.id ? `/api/diagrams/${encodeURIComponent(state.id)}` : "/api/diagrams";
    const res = await api(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(modelPayload()) });
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
  el("load-select").innerHTML =
    '<option value="">Load saved…</option>' + list.map((d) => `<option value="${d.id}">${escapeHtml(d.title)}</option>`).join("");
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
  fitToContent();
  render();
  resetHistory();
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
  fitToContent();
  render();
  resetHistory();
  status("New diagram");
}

// ---------- export modal ----------
const modal = { format: "mermaid", text: "", svg: "" };
async function fetchExport(format) {
  const fmt = format === "png" ? "svg" : format;
  const res = await api(`/api/export/${fmt}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(modelPayload()) });
  return res.text();
}
async function openExport() {
  el("export-modal").classList.add("open");
  await switchFormat("mermaid");
}
function closeExport() {
  el("export-modal").classList.remove("open");
}
async function switchFormat(format) {
  modal.format = format;
  for (const tab of document.querySelectorAll(".modal-tab")) tab.classList.toggle("active", tab.dataset.format === format);
  const code = el("modal-code");
  const preview = el("modal-preview");
  const copyBtn = el("btn-copy");
  try {
    if (format === "mermaid" || format === "d2") {
      modal.text = await fetchExport(format);
      code.textContent = modal.text;
      code.hidden = false;
      preview.hidden = true;
      copyBtn.hidden = false;
      el("modal-hint").textContent = format === "mermaid" ? "Paste into any Mermaid renderer (e.g. mermaid.live)." : "Paste into a D2 renderer (d2lang.com).";
    } else if (format === "svg") {
      modal.svg = await fetchExport("svg");
      preview.innerHTML = modal.svg;
      preview.hidden = false;
      code.hidden = true;
      copyBtn.hidden = false;
      el("modal-hint").textContent = "Scalable vector — ideal for docs and slides.";
    } else {
      modal.svg = await fetchExport("svg");
      preview.innerHTML = '<div style="color:#9aa7b4;font-size:.85rem">Rendering preview…</div>';
      preview.hidden = false;
      code.hidden = true;
      copyBtn.hidden = true;
      el("modal-hint").textContent = "Rasterized at 2× for presentations.";
      renderPngPreview();
    }
  } catch (err) {
    status(`Export failed: ${err.message}`);
  }
}
function svgToImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
async function renderPngPreview() {
  try {
    const img = await svgToImage(modal.svg);
    el("modal-preview").innerHTML = "";
    el("modal-preview").appendChild(img);
  } catch {
    el("modal-preview").textContent = "PNG render failed";
  }
}
function download(filename, href) {
  const a = document.createElement("a");
  a.download = filename;
  a.href = href;
  a.click();
}
async function doDownload() {
  const base = (state.title || "diagram").replace(/\s+/g, "-").toLowerCase();
  if (modal.format === "mermaid") download(`${base}.mmd`, "data:text/plain;charset=utf-8," + encodeURIComponent(modal.text));
  else if (modal.format === "d2") download(`${base}.d2`, "data:text/plain;charset=utf-8," + encodeURIComponent(modal.text));
  else if (modal.format === "svg") download(`${base}.svg`, "data:image/svg+xml;charset=utf-8," + encodeURIComponent(modal.svg));
  else {
    const img = await svgToImage(modal.svg);
    const w = parseInt(img.width || "800", 10);
    const h = parseInt(img.height || "600", 10);
    const c = document.createElement("canvas");
    c.width = w * 2;
    c.height = h * 2;
    const ctx = c.getContext("2d");
    ctx.scale(2, 2);
    ctx.drawImage(img, 0, 0);
    download(`${base}.png`, c.toDataURL("image/png"));
  }
  status("Downloaded");
}

// ---------- events ----------
el("title").addEventListener("input", (e) => (state.title = e.target.value));
el("title").addEventListener("change", () => commit());
el("node-label").addEventListener("input", (e) => {
  const n = state.selection?.kind === "node" && state.nodes.find((x) => x.id === state.selection.id);
  if (n) { n.label = e.target.value; render(); }
});
el("node-label").addEventListener("change", () => commit());
el("node-zone").addEventListener("change", (e) => {
  const n = state.selection?.kind === "node" && state.nodes.find((x) => x.id === state.selection.id);
  if (n) { n.zone = e.target.value || undefined; commit(); status("Zone updated"); }
});
el("edge-label").addEventListener("input", (e) => {
  const ed = state.selection?.kind === "edge" && state.edges.find((x) => x.id === state.selection.id);
  if (ed) { ed.label = e.target.value; render(); }
});
el("edge-label").addEventListener("change", () => commit());
el("edge-style").addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const ed = state.selection?.kind === "edge" && state.edges.find((x) => x.id === state.selection.id);
  if (ed) { ed.style = btn.dataset.style; updateInspector(); render(); commit(); }
});
el("zone-label").addEventListener("input", (e) => {
  const z = state.selection?.kind === "zone" && state.zones.find((x) => x.id === state.selection.id);
  if (z) { z.label = e.target.value; render(); }
});
el("zone-label").addEventListener("change", () => commit());

el("btn-new").addEventListener("click", newDiagram);
el("btn-add-zone").addEventListener("click", addZone);
el("btn-connect").addEventListener("click", toggleConnect);
el("btn-delete").addEventListener("click", deleteSelected);
el("btn-delete-2").addEventListener("click", deleteSelected);
el("btn-undo").addEventListener("click", undo);
el("btn-redo").addEventListener("click", redo);
el("btn-save").addEventListener("click", save);
el("load-select").addEventListener("change", (e) => loadDiagram(e.target.value));
el("btn-load-sample").addEventListener("click", () => loadDiagram("sample-falcon-reference"));
el("palette-search").addEventListener("input", (e) => renderPalette(e.target.value));

el("btn-export").addEventListener("click", openExport);
el("modal-close").addEventListener("click", closeExport);
el("export-modal").addEventListener("click", (e) => { if (e.target === el("export-modal")) closeExport(); });
for (const tab of document.querySelectorAll(".modal-tab")) tab.addEventListener("click", () => switchFormat(tab.dataset.format));
el("btn-copy").addEventListener("click", () => {
  const text = modal.format === "svg" ? modal.svg : modal.text;
  navigator.clipboard?.writeText(text);
  status("Copied to clipboard");
});
el("btn-download").addEventListener("click", doDownload);

el("zoom-in").addEventListener("click", () => zoomAt(1.2, canvas.getBoundingClientRect().left + canvas.clientWidth / 2, canvas.getBoundingClientRect().top + canvas.clientHeight / 2));
el("zoom-out").addEventListener("click", () => zoomAt(1 / 1.2, canvas.getBoundingClientRect().left + canvas.clientWidth / 2, canvas.getBoundingClientRect().top + canvas.clientHeight / 2));
el("zoom-fit").addEventListener("click", fitToContent);

window.addEventListener("keydown", (e) => {
  const tag = document.activeElement?.tagName;
  const typing = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
  if (e.key === "Escape") {
    closeExport();
    if (state.connectMode) toggleConnect();
    return;
  }
  if (typing) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) { e.preventDefault(); redo(); }
  else if (e.key === "Delete" || e.key === "Backspace") { if (state.selection) { e.preventDefault(); deleteSelected(); } }
  else if (e.key.toLowerCase() === "c") { toggleConnect(); }
});

window.addEventListener("resize", () => { setView(); render(); });

async function init() {
  setView();
  try {
    const res = await api("/api/catalog");
    state.catalog = await res.json();
    renderPalette();
    await refreshLoadList();
    await loadDiagram("sample-falcon-reference");
  } catch (err) {
    status(`Init failed: ${err.message}`);
    resetHistory();
    render();
  }
}
init();
