# Look & Feel — Replication Guide

This document explains **how the Architecture Diagram Builder gets its look and feel**, so you
can reproduce any part of it in another tool (including a single‑file HTML tool like the ones on
[thinkinfosec.org](https://thinkinfosec.org)). Everything here is **vanilla HTML/CSS/JS** — there
is no framework and no build step required to reuse it.

Each section is self‑contained: copy the tokens, copy a component recipe, or copy the canvas
engine on its own. Pointers to the real source files in this repo are given so you can see a
working reference.

- Styling & tokens: [`public/styles.css`](../public/styles.css)
- App logic (canvas, palette, export, history): [`public/app.js`](../public/app.js)
- Markup & modal: [`public/index.html`](../public/index.html)
- Deterministic exporters (Mermaid/D2/SVG): [`src/generators/`](../src/generators/)

---

## 1. Design tokens (the whole palette in one place)

The entire theme is driven by CSS custom properties on `:root`. Swap these and everything —
toolbar, palette, canvas, export modal, and the exported SVG — retints consistently. These values
were pulled from the ThinkInfoSec **light** theme (`--background-color: #f4f7f6`,
`--primary-color: #0077b5`, signature cyan `#00BFCF`).

```css
:root {
  /* Surfaces & lines */
  --bg: #f4f7f6;          /* app background   */
  --surface: #ffffff;     /* cards, panels    */
  --surface-2: #eef2f4;   /* insets, chips bg */
  --surface-3: #e3e9ed;   /* hover fills      */
  --border: #dddddd;
  --border-strong: #c4ccd4;

  /* Text */
  --text: #333333;
  --text-dim: #555555;
  --text-faint: #8a94a0;

  /* Brand */
  --accent: #0077b5;                       /* primary (buttons, focus, selection) */
  --accent-strong: #005a8c;                /* primary hover                       */
  --accent-weak: rgba(0, 119, 181, 0.12);  /* focus ring / tint                   */
  --cyan: #00bfcf;                         /* signature accent / logo highlight   */
  --magenta: #ff2d78;                      /* secondary accent (sparingly)        */
  --danger: #d64550;
  --ok: #12a150;

  /* Elevation, radius, type */
  --shadow: 0 6px 20px rgba(15, 40, 70, 0.08);
  --shadow-md: 0 10px 30px rgba(15, 40, 70, 0.12);
  --shadow-lg: 0 24px 60px rgba(15, 40, 70, 0.22);
  --r-sm: 6px; --r-md: 9px; --r-lg: 16px;
  --font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
```

**Category colors** (used for palette chips, node borders, and node icon chips) live in data, not
CSS, so the palette is extensible. See [`src/catalog.ts`](../src/catalog.ts):

| Category | Color |
| --- | --- |
| Endpoint & Workload | `#ef4444` |
| Identity | `#f59e0b` |
| Cloud & SaaS | `#38bdf8` |
| Network | `#22c55e` |
| SIEM / SOAR | `#a855f7` |
| Data & Telemetry | `#14b8a6` |
| Alliance Partner | `#e879f9` |

> **Dark variant:** flip `--bg → #0a0e14`, `--surface → #10151e`, `--text → #e6edf3`,
> `--border → #263140`, and keep the same accent. That is literally the only change needed to go
> back to the dark theme — no component CSS references raw colors, only tokens.

---

## 2. Layout shell

A fixed top bar over a three‑column grid (palette · canvas · inspector). The whole app fills the
viewport and never scrolls as a page; only the three columns scroll internally.

```css
body { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
.topbar { height: 60px; display: flex; align-items: center; gap: 16px; padding: 0 16px;
          background: var(--surface); border-bottom: 1px solid var(--border); }
.layout { flex: 1; display: grid; grid-template-columns: 264px 1fr 300px; min-height: 0; }
```

The `min-height: 0` on the grid is what lets the inner columns scroll instead of the page.

---

## 3. Component recipes

### 3.1 Toolbar: segmented groups + button styles

Actions are clustered into visually grouped "pills" (File / Edit / Insert) with a single, clearly
distinct **primary** button on the right. Grouping is done with a wrapper (`.tgroup`) rather than
labels, keeping the bar compact. Buttons are icon+label, ghost by default.

```css
.tgroup { display: flex; gap: 2px; padding: 3px; background: var(--surface-2);
          border: 1px solid var(--border); border-radius: 10px; }
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 9px;
       background: transparent; color: var(--text-dim); border: 1px solid transparent;
       border-radius: 6px; font: 550 0.82rem var(--font); cursor: pointer; }
.btn:hover { background: var(--surface); color: var(--accent); box-shadow: inset 0 0 0 1px var(--border); }
.btn[aria-pressed="true"] { background: var(--accent); color: #fff; border-color: var(--accent); }
.btn-primary { background: var(--accent); color: #fff; border-radius: 9px; padding: 8px 14px; font-weight: 650; }
.btn-primary:hover { background: var(--accent-strong); }
```

Icons are inline [Lucide‑style](https://lucide.dev) 24×24 SVGs with
`stroke="currentColor"`, so they inherit the button's text color automatically.

### 3.2 Palette: search + category groups + icon chips

Each block is a draggable row: a **colored chip with a white glyph**, then the label. The chip
color is the block's category color, which makes types scannable at a glance.

```css
.palette-block { display: flex; align-items: center; gap: 9px; width: 100%;
  background: var(--surface); border: 1px solid var(--border); border-radius: 9px;
  padding: 7px 9px; margin-bottom: 6px; cursor: grab; }
.palette-block:hover { border-color: var(--border-strong); box-shadow: var(--shadow); transform: translateY(-1px); }
.chip { width: 26px; height: 26px; border-radius: 7px; display: grid; place-items: center; }
```

### 3.3 Inspector: contextual panels

One panel per selection type (node / edge / zone). Show the relevant one, hide the rest, and fall
back to an empty‑state message. Inputs are bound on `input` (live) and committed to undo history
on `change` (see §7).

### 3.4 Export modal: tabbed output

A centered overlay with format tabs (Mermaid / D2 / SVG / PNG), a code/preview body, and a footer
with **Copy** and **Download**. Toggling `.open` shows it; clicking the backdrop or pressing `Esc`
closes it.

```css
.modal-backdrop { position: fixed; inset: 0; display: none; align-items: center; justify-content: center;
  background: rgba(15,40,70,0.35); backdrop-filter: blur(3px); z-index: 40; }
.modal-backdrop.open { display: flex; }
.modal { width: min(860px, 92vw); height: min(640px, 88vh); background: var(--surface);
  border-radius: var(--r-lg); box-shadow: var(--shadow-lg); display: flex; flex-direction: column; }
.modal-tab.active { color: var(--accent); border-bottom: 2px solid var(--accent); }
```

### 3.5 Small touches that sell the polish

- **Dot‑grid canvas background** (see §4) instead of a flat fill.
- **Status toast** — a pill that fades in top‑center for ~1.8s after each action.
- **Empty state** — a centered card prompting "drag a block… or load the sample."
- **Keyboard‑hint bar** — bottom‑left `<kbd>` chips advertising shortcuts.
- **Floating zoom control** — bottom‑right `− / % / + / fit` cluster.

---

## 4. The canvas engine (the reusable core)

This is the part most worth copying. It is a **single `<svg>` element** that is re‑rendered from a
plain state object. There is no canvas library.

### 4.1 Coordinate model: one SVG + `viewBox` for zoom/pan

Zoom and pan are just the SVG `viewBox`. Screen↔diagram coordinate conversion uses the browser's
own matrix (`getScreenCTM`), so it keeps working at any zoom/pan with no manual math.

```js
const state = { scale: 1, origin: { x: 0, y: 0 } /* , nodes, edges, zones … */ };

function setView() {
  const w = canvas.clientWidth / state.scale;
  const h = canvas.clientHeight / state.scale;
  canvas.setAttribute("viewBox", `${state.origin.x} ${state.origin.y} ${w} ${h}`);
  canvas.setAttribute("width", canvas.clientWidth);
  canvas.setAttribute("height", canvas.clientHeight);
}

// client (mouse) pixel -> diagram coordinate, valid at any zoom/pan:
function svgPoint(clientX, clientY) {
  const pt = canvas.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  return pt.matrixTransform(canvas.getScreenCTM().inverse());
}

// zoom toward the cursor (wheel handler calls this with factor 1.1 / (1/1.1)):
function zoomAt(factor, clientX, clientY) {
  const before = svgPoint(clientX, clientY);
  state.scale = clamp(state.scale * factor, 0.25, 3);
  const rect = canvas.getBoundingClientRect();
  state.origin.x = before.x - (clientX - rect.left) / state.scale;
  state.origin.y = before.y - (clientY - rect.top) / state.scale;
  setView();
}
```

Panning is `origin.x -= dxPixels / scale` on background drag. Fit‑to‑content computes the bounding
box of all nodes/zones and centers it (`fitToContent` in [`app.js`](../public/app.js)).
**Snap‑to‑grid** is one helper applied on drag: `const snap = v => Math.round(v / 8) * 8`.

### 4.2 Rendering: rebuild `innerHTML` from state

Every change calls `render()`, which builds an SVG string from the model and assigns it once to
`canvas.innerHTML`. This is deliberately simple (no virtual DOM / diffing) and is plenty fast for
diagram‑sized scenes. Interaction uses **event delegation**: one set of pointer listeners on the
`<svg>` reads `data-node` / `data-edge-hit` / `data-zone` / `data-connect-dot` from
`event.target.closest(...)`.

### 4.3 Node card recipe (SVG)

A node is a white rounded rect with a soft drop‑shadow, a **category‑colored icon chip**, a bold
label, and a small uppercase category caption.

```js
// soft shadow, defined once in <defs>:
// <filter id="ns"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#1e3a5f" flood-opacity="0.16"/></filter>

function nodeIcon(node, cx, cy) {              // colored chip + white glyph
  const cat = blockType(node.type)?.category;
  const size = 30, x = node.x + 12, y = cy - size / 2;
  const iconSize = 18, s = iconSize / 24;
  const tx = x + (size - iconSize) / 2, ty = y + (size - iconSize) / 2;
  return `<rect x="${x}" y="${y}" width="${size}" height="${size}" rx="8" fill="${categoryColor(cat)}"/>` +
    `<g transform="translate(${tx.toFixed(2)},${ty.toFixed(2)}) scale(${s.toFixed(3)})" ` +
    `stroke="#fff" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconPaths(cat)}</g>`;
}

// in render(), per node:
// <rect filter="url(#ns)" ... rx="12" fill="#fff" stroke="${sel ? '#0077b5' : color}" .../>
// nodeIcon(...) + <text> label (#22303f, 600) + <text> caption (#8a94a0, 10px UPPERCASE)
```

### 4.4 The category icon set

Recognizable glyphs drawn in a 24×24 box, keyed by category. `iconPaths(cat)` returns the inner
markup; wrap it in a colored chip (canvas) or an `<svg stroke="#fff">` (HTML palette).

```js
const ICONS = {
  endpoint: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8 20h8M12 16v4"/>',
  identity: '<circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/>',
  cloud:    '<path d="M7 18a4 4 0 0 1 .5-8 5 5 0 0 1 9.5 1.5A3.5 3.5 0 0 1 17 18z"/>',
  network:  '<circle cx="6" cy="12" r="2.3"/><circle cx="18" cy="6" r="2.3"/><circle cx="18" cy="18" r="2.3"/><path d="M8.2 10.9 15.8 7.1M8.2 13.1l7.6 3.8"/>',
  siem:     '<path d="M3 12h4l2.5-7 5 14 2.5-7H21"/>',
  data:     '<ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3"/>',
  alliance: '<path d="M9.5 14.5l5-5"/><path d="M11 6.5 12.5 5a3.5 3.5 0 0 1 5 5L16 11.5M13 17.5 11.5 19a3.5 3.5 0 0 1-5-5L8 12.5"/>',
};
const iconPaths = (cat) => ICONS[cat] || '<circle cx="12" cy="12" r="6"/>';
```

### 4.5 Edges: center‑to‑border clipping + arrow marker

Draw a line from one node's border to the other's so arrows touch the box edge (not the center).
The clip point is the intersection of the center‑to‑center line with the source rectangle:

```js
function borderPoint(node, tx, ty) {
  const cx = node.x + node.w / 2, cy = node.y + node.h / 2;
  const dx = tx - cx, dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? node.w / 2 / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? node.h / 2 / Math.abs(dy) : Infinity;
  const t = Math.min(sx, sy);
  return { x: cx + dx * t, y: cy + dy * t };
}
```

Each edge is drawn as a wide **transparent hit line** (easy clicking) plus the visible line with
`marker-end="url(#arrow)"`, and an optional rounded label chip at the midpoint. Dashed style is
just `stroke-dasharray="7 5"`.

### 4.6 Drag‑to‑connect (the key interaction)

When a node is selected, render 4 handles at its edge midpoints. Each handle is a **large
transparent hit circle** (easy to grab) plus a small visible dot:

```js
// r=11 transparent hit target + r=5.5 visible dot, both carry data-connect-dot=<nodeId>
parts.push(`<circle data-connect-dot="${n.id}" cx="${dx}" cy="${dy}" r="11" fill="transparent" style="cursor:crosshair"/>`);
parts.push(`<circle class="connect-dot" data-connect-dot="${n.id}" cx="${dx}" cy="${dy}" r="5.5"/>`);
```

Pointer flow (single delegated handler on the `<svg>`):

1. `pointerdown` on `[data-connect-dot]` → start a "connect" drag from that node; append a temporary
   dashed `<line>` that follows the cursor.
2. `pointermove` → update the temp line's end to `svgPoint(clientX, clientY)`.
3. `pointerup` → `document.elementFromPoint(x, y).closest('[data-node]')` finds the drop target; if
   it's a different node, create the edge. Otherwise cancel.

The same `pointerdown` handler also handles: dragging nodes/zones (with snap), selecting edges, and
panning the background — chosen by which `data-*` ancestor the target has.

---

## 5. Export architecture (model → text/vector)

Exports are **pure functions of the diagram model** (`{ title, zones[], nodes[], edges[] }`), which
makes them deterministic and unit‑testable. In this repo they run server‑side
([`src/generators/`](../src/generators/)) and are called over `POST /api/export/:format`, but the
functions are plain and can be **inlined directly into a single‑file tool** — they have no server
dependencies.

- **Mermaid** — `flowchart TD`; zones become `subgraph`s; node shape depends on the block shape
  (`["…"]` rect, `("…")` rounded, `{{"…"}}` hexagon, `[("…")]` cylinder); edges are `-->` / `-.->`
  with optional `|label|`.
- **D2** — zones are containers; zoned nodes are referenced by `zone.node`; dashed edges add
  `style.stroke-dash: 3`.
- **SVG** — uses each node's `x/y/w/h` directly (no auto‑layout needed), same node‑card styling as
  the canvas, so the export matches what you see.

A deterministic, collision‑free id sanitizer keeps output stable (see
[`src/generators/util.ts`](../src/generators/util.ts)).

### PNG without any library

Render the SVG to an `Image`, draw it to a 2× canvas, and export a data URL:

```js
function svgToImage(svg) {
  return new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => res(img); img.onerror = rej;
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
  });
}
// then: canvas 2× → ctx.scale(2,2) → ctx.drawImage(img,0,0) → canvas.toDataURL("image/png")
```

---

## 6. Undo / redo (snapshot stack)

Serialize the model to a JSON string after each discrete change; keep a stack + index. It is small,
robust, and framework‑free.

```js
const history = { stack: [], index: -1 };
const snapshot = () => JSON.stringify({ id: state.id, title: state.title, zones: state.zones, nodes: state.nodes, edges: state.edges });
function commit() {                       // call after add / delete / move-end / label change
  history.stack = history.stack.slice(0, history.index + 1);
  history.stack.push(snapshot());
  history.index = history.stack.length - 1;
}
function undo() { if (history.index > 0) restore(history.stack[--history.index]); }
function redo() { if (history.index < history.stack.length - 1) restore(history.stack[++history.index]); }
```

Bind `Ctrl/Cmd+Z` / `Ctrl/Cmd+Y` (and `Shift+Z`) in a `keydown` handler, ignoring events while an
input is focused.

---

## 7. UX heuristics applied (why it feels good)

- **One primary action.** Only *Export* is filled/blue; everything else is ghost. Users always know
  the main path.
- **Recognition over recall.** Category colors + icons on both palette and canvas; visible keyboard
  hints; contextual inspector.
- **Direct manipulation.** Drag from palette to add; drag handles to connect; drag to move; scroll
  to zoom. Snap‑to‑grid keeps things tidy.
- **Immediate feedback.** Status toasts, selection rings, hover elevation, live‑updating labels.
- **Forgiveness.** Undo/redo, `Esc` to cancel connect/close modal, non‑destructive validation with
  actionable error messages.
- **Accessibility.** Token‑based contrast, focus rings via `--accent-weak`, `aria-pressed` on
  toggles, `role="group"`/`aria-label` on toolbar clusters and the dialog.

---

## 8. Porting into your single‑file tool — checklist

Your hub tools are single `index.html` files, so adoption is incremental — take only what you want:

1. **Theme in 30 seconds.** Paste the `:root` tokens from §1 and replace hard‑coded colors with
   `var(--…)`. This alone gives the biggest visual lift and lets you flip light/dark from one place.
2. **Buttons & toolbar.** Copy `.tgroup`, `.btn`, `.btn-primary` (§3.1) and wrap existing buttons in
   a `.tgroup`. Make your main action `.btn-primary`.
3. **Palette chips.** Copy `.palette-block` + `.chip` and the `ICONS` map (§3.2, §4.4).
4. **Canvas engine.** If your tool draws SVG, adopt the `viewBox` zoom/pan (§4.1), the `render()`
   from‑state pattern (§4.2), and `borderPoint` (§4.5). These are dependency‑free.
5. **Drag‑to‑connect.** Copy the handle markup + pointer flow (§4.6).
6. **Export modal + PNG.** Copy the modal CSS (§3.4) and the `svgToImage` PNG trick (§5).
7. **Undo/redo.** Drop in the snapshot stack (§6).

No bundler, transpiler, or dependencies are required for any of the above — it is all standard
browser APIs. The TypeScript in `src/` is only for the optional server‑side API and tests; the
exporter logic itself is plain functions you can copy into client‑side JS.

---

## 9. File map

| Concern | File |
| --- | --- |
| Design tokens, all component CSS | [`public/styles.css`](../public/styles.css) |
| Markup, toolbar, inspector, export modal | [`public/index.html`](../public/index.html) |
| Canvas render, zoom/pan, drag, connect, export modal, undo/redo, icons | [`public/app.js`](../public/app.js) |
| Block catalog (categories + colors + types) | [`src/catalog.ts`](../src/catalog.ts) |
| Diagram model + validation | [`src/model.ts`](../src/model.ts) |
| Mermaid / D2 / SVG exporters | [`src/generators/`](../src/generators/) |
| Seed sample diagram | [`src/store.ts`](../src/store.ts) |
