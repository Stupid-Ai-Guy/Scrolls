"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import katex from "katex";
import { ComputeEngine } from "@cortex-js/compute-engine";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { oneDark } from "@codemirror/theme-one-dark";
// KaTeX stylesheet is loaded by the root layout (src/app/layout.tsx) so
// it's present on every page before this client component renders.
import type { Scene, SceneShape } from "@/lib/lesson-content";

const COLORS: Record<string, string> = {
  slate: "#94a3b8",
  emerald: "#10b981",
  rose: "#f43f5e",
  sky: "#0ea5e9",
  amber: "#f59e0b",
  red: "#ef4444",
  blue: "#3b82f6",
  green: "#22c55e",
  indigo: "#6366f1",
  violet: "#8b5cf6",
  cyan: "#22d3ee",
};
const COLOR_NAMES = Object.keys(COLORS);

const W = 720;
const H = 460;

export const DEFAULT_SCENE: Scene = {
  view: { xmin: -8, xmax: 8, ymin: -6, ymax: 6 },
  shapes: [],
};

function uid() {
  return crypto.randomUUID().slice(0, 8);
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

// 0.01 precision — used for dimensions (radius, width, height) so the user
// can drag shapes below the 0.1 floor that `round` snaps positions to.
function roundFine(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ---------------- LaTeX function-expression evaluator ----------------
// Cortex Compute Engine parses LaTeX natively and knows every math command
// without us listing any (\sin, \frac, \sqrt, \pi, \binom, |x|, ...). For
// each sample point we substitute x and ask for a numeric value; valueOf()
// returns a JS number when the result is real, or a string for symbolic /
// complex / infinity outputs (which we treat as a gap in the curve).
const ce = new ComputeEngine();
const fnCache = new Map<string, ((x: number) => number) | null>();

// Function-space sample cache. Each entry holds the pre-computed y values
// for one (expr, xmin, xmax, samples) tuple — independent of box position
// or pixel coords, so moving / resizing the box hits this cache and only
// the (cheap) pixel mapping reruns.
const SAMPLE_CACHE_LIMIT = 32;
const sampleCache = new Map<string, Float64Array>();

function getFunctionSamples(
  expr: string,
  xmin: number,
  xmax: number,
  samples: number,
): Float64Array | null {
  const key = `${expr}|${xmin}|${xmax}|${samples}`;
  const cached = sampleCache.get(key);
  if (cached) return cached;
  const fn = compileExpr(expr);
  if (!fn) return null;
  const ys = new Float64Array(samples);
  const span = xmax - xmin;
  const denom = Math.max(1, samples - 1);
  for (let i = 0; i < samples; i++) {
    ys[i] = fn(xmin + (span * i) / denom);
  }
  if (sampleCache.size >= SAMPLE_CACHE_LIMIT) {
    const oldest = sampleCache.keys().next().value;
    if (oldest !== undefined) sampleCache.delete(oldest);
  }
  sampleCache.set(key, ys);
  return ys;
}

// KaTeX renderToString is fast individually but adds up across all latex /
// function shapes on every parent re-render. Memoize by source string.
const KATEX_CACHE_LIMIT = 128;
const katexCache = new Map<string, string>();

function renderKatexCached(src: string): string {
  const cached = katexCache.get(src);
  if (cached !== undefined) return cached;
  let html: string;
  try {
    html = katex.renderToString(src, {
      throwOnError: false,
      displayMode: false,
      output: "html",
    });
  } catch {
    html = `<span>${escapeHtml(src)}</span>`;
  }
  if (katexCache.size >= KATEX_CACHE_LIMIT) {
    const oldest = katexCache.keys().next().value;
    if (oldest !== undefined) katexCache.delete(oldest);
  }
  katexCache.set(src, html);
  return html;
}

function compileExpr(raw: string): ((x: number) => number) | null {
  const cached = fnCache.get(raw);
  if (cached !== undefined) return cached;
  if (!raw.trim()) {
    fnCache.set(raw, null);
    return null;
  }
  let expr: ReturnType<typeof ce.parse>;
  try {
    expr = ce.parse(raw);
  } catch {
    fnCache.set(raw, null);
    return null;
  }
  const json = expr.json;
  if (Array.isArray(json) && json[0] === "Error") {
    fnCache.set(raw, null);
    return null;
  }
  const fn = (x: number) => {
    try {
      const v = expr.subs({ x }).N().valueOf();
      return typeof v === "number" ? v : NaN;
    } catch {
      return NaN;
    }
  };
  // Probe a few x values: if the result never resolves to a real number,
  // the expression probably isn't a function of x (e.g. user typed
  // `\sin(t)`) and we should mark it invalid so the canvas shows the
  // error badge instead of an empty plot.
  if ([0, 1, -1, 0.5].every((p) => Number.isNaN(fn(p)))) {
    fnCache.set(raw, null);
    return null;
  }
  fnCache.set(raw, fn);
  return fn;
}

function makeShape(kind: SceneShape["kind"], wx: number, wy: number): SceneShape {
  const id = uid();
  switch (kind) {
    case "point":
      return { id, kind, x: round(wx), y: round(wy), color: "emerald", label: "" };
    case "line":
      return {
        id,
        kind,
        x1: round(wx - 2),
        y1: round(wy),
        x2: round(wx + 2),
        y2: round(wy),
        color: "sky",
      };
    case "polyline":
      return {
        id,
        kind,
        vertices: [
          { x: round(wx - 2), y: round(wy) },
          { x: round(wx), y: round(wy) },
          { x: round(wx), y: round(wy + 2) },
        ],
        color: "sky",
      };
    case "circle":
      return {
        id,
        kind,
        cx: round(wx),
        cy: round(wy),
        r: 2,
        color: "emerald",
        label: "",
      };
    case "rect":
      return {
        id,
        kind,
        cx: round(wx),
        cy: round(wy),
        w: 3,
        h: 2,
        color: "slate",
        label: "",
      };
    case "text":
      return { id, kind, x: round(wx), y: round(wy), text: "Text", color: "slate" };
    case "latex":
      return {
        id,
        kind,
        x: round(wx),
        y: round(wy),
        code: "x^2 + y^2 = r^2",
        color: "slate",
      };
    case "button":
      return {
        id,
        kind,
        cx: round(wx),
        cy: round(wy),
        w: 3,
        h: 1.5,
        label: "Click",
        buttonId: `btn-${id}`,
        color: "amber",
      };
    case "function":
      return {
        id,
        kind,
        x: round(wx),
        y: round(wy),
        w: 8,
        h: 6,
        expr: "\\sin(x)",
        color: "sky",
        xmin: -4,
        xmax: 4,
        ymin: -3,
        ymax: 3,
      };
    case "code":
      return {
        id,
        kind,
        x: round(wx),
        y: round(wy),
        w: 10,
        h: 8,
        source:
          "// Drop an Output shape on the canvas, then press Run.\n" +
          "// `ctx` is a CanvasRenderingContext2D; `width` and `height` are\n" +
          "// the Output box's size in CSS pixels.\n" +
          "\n" +
          "ctx.fillStyle = '#22d3ee';\n" +
          "ctx.fillRect(20, 20, 80, 50);\n" +
          "\n" +
          "ctx.strokeStyle = '#f59e0b';\n" +
          "ctx.lineWidth = 3;\n" +
          "ctx.beginPath();\n" +
          "ctx.arc(width / 2, height / 2, 30, 0, Math.PI * 2);\n" +
          "ctx.stroke();\n",
        color: "amber",
      };
    case "output":
      return {
        id,
        kind,
        x: round(wx),
        y: round(wy),
        w: 10,
        h: 8,
        color: "emerald",
      };
  }
}

// ---------------- Icons ----------------

function CursorIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      strokeLinecap="round"
    >
      <path d="M4 3 L20 11 L13 13 L11 20 Z" />
    </svg>
  );
}

function ShapesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="9" cy="9" r="5" />
      <rect x="10" y="10" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function LineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="4" y1="20" x2="20" y2="4" />
      <circle cx="4" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="4" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function PolylineIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4,20 12,8 20,16" />
      <circle cx="4" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="8" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="20" cy="16" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontSize="18"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui"
      >
        T
      </text>
    </svg>
  );
}

function ViewportIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* corner brackets — like a camera viewfinder */}
      <path d="M4 8 V4 H8" />
      <path d="M20 8 V4 H16" />
      <path d="M4 16 V20 H8" />
      <path d="M20 16 V20 H16" />
    </svg>
  );
}

function LatexIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <text
        x="12"
        y="18"
        textAnchor="middle"
        fontSize="11"
        fontWeight="800"
        fontFamily="'Computer Modern', 'Latin Modern Math', Cambria, Georgia, serif"
        fontStyle="italic"
      >
        TeX
      </text>
    </svg>
  );
}

function FunctionIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* y = sin(x)-like curve */}
      <path d="M3 12 Q 7 4, 12 12 T 21 12" />
      <line x1="3" y1="20" x2="21" y2="20" opacity="0.4" />
      <line x1="3" y1="4" x2="3" y2="20" opacity="0.4" />
    </svg>
  );
}

function JsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* angle brackets + slash, the universal "code" glyph */}
      <path d="M8 6 L3 12 L8 18" />
      <path d="M16 6 L21 12 L16 18" />
      <path d="M14 5 L10 19" opacity="0.6" />
    </svg>
  );
}

function OutputIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* small display/monitor with a mark inside */}
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 21h8" />
      <path d="M12 17v4" />
      <path d="M7.5 11.5l2.5 2 3.5-4.5 3.5 4.5" opacity="0.7" />
    </svg>
  );
}

function ButtonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <rect x="3" y="6" width="18" height="10" rx="2.5" />
      <path d="M9 19 L13 15 L17 19" />
    </svg>
  );
}

function PointIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
      <circle cx="12" cy="12" r="5" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
    >
      <rect x="4" y="6" width="16" height="12" rx="2" />
    </svg>
  );
}

// ---------------- Drag types ----------------

type ResizeHandle =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "t"
  | "r"
  | "b"
  | "l"
  | "end1"
  | "end2"
  | "radius"
  | "v0"
  | "v1"
  | "v2";

type DragState =
  | {
      type: "move";
      shapeId: string;
      originals: { id: string; shape: SceneShape }[];
      startWX: number;
      startWY: number;
    }
  | {
      type: "resize";
      shapeId: string;
      original: SceneShape;
      handle: ResizeHandle;
      startWX: number;
      startWY: number;
    }
  | {
      type: "marquee";
      startWX: number;
      startWY: number;
      currentWX: number;
      currentWY: number;
      shiftKey: boolean;
    }
  | {
      type: "viewport";
      startWX: number;
      startWY: number;
      currentWX: number;
      currentWY: number;
    };

// ---------------- Canvas ----------------

type ActiveTool = "select" | "viewport" | SceneShape["kind"];

type RendererProps = {
  scene: Scene;
  selectedId?: string;
  selectedIds?: string[];
  editingLatexId?: string;
  clickedButtonId?: string;
  activeTool?: ActiveTool;
  spacePan?: boolean;
  onSelect?: (id: string | null, opts?: { additive?: boolean }) => void;
  onSelectMany?: (ids: string[]) => void;
  onUpdateShape?: (id: string, patch: Partial<SceneShape>) => void;
  onUpdateShapes?: (
    updates: { id: string; patch: Partial<SceneShape> }[],
  ) => void;
  onPlaceShape?: (kind: SceneShape["kind"], wx: number, wy: number) => void;
  onSetView?: (view: { xmin: number; xmax: number; ymin: number; ymax: number }) => void;
  onCommitTool?: (tool: ActiveTool) => void;
  onClickButton?: (buttonId: string) => void;
  onDuplicateShape?: (id: string) => void;
  onRemoveShape?: (id: string) => void;
  onBeginEdit?: () => void;
  onReorderShape?: (
    id: string,
    direction: "front" | "back" | "forward" | "backward",
  ) => void;
};

function shapeTopAnchor(s: SceneShape): { x: number; y: number } {
  if (s.kind === "point" || s.kind === "text" || s.kind === "latex")
    return { x: s.x, y: s.y };
  if (s.kind === "function" || s.kind === "code" || s.kind === "output") {
    const h = s.h ?? (s.kind === "function" ? 6 : 8);
    return { x: s.x, y: s.y + h / 2 };
  }
  if (s.kind === "line")
    return { x: (s.x1 + s.x2) / 2, y: Math.max(s.y1, s.y2) };
  if (s.kind === "polyline") {
    const xs = s.vertices.map((v) => v.x);
    const ys = s.vertices.map((v) => v.y);
    return { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: Math.max(...ys) };
  }
  if (s.kind === "circle") return { x: s.cx, y: s.cy + s.r };
  return { x: s.cx, y: s.cy + s.h / 2 };
}

function shapeBBox(s: SceneShape): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  if (s.kind === "point" || s.kind === "text" || s.kind === "latex") {
    return { minX: s.x, minY: s.y, maxX: s.x, maxY: s.y };
  }
  if (s.kind === "function" || s.kind === "code" || s.kind === "output") {
    const defaultW = s.kind === "function" ? 8 : 10;
    const defaultH = s.kind === "function" ? 6 : 8;
    const w = s.w ?? defaultW;
    const h = s.h ?? defaultH;
    return {
      minX: s.x - w / 2,
      minY: s.y - h / 2,
      maxX: s.x + w / 2,
      maxY: s.y + h / 2,
    };
  }
  if (s.kind === "line") {
    return {
      minX: Math.min(s.x1, s.x2),
      minY: Math.min(s.y1, s.y2),
      maxX: Math.max(s.x1, s.x2),
      maxY: Math.max(s.y1, s.y2),
    };
  }
  if (s.kind === "polyline") {
    const xs = s.vertices.map((v) => v.x);
    const ys = s.vertices.map((v) => v.y);
    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  }
  if (s.kind === "circle") {
    return {
      minX: s.cx - s.r,
      minY: s.cy - s.r,
      maxX: s.cx + s.r,
      maxY: s.cy + s.r,
    };
  }
  return {
    minX: s.cx - s.w / 2,
    minY: s.cy - s.h / 2,
    maxX: s.cx + s.w / 2,
    maxY: s.cy + s.h / 2,
  };
}

function SceneCanvas({
  scene,
  selectedId,
  selectedIds,
  editingLatexId,
  clickedButtonId,
  activeTool = "select",
  spacePan = false,
  onSelect,
  onSelectMany,
  onUpdateShape,
  onUpdateShapes,
  onPlaceShape,
  onSetView,
  onCommitTool,
  onClickButton,
  onDuplicateShape,
  onRemoveShape,
  onBeginEdit,
  onReorderShape,
}: RendererProps) {
  const selectedSet = useMemo(
    () => new Set(selectedIds ?? (selectedId ? [selectedId] : [])),
    [selectedIds, selectedId],
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
  // Set by beginMove / beginResize so the click event that bubbles to the
  // SVG after a shape/handle mousedown doesn't run the empty-canvas
  // deselect logic.
  const clickedInteractiveRef = useRef(false);
  const [view, setView] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [, forceTick] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    shapeId: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (!contextMenu) return;
    function close() {
      setContextMenu(null);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("scroll", close, true);
    };
  }, [contextMenu]);

  const editable = !!onUpdateShape;

  // Trigger a re-render once refs are populated, and on container resize, so
  // the floating action menu's pixel position stays accurate.
  useEffect(() => {
    forceTick((t) => t + 1);
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => forceTick((t) => t + 1));
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Non-passive wheel listener so we can preventDefault and intercept the page
  // scroll. Only attached in editor mode.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !editable) return;

    function onWheel(e: WheelEvent) {
      e.preventDefault();
      const target = e.currentTarget as SVGSVGElement;
      const rect = target.getBoundingClientRect();
      const fx = (e.clientX - rect.left) / rect.width;
      const fy = (e.clientY - rect.top) / rect.height;

      if (e.ctrlKey || e.metaKey) {
        // Zoom (ctrl/cmd + wheel, or trackpad pinch)
        const factor = e.deltaY > 0 ? 1 / 1.15 : 1.15;
        setView((v) => {
          const newZ = Math.max(0.3, Math.min(5, v.zoom * factor));
          if (newZ === v.zoom) return v;
          const vbW = W / v.zoom;
          const vbH = H / v.zoom;
          // World SVG coord under cursor with old viewBox
          const cx = v.panX + fx * vbW;
          const cy = v.panY + fy * vbH;
          const newVbW = W / newZ;
          const newVbH = H / newZ;
          return {
            zoom: newZ,
            panX: cx - fx * newVbW,
            panY: cy - fy * newVbH,
          };
        });
      } else {
        // Pan: vertical scroll → vertical pan, horizontal scroll → horizontal pan
        setView((v) => {
          const vbW = W / v.zoom;
          const vbH = H / v.zoom;
          return {
            ...v,
            panX: v.panX + (e.deltaX / rect.width) * vbW,
            panY: v.panY + (e.deltaY / rect.height) * vbH,
          };
        });
      }
    }

    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, [editable]);

  const { xmin, xmax, ymin, ymax } = scene.view;
  const dx = xmax - xmin;
  const dy = ymax - ymin;
  const toX = (wx: number) => ((wx - xmin) / dx) * W;
  const toY = (wy: number) => ((ymax - wy) / dy) * H;

  const vbW = W / view.zoom;
  const vbH = H / view.zoom;

  function svgToWorld(clientX: number, clientY: number): [number, number] {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const fx = (clientX - rect.left) / rect.width;
    const fy = (clientY - rect.top) / rect.height;
    const sx = view.panX + fx * vbW;
    const sy = view.panY + fy * vbH;
    const wx = (sx / W) * dx + xmin;
    const wy = ymax - (sy / H) * dy;
    return [wx, wy];
  }

  function resetView() {
    setView({ zoom: 1, panX: 0, panY: 0 });
  }

  function worldToContainerPx(
    wx: number,
    wy: number,
  ): { x: number; y: number } | null {
    const svg = svgRef.current;
    const container = containerRef.current;
    if (!svg || !container) return null;
    const svgRect = svg.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const sx = toX(wx);
    const sy = toY(wy);
    const fx = (sx - view.panX) / vbW;
    const fy = (sy - view.panY) / vbH;
    return {
      x: svgRect.left - containerRect.left + fx * svgRect.width,
      y: svgRect.top - containerRect.top + fy * svgRect.height,
    };
  }

  // Compute floating action menu position (above selected shape's top edge)
  const selectedShape = scene.shapes.find((s) => s.id === selectedId);
  const singleSelected = selectedSet.size === 1;
  const showFloatingMenu =
    editable &&
    selectedShape &&
    singleSelected &&
    activeTool === "select" &&
    !isDragging;
  let floatingPos: { x: number; y: number } | null = null;
  if (showFloatingMenu && selectedShape) {
    const anchor = shapeTopAnchor(selectedShape);
    floatingPos = worldToContainerPx(anchor.x, anchor.y);
  }

  function beginMove(e: React.MouseEvent, shape: SceneShape) {
    if (!onUpdateShape || activeTool !== "select" || spacePan) return;
    e.stopPropagation();
    clickedInteractiveRef.current = true;

    if (e.shiftKey) {
      // Toggle this shape in/out of the multi-selection; do not start a drag.
      onSelect?.(shape.id, { additive: true });
      return;
    }

    const wasSelected = selectedSet.has(shape.id);
    if (!wasSelected) {
      onSelect?.(shape.id);
    }
    onBeginEdit?.();
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);

    // Drag set: if the clicked shape was already part of a multi-selection,
    // drag the whole group; otherwise drag just this shape.
    const dragIds =
      wasSelected && selectedSet.size > 1
        ? Array.from(selectedSet)
        : [shape.id];
    const originals = dragIds
      .map((id) => scene.shapes.find((s) => s.id === id))
      .filter((s): s is SceneShape => !!s)
      .map((s) => ({ id: s.id, shape: s }));

    dragRef.current = {
      type: "move",
      shapeId: shape.id,
      originals,
      startWX: wx,
      startWY: wy,
    };
    movedRef.current = false;
    setIsDragging(true);
  }

  function beginResize(e: React.MouseEvent, shape: SceneShape, handle: ResizeHandle) {
    if (!onUpdateShape) return;
    e.stopPropagation();
    clickedInteractiveRef.current = true;
    onBeginEdit?.();
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);
    dragRef.current = {
      type: "resize",
      shapeId: shape.id,
      original: shape,
      handle,
      startWX: wx,
      startWY: wy,
    };
    movedRef.current = false;
    setIsDragging(true);
  }

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const d = dragRef.current;
    if (!d) return;
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);

    if (d.type === "marquee" || d.type === "viewport") {
      if (
        Math.abs(wx - d.currentWX) < 0.01 &&
        Math.abs(wy - d.currentWY) < 0.01
      ) {
        return;
      }
      d.currentWX = wx;
      d.currentWY = wy;
      movedRef.current = true;
      forceTick((t) => t + 1);
      return;
    }
    if (!onUpdateShape) return;

    if (d.type === "move") {
      const dxw = wx - d.startWX;
      const dyw = wy - d.startWY;
      if (Math.abs(dxw) < 0.01 && Math.abs(dyw) < 0.01) return;
      movedRef.current = true;
      if (d.originals.length > 1 && onUpdateShapes) {
        const updates = d.originals.map(({ id, shape }) => ({
          id,
          patch: movePatch(shape, dxw, dyw),
        }));
        onUpdateShapes(updates);
      } else {
        const o = d.originals[0];
        if (o) onUpdateShape(o.id, movePatch(o.shape, dxw, dyw));
      }
    } else {
      movedRef.current = true;
      const patch = resizePatch(d.original, d.handle, wx, wy);
      if (patch) onUpdateShape(d.shapeId, patch);
    }
  }

  function handleMouseUp() {
    const d = dragRef.current;
    if (d?.type === "viewport") {
      if (movedRef.current && onSetView) {
        const xmin = Math.min(d.startWX, d.currentWX);
        const xmax = Math.max(d.startWX, d.currentWX);
        const ymin = Math.min(d.startWY, d.currentWY);
        const ymax = Math.max(d.startWY, d.currentWY);
        // Guard against degenerate rectangles.
        if (xmax - xmin > 0.5 && ymax - ymin > 0.5) {
          onSetView({ xmin, xmax, ymin, ymax });
          setView({ zoom: 1, panX: 0, panY: 0 });
          onCommitTool?.("select");
        }
      }
      dragRef.current = null;
      return;
    }
    if (d?.type === "marquee") {
      if (movedRef.current) {
        const minX = Math.min(d.startWX, d.currentWX);
        const maxX = Math.max(d.startWX, d.currentWX);
        const minY = Math.min(d.startWY, d.currentWY);
        const maxY = Math.max(d.startWY, d.currentWY);
        // AABB intersection — any overlap with the marquee counts. More
        // forgiving than requiring the shape to be fully enclosed.
        const ids = scene.shapes
          .filter((s) => {
            const b = shapeBBox(s);
            return (
              b.maxX >= minX &&
              b.minX <= maxX &&
              b.maxY >= minY &&
              b.minY <= maxY
            );
          })
          .map((s) => s.id);
        if (d.shiftKey) {
          const merged = new Set<string>([...selectedSet, ...ids]);
          onSelectMany?.(Array.from(merged));
        } else {
          if (ids.length > 0) onSelectMany?.(ids);
          else onSelect?.(null);
        }
      }
    }
    dragRef.current = null;
    if (isDragging) setIsDragging(false);
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (clickedInteractiveRef.current) {
      // Click was on a shape or resize handle; beginMove/beginResize already
      // updated selection. Don't run the empty-canvas deselect.
      clickedInteractiveRef.current = false;
      return;
    }
    if (spacePan) return;
    if (
      activeTool !== "select" &&
      activeTool !== "viewport" &&
      onPlaceShape
    ) {
      const [wx, wy] = svgToWorld(e.clientX, e.clientY);
      onPlaceShape(activeTool, wx, wy);
      return;
    }
    if (activeTool === "viewport") return;
    if (e.shiftKey) return;
    onSelect?.(null);
  }

  // Spacebar+drag = pan
  const panDragRef = useRef<{ startX: number; startY: number } | null>(null);
  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (spacePan) {
      panDragRef.current = { startX: e.clientX, startY: e.clientY };
      movedRef.current = false;
      return;
    }
    // Start a marquee on empty-canvas mousedown when using the Select tool.
    // (Shape mousedown handlers stopPropagation, so this only fires on empty.)
    if (activeTool === "select" && onUpdateShape) {
      const [wx, wy] = svgToWorld(e.clientX, e.clientY);
      dragRef.current = {
        type: "marquee",
        startWX: wx,
        startWY: wy,
        currentWX: wx,
        currentWY: wy,
        shiftKey: e.shiftKey,
      };
      movedRef.current = false;
      return;
    }
    // Viewport tool: drag a rect that becomes the new scene.view.
    if (activeTool === "viewport" && onSetView) {
      const [wx, wy] = svgToWorld(e.clientX, e.clientY);
      dragRef.current = {
        type: "viewport",
        startWX: wx,
        startWY: wy,
        currentWX: wx,
        currentWY: wy,
      };
      movedRef.current = false;
    }
  }
  function handlePanMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!panDragRef.current) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const dxPx = e.clientX - panDragRef.current.startX;
    const dyPx = e.clientY - panDragRef.current.startY;
    if (Math.abs(dxPx) < 1 && Math.abs(dyPx) < 1) return;
    panDragRef.current.startX = e.clientX;
    panDragRef.current.startY = e.clientY;
    movedRef.current = true;
    setView((v) => ({
      ...v,
      panX: v.panX - (dxPx / rect.width) * (W / v.zoom),
      panY: v.panY - (dyPx / rect.height) * (H / v.zoom),
    }));
  }
  function handlePanUp() {
    panDragRef.current = null;
  }

  function handleShapeContextMenu(
    e: React.MouseEvent<SVGGElement>,
    shape: SceneShape,
  ) {
    if (!editable) return;
    e.preventDefault();
    e.stopPropagation();
    onSelect?.(shape.id);
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    setContextMenu({
      shapeId: shape.id,
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }

  const placementMode = activeTool !== "select" && !spacePan;

  const viewIsDefault = view.zoom === 1 && view.panX === 0 && view.panY === 0;

  return (
    <div ref={containerRef} className="relative overflow-hidden">
      {editable && !viewIsDefault && (
        <button
          type="button"
          onClick={resetView}
          className="absolute right-4 top-4 z-10 rounded-full bg-zinc-900/90 px-3 py-1 text-[10px] font-medium text-zinc-300 shadow-lg shadow-black/40 ring-1 ring-white/5 backdrop-blur transition hover:bg-zinc-800 hover:text-zinc-100"
          title="Reset zoom and pan"
        >
          {Math.round(view.zoom * 100)}% · Reset
        </button>
      )}

      {contextMenu && editable && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onDuplicate={
            onDuplicateShape
              ? () => {
                  onDuplicateShape(contextMenu.shapeId);
                  setContextMenu(null);
                }
              : undefined
          }
          onRemove={
            onRemoveShape
              ? () => {
                  onRemoveShape(contextMenu.shapeId);
                  setContextMenu(null);
                }
              : undefined
          }
          onReorder={
            onReorderShape
              ? (dir) => {
                  onReorderShape(contextMenu.shapeId, dir);
                  setContextMenu(null);
                }
              : undefined
          }
        />
      )}

      {showFloatingMenu && floatingPos && (
        <div
          className="pointer-events-none absolute z-30"
          style={{
            left: floatingPos.x,
            top: floatingPos.y - 14,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="pointer-events-auto flex items-center gap-0.5 rounded-full bg-zinc-900/95 p-1 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur">
            <button
              type="button"
              onClick={() => selectedShape && onDuplicateShape?.(selectedShape.id)}
              title="Duplicate"
              aria-label="Duplicate"
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              >
                <rect x="5.5" y="5.5" width="8.5" height="8.5" rx="1.5" />
                <path d="M10.5 5.5V3.5a1.5 1.5 0 0 0-1.5-1.5H3.5A1.5 1.5 0 0 0 2 3.5v5.5A1.5 1.5 0 0 0 3.5 10.5h2" />
              </svg>
            </button>
            {onReorderShape && (
              <LayerMenuButton
                onPick={(dir) =>
                  selectedShape && onReorderShape(selectedShape.id, dir)
                }
              />
            )}
            <button
              type="button"
              onClick={() => selectedShape && onRemoveShape?.(selectedShape.id)}
              title="Delete"
              aria-label="Delete"
              className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-300 transition hover:bg-rose-500/15 hover:text-rose-300"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-3.5 w-3.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 4.5h10" />
                <path d="M5.5 4.5V3a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1.5" />
                <path d="M4.5 4.5l1 9a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1l1-9" />
              </svg>
            </button>
          </div>
        </div>
      )}
      <svg
        ref={svgRef}
        viewBox={`${view.panX} ${view.panY} ${vbW} ${vbH}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleSvgMouseDown}
        onMouseMove={(e) => {
          if (panDragRef.current) handlePanMove(e);
          else handleMouseMove(e);
        }}
        onMouseUp={() => {
          if (panDragRef.current) handlePanUp();
          else handleMouseUp();
        }}
        onMouseLeave={() => {
          if (panDragRef.current) handlePanUp();
          else handleMouseUp();
        }}
        onClick={handleSvgClick}
        style={{
          cursor: spacePan
            ? panDragRef.current
              ? "grabbing"
              : "grab"
            : placementMode
              ? "crosshair"
              : isDragging
                ? "grabbing"
                : "default",
        }}
      >
        <defs>
          <pattern
            id="scene-dots"
            width="24"
            height="24"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="12" cy="12" r="1" fill="#27272a" />
          </pattern>
        </defs>
        <rect x={-W * 2} y={-H * 2} width={W * 5} height={H * 5} fill="#0a0a0c" />
        <rect
          x={-W * 2}
          y={-H * 2}
          width={W * 5}
          height={H * 5}
          fill="url(#scene-dots)"
        />

        {scene.shapes.map((s) =>
          renderShape(s, toX, toY, dx, {
            selectedId,
            selectedIds: selectedSet,
            editingLatexId,
            clickedButtonId,
            showConnectionPoints:
              activeTool === "line" || activeTool === "polyline",
            view: scene.view,
            onClick: onClickButton,
            onMouseDown:
              onUpdateShape && activeTool === "select" && !spacePan
                ? (e) => beginMove(e, s)
                : undefined,
            onContextMenu: editable
              ? (e) => handleShapeContextMenu(e, s)
              : undefined,
            onUpdate: onUpdateShape,
          }),
        )}

        {onUpdateShape &&
          activeTool === "select" &&
          singleSelected &&
          scene.shapes
            .filter((s) => s.id === selectedId)
            .map((s) =>
              renderHandles(s, toX, toY, (e, h) => beginResize(e, s, h)),
            )}

        {(dragRef.current?.type === "marquee" ||
          dragRef.current?.type === "viewport") &&
          (() => {
            const d = dragRef.current;
            const x1 = toX(d.startWX);
            const x2 = toX(d.currentWX);
            const y1 = toY(d.startWY);
            const y2 = toY(d.currentWY);
            const isViewport = d.type === "viewport";
            const accent = isViewport ? "#f59e0b" : "#22d3ee";
            return (
              <rect
                x={Math.min(x1, x2)}
                y={Math.min(y1, y2)}
                width={Math.abs(x2 - x1)}
                height={Math.abs(y2 - y1)}
                fill={accent}
                fillOpacity={isViewport ? "0.1" : "0.08"}
                stroke={accent}
                strokeWidth={isViewport ? "2" : "1.5"}
                strokeDasharray="4 3"
                pointerEvents="none"
              />
            );
          })()}
      </svg>
    </div>
  );
}

function movePatch(s: SceneShape, dxw: number, dyw: number): Partial<SceneShape> {
  if (
    s.kind === "point" ||
    s.kind === "text" ||
    s.kind === "latex" ||
    s.kind === "function" ||
    s.kind === "code" ||
    s.kind === "output"
  ) {
    return { x: round(s.x + dxw), y: round(s.y + dyw) };
  }
  if (s.kind === "line") {
    return {
      x1: round(s.x1 + dxw),
      y1: round(s.y1 + dyw),
      x2: round(s.x2 + dxw),
      y2: round(s.y2 + dyw),
    };
  }
  if (s.kind === "polyline") {
    return {
      vertices: s.vertices.map((v) => ({
        x: round(v.x + dxw),
        y: round(v.y + dyw),
      })),
    };
  }
  return { cx: round(s.cx + dxw), cy: round(s.cy + dyw) };
}

function resizePatch(
  s: SceneShape,
  handle: ResizeHandle,
  wx: number,
  wy: number,
): Partial<SceneShape> | null {
  if (s.kind === "line") {
    if (handle === "end1") return { x1: round(wx), y1: round(wy) };
    if (handle === "end2") return { x2: round(wx), y2: round(wy) };
    return null;
  }
  if (s.kind === "polyline") {
    const idx = handle === "v0" ? 0 : handle === "v1" ? 1 : handle === "v2" ? 2 : -1;
    if (idx < 0 || idx >= s.vertices.length) return null;
    const vertices = s.vertices.map((v, i) =>
      i === idx ? { x: round(wx), y: round(wy) } : v,
    );
    return { vertices };
  }
  if (s.kind === "circle") {
    if (handle !== "radius") return null;
    const r = Math.max(0.05, Math.hypot(wx - s.cx, wy - s.cy));
    return { r: roundFine(r) };
  }
  if (
    s.kind === "rect" ||
    s.kind === "button" ||
    s.kind === "function" ||
    s.kind === "code" ||
    s.kind === "output"
  ) {
    // function/code/output use (x,y) for the box center; rect/button use
    // (cx,cy). Normalize while computing, then write back to the right names.
    const xyShape =
      s.kind === "function" || s.kind === "code" || s.kind === "output";
    const defaultW = s.kind === "function" ? 8 : 10;
    const defaultH = s.kind === "function" ? 6 : 8;
    const cx = xyShape ? s.x : s.cx;
    const cy = xyShape ? s.y : s.cy;
    const w0 = xyShape ? s.w ?? defaultW : s.w;
    const h0 = xyShape ? s.h ?? defaultH : s.h;
    const left = cx - w0 / 2;
    const right = cx + w0 / 2;
    const top = cy + h0 / 2;
    const bottom = cy - h0 / 2;
    const patch = (ncx: number, ncy: number, nw?: number, nh?: number) => {
      const base: Record<string, number> = xyShape
        ? { x: round(ncx), y: round(ncy) }
        : { cx: round(ncx), cy: round(ncy) };
      if (nw !== undefined) base.w = roundFine(nw);
      if (nh !== undefined) base.h = roundFine(nh);
      return base as Partial<SceneShape>;
    };

    // Edge handles: resize one dimension, opposite edge stays fixed.
    if (handle === "t") {
      const nh = Math.max(0.1, Math.abs(wy - bottom));
      const ncy = (wy + bottom) / 2;
      return patch(cx, ncy, undefined, nh);
    }
    if (handle === "b") {
      const nh = Math.max(0.1, Math.abs(top - wy));
      const ncy = (top + wy) / 2;
      return patch(cx, ncy, undefined, nh);
    }
    if (handle === "l") {
      const nw = Math.max(0.1, Math.abs(right - wx));
      const ncx = (right + wx) / 2;
      return patch(ncx, cy, nw, undefined);
    }
    if (handle === "r") {
      const nw = Math.max(0.1, Math.abs(wx - left));
      const ncx = (wx + left) / 2;
      return patch(ncx, cy, nw, undefined);
    }

    // Corner handles: resize both dimensions, opposite corner fixed.
    let fixedX = 0;
    let fixedY = 0;
    if (handle === "tl") {
      fixedX = right;
      fixedY = bottom;
    } else if (handle === "tr") {
      fixedX = left;
      fixedY = bottom;
    } else if (handle === "bl") {
      fixedX = right;
      fixedY = top;
    } else if (handle === "br") {
      fixedX = left;
      fixedY = top;
    } else return null;
    const nw = Math.max(0.1, Math.abs(wx - fixedX));
    const nh = Math.max(0.1, Math.abs(wy - fixedY));
    const ncx = (wx + fixedX) / 2;
    const ncy = (wy + fixedY) / 2;
    return patch(ncx, ncy, nw, nh);
  }
  return null;
}

function renderHandles(
  s: SceneShape,
  toX: (wx: number) => number,
  toY: (wy: number) => number,
  onMouseDown: (e: React.MouseEvent, h: ResizeHandle) => void,
): React.ReactNode {
  const dot = (x: number, y: number, h: ResizeHandle, cursor: string) => (
    <g key={h} style={{ cursor }} onMouseDown={(e) => onMouseDown(e, h)}>
      {/* fat invisible hit area so the handle is easy to grab */}
      <circle cx={x} cy={y} r="14" fill="transparent" />
      {/* outer subtle shadow ring */}
      <circle cx={x} cy={y} r="8.5" fill="#0a0a0c" opacity="0.55" />
      {/* main handle - white fill, cyan border */}
      <circle
        cx={x}
        cy={y}
        r="7"
        fill="#ffffff"
        stroke="#22d3ee"
        strokeWidth="2"
      />
    </g>
  );

  if (s.kind === "line") {
    return (
      <g key={`${s.id}-handles`}>
        {dot(toX(s.x1), toY(s.y1), "end1", "grab")}
        {dot(toX(s.x2), toY(s.y2), "end2", "grab")}
      </g>
    );
  }
  if (s.kind === "polyline") {
    const handles: ResizeHandle[] = ["v0", "v1", "v2"];
    return (
      <g key={`${s.id}-handles`}>
        {s.vertices.slice(0, 3).map((v, i) =>
          dot(toX(v.x), toY(v.y), handles[i], "grab"),
        )}
      </g>
    );
  }
  if (s.kind === "circle") {
    return (
      <g key={`${s.id}-handles`}>
        {dot(toX(s.cx + s.r), toY(s.cy), "radius", "ew-resize")}
      </g>
    );
  }
  if (
    s.kind === "rect" ||
    s.kind === "button" ||
    s.kind === "function" ||
    s.kind === "code" ||
    s.kind === "output"
  ) {
    const xyShape =
      s.kind === "function" || s.kind === "code" || s.kind === "output";
    const cx = xyShape ? s.x : s.cx;
    const cy = xyShape ? s.y : s.cy;
    const defaultW = s.kind === "function" ? 8 : 10;
    const defaultH = s.kind === "function" ? 6 : 8;
    const w = xyShape ? s.w ?? defaultW : s.w;
    const h = xyShape ? s.h ?? defaultH : s.h;
    const left = cx - w / 2;
    const right = cx + w / 2;
    const top = cy + h / 2;
    const bottom = cy - h / 2;
    return (
      <g key={`${s.id}-handles`}>
        {/* edge handles: resize one dimension */}
        {dot(toX(cx), toY(top), "t", "ns-resize")}
        {dot(toX(cx), toY(bottom), "b", "ns-resize")}
        {dot(toX(left), toY(cy), "l", "ew-resize")}
        {dot(toX(right), toY(cy), "r", "ew-resize")}
        {/* corner handles: resize both */}
        {dot(toX(left), toY(top), "tl", "nwse-resize")}
        {dot(toX(right), toY(top), "tr", "nesw-resize")}
        {dot(toX(left), toY(bottom), "bl", "nesw-resize")}
        {dot(toX(right), toY(bottom), "br", "nwse-resize")}
      </g>
    );
  }
  return null;
}

function renderShape(
  s: SceneShape,
  toX: (wx: number) => number,
  toY: (wy: number) => number,
  dx: number,
  ctx: {
    selectedId?: string;
    selectedIds?: Set<string>;
    editingLatexId?: string;
    clickedButtonId?: string;
    showConnectionPoints?: boolean;
    view?: { xmin: number; xmax: number; ymin: number; ymax: number };
    onClick?: (buttonId: string) => void;
    onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
    onContextMenu?: (e: React.MouseEvent<SVGGElement>) => void;
    onUpdate?: (id: string, patch: Partial<SceneShape>) => void;
  },
) {
  const color = COLORS[s.color] ?? s.color;
  const isSelected =
    ctx.selectedId === s.id || (ctx.selectedIds?.has(s.id) ?? false);
  const selectionStroke = isSelected ? "#22d3ee" : undefined;

  const interact: {
    onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
    onContextMenu?: (e: React.MouseEvent<SVGGElement>) => void;
    style?: React.CSSProperties;
  } = {
    onMouseDown: ctx.onMouseDown,
    onContextMenu: ctx.onContextMenu,
    style: ctx.onMouseDown ? { cursor: "grab" } : undefined,
  };

  if (s.kind === "circle") {
    const r = (s.r / dx) * W;
    const fillColor = s.filled ? color : "none";
    const labelColor = s.filled ? "#0a0a0a" : color;
    return (
      <g key={s.id} {...interact}>
        {/* Invisible hit area — fill="transparent" counts as painted for
            SVG hit-testing, so the entire interior + a few px of slop
            around the stroke all capture clicks. */}
        <circle
          cx={toX(s.cx)}
          cy={toY(s.cy)}
          r={r + 8}
          fill="transparent"
        />
        <circle
          cx={toX(s.cx)}
          cy={toY(s.cy)}
          r={r}
          fill={fillColor}
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "3" : "2"}
        />
        {s.label && (
          <text
            x={toX(s.cx)}
            y={toY(s.cy) + 5}
            fill={labelColor}
            fontSize="14"
            fontWeight="600"
            textAnchor="middle"
            pointerEvents="none"
          >
            {s.label}
          </text>
        )}
      </g>
    );
  }
  if (s.kind === "line") {
    return (
      <g key={s.id} {...interact}>
        {/* fat invisible hit area so the line is easy to grab */}
        <line
          x1={toX(s.x1)}
          y1={toY(s.y1)}
          x2={toX(s.x2)}
          y2={toY(s.y2)}
          stroke="transparent"
          strokeWidth="14"
          strokeLinecap="round"
          pointerEvents="stroke"
        />
        <line
          x1={toX(s.x1)}
          y1={toY(s.y1)}
          x2={toX(s.x2)}
          y2={toY(s.y2)}
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "4" : "2.5"}
          strokeLinecap="round"
          pointerEvents="none"
        />
      </g>
    );
  }
  if (s.kind === "polyline") {
    const points = s.vertices.map((v) => `${toX(v.x)},${toY(v.y)}`).join(" ");
    return (
      <g key={s.id} {...interact}>
        {/* fat invisible hit area */}
        <polyline
          points={points}
          fill="none"
          stroke="transparent"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="stroke"
        />
        <polyline
          points={points}
          fill="none"
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "4" : "2.5"}
          strokeLinecap="round"
          strokeLinejoin="round"
          pointerEvents="none"
        />
      </g>
    );
  }
  if (s.kind === "rect") {
    const w = (s.w / dx) * W;
    const h = (s.h / dx) * W;
    const fillColor = s.filled ? color : "none";
    const labelColor = s.filled ? "#0a0a0a" : color;
    // When the rect is selected, renderHandles draws interactive edge dots
    // on the midpoints already, so suppress the static connection-point
    // dots here to avoid double rendering.
    const showConnPts = ctx.showConnectionPoints && !isSelected;
    const connOpacity = 0.45;
    return (
      <g key={s.id} {...interact}>
        {/* Invisible hit area — fill="transparent" is treated as painted
            so the entire bbox + small slop around the stroke captures
            clicks even when the visible rect is unfilled. */}
        <rect
          x={toX(s.cx) - w / 2 - 6}
          y={toY(s.cy) - h / 2 - 6}
          width={w + 12}
          height={h + 12}
          fill="transparent"
          rx="6"
        />
        <rect
          x={toX(s.cx) - w / 2}
          y={toY(s.cy) - h / 2}
          width={w}
          height={h}
          fill={fillColor}
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "3" : "2"}
          rx="4"
        />
        {s.label && (
          <text
            x={toX(s.cx)}
            y={toY(s.cy) + 5}
            fill={labelColor}
            fontSize="14"
            fontWeight="600"
            textAnchor="middle"
            pointerEvents="none"
          >
            {s.label}
          </text>
        )}
        {showConnPts && (
          <g pointerEvents="none" opacity={connOpacity}>
            {[
              { x: s.cx, y: s.cy + s.h / 2 },
              { x: s.cx, y: s.cy - s.h / 2 },
              { x: s.cx - s.w / 2, y: s.cy },
              { x: s.cx + s.w / 2, y: s.cy },
            ].map((p, i) => (
              <g key={i}>
                <circle
                  cx={toX(p.x)}
                  cy={toY(p.y)}
                  r="4"
                  fill="#0a0a0c"
                  stroke="#22d3ee"
                  strokeWidth="1.5"
                />
                <circle cx={toX(p.x)} cy={toY(p.y)} r="1.5" fill="#22d3ee" />
              </g>
            ))}
          </g>
        )}
      </g>
    );
  }
  if (s.kind === "text") {
    const fontSize = s.size ?? 15;
    // Selection rect scales with the font so tiny text doesn't get a huge
    // outline and large text still fits inside its dashed box.
    const selH = Math.max(14, fontSize * 1.5);
    const selW = Math.max(40, fontSize * 4);
    return (
      <g key={s.id} {...interact}>
        {isSelected && (
          <rect
            x={toX(s.x) - selW / 2}
            y={toY(s.y) - selH / 2}
            width={selW}
            height={selH}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}
        <text
          x={toX(s.x)}
          y={toY(s.y) + fontSize / 3}
          fill={color}
          fontSize={fontSize}
          fontWeight="500"
          textAnchor="middle"
        >
          {s.text}
        </text>
      </g>
    );
  }
  if (s.kind === "code") {
    return (
      <CodeShape
        key={s.id}
        s={s}
        toX={toX}
        toY={toY}
        isSelected={isSelected}
        color={color}
        interact={interact}
        onUpdate={ctx.onUpdate}
      />
    );
  }
  if (s.kind === "output") {
    return (
      <OutputShape
        key={s.id}
        s={s}
        toX={toX}
        toY={toY}
        isSelected={isSelected}
        color={color}
        interact={interact}
      />
    );
  }
  if (s.kind === "function") {
    // Box geometry in world coords (center s.x, s.y; size s.w × s.h).
    const w = s.w ?? 8;
    const h = s.h ?? 6;
    const xmin = s.xmin ?? -4;
    const xmax = s.xmax ?? 4;
    const ymin = s.ymin ?? -3;
    const ymax = s.ymax ?? 3;

    // Box pixel rect.
    const boxLeftPx = toX(s.x - w / 2);
    const boxRightPx = toX(s.x + w / 2);
    const boxTopPx = toY(s.y + h / 2);
    const boxBottomPx = toY(s.y - h / 2);
    const boxWPx = boxRightPx - boxLeftPx;
    const boxHPx = boxBottomPx - boxTopPx;

    // Function-space → box-pixel mappers.
    const fnX = (xs: number) =>
      boxLeftPx + ((xs - xmin) / (xmax - xmin)) * boxWPx;
    const fnY = (ys: number) =>
      boxTopPx + (1 - (ys - ymin) / (ymax - ymin)) * boxHPx;

    // Samples are cached by (expr, xmin, xmax, samples) so moving / resizing
    // the box just re-maps to pixels rather than re-evaluating Cortex 200×.
    const samples = s.samples ?? 200;
    const fn = compileExpr(s.expr);
    const ys = fn ? getFunctionSamples(s.expr, xmin, xmax, samples) : null;

    // Inline path builder — clamps y to a padded band so steep curves draw
    // to the edge, breaks the path on non-finite or asymptote jumps.
    const segments: string[] = [];
    if (ys) {
      const yPad = (ymax - ymin) * 2;
      const yLo = ymin - yPad;
      const yHi = ymax + yPad;
      const yJump = (ymax - ymin) * 4;
      const span = xmax - xmin;
      const denom = Math.max(1, samples - 1);
      let current: string[] = [];
      const flush = () => {
        if (current.length >= 2) segments.push("M" + current.join(" L"));
        current = [];
      };
      let prevClamped: number | null = null;
      for (let i = 0; i < samples; i++) {
        const raw = ys[i];
        if (!Number.isFinite(raw)) {
          flush();
          prevClamped = null;
          continue;
        }
        const clamped = raw < yLo ? yLo : raw > yHi ? yHi : raw;
        if (prevClamped !== null && Math.abs(clamped - prevClamped) > yJump) {
          flush();
        }
        const wx = xmin + (span * i) / denom;
        current.push(`${fnX(wx).toFixed(2)},${fnY(clamped).toFixed(2)}`);
        prevClamped = clamped;
      }
      flush();
    }

    const isEditing = ctx.editingLatexId === s.id;
    const labelHtml =
      fn && !isEditing ? renderKatexCached(`y = ${s.expr || ""}`) : "";

    // Axes: only draw the ones that pass through the visible range.
    const zeroXPx = ymin <= 0 && 0 <= ymax ? fnY(0) : null;
    const zeroYPx = xmin <= 0 && 0 <= xmax ? fnX(0) : null;

    const clipId = `fnclip-${s.id}`;
    // Equation pill sits below the box, capsule-shaped, amber background,
    // dark text. Width tracks the box but stays within reasonable bounds so
    // a tiny box still gets a usable pill and a wide box doesn't get an
    // absurdly long one.
    const labelH = 24;
    const labelW = Math.max(110, Math.min(boxWPx * 0.75, 280));
    const labelXPx = boxLeftPx + (boxWPx - labelW) / 2;
    const labelYPx = boxBottomPx + 6;

    return (
      <g key={s.id} {...interact}>
        <defs>
          <clipPath id={clipId}>
            <rect
              x={boxLeftPx}
              y={boxTopPx}
              width={boxWPx}
              height={boxHPx}
            />
          </clipPath>
        </defs>
        {/* Box background + outline (the box itself is the hit area). */}
        <rect
          x={boxLeftPx}
          y={boxTopPx}
          width={boxWPx}
          height={boxHPx}
          fill="#0a0a0c"
          fillOpacity="0.35"
          stroke={color}
          strokeOpacity="0.5"
          strokeWidth="1"
          rx="4"
          ry="4"
        />
        {/* Internal axes. */}
        {zeroXPx !== null && (
          <line
            x1={boxLeftPx}
            x2={boxRightPx}
            y1={zeroXPx}
            y2={zeroXPx}
            stroke="#52525b"
            strokeWidth="1"
            pointerEvents="none"
          />
        )}
        {zeroYPx !== null && (
          <line
            x1={zeroYPx}
            x2={zeroYPx}
            y1={boxTopPx}
            y2={boxBottomPx}
            stroke="#52525b"
            strokeWidth="1"
            pointerEvents="none"
          />
        )}
        {/* Curve, clipped to the box. */}
        <g clipPath={`url(#${clipId})`} pointerEvents="none">
          {segments.map((d, i) => (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={isSelected ? 2.5 : 2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
        </g>
        {/* Error badge centered in the box when compile failed. */}
        {!fn && (
          <text
            x={(boxLeftPx + boxRightPx) / 2}
            y={(boxTopPx + boxBottomPx) / 2 + 5}
            fill="#fb7185"
            fontSize="12"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            textAnchor="middle"
            pointerEvents="none"
          >
            ⚠ invalid expression
          </text>
        )}
        {/* Equation pill below the box: amber capsule with dark text.
            Monospace raw LaTeX while editing, KaTeX-rendered otherwise. */}
        <rect
          x={labelXPx}
          y={labelYPx}
          width={labelW}
          height={labelH}
          fill="#fbbf24"
          rx={labelH / 2}
          ry={labelH / 2}
          pointerEvents="none"
        />
        {isEditing && (
          <text
            x={labelXPx + labelW / 2}
            y={labelYPx + labelH / 2 + 4}
            fill="#18181b"
            fontSize="13"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            textAnchor="middle"
            pointerEvents="none"
          >
            {`y = ${s.expr}`}
          </text>
        )}
        {!isEditing && fn && (
          <foreignObject
            x={labelXPx}
            y={labelYPx}
            width={labelW}
            height={labelH}
            pointerEvents="none"
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#18181b",
                fontSize: 14,
                lineHeight: 1.2,
              }}
              dangerouslySetInnerHTML={{ __html: labelHtml }}
            />
          </foreignObject>
        )}
        {isSelected && (
          <rect
            x={boxLeftPx}
            y={boxTopPx}
            width={boxWPx}
            height={boxHPx}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeDasharray="4 2"
            rx="4"
            ry="4"
            pointerEvents="none"
          />
        )}
      </g>
    );
  }
  if (s.kind === "latex") {
    const isEditing = ctx.editingLatexId === s.id;
    const fW = 240;
    const fH = 60;
    if (isEditing) {
      // While the user is editing the code in the ContextBar input, show
      // the raw LaTeX source on the canvas as monospace text.
      return (
        <g key={s.id} {...interact}>
          <rect
            x={toX(s.x) - fW / 2}
            y={toY(s.y) - fH / 2}
            width={fW}
            height={fH}
            fill="transparent"
          />
          {isSelected && (
            <rect
              x={toX(s.x) - fW / 2}
              y={toY(s.y) - fH / 2}
              width={fW}
              height={fH}
              fill="none"
              stroke="#22d3ee"
              strokeWidth="2"
              strokeDasharray="4 2"
              pointerEvents="none"
            />
          )}
          <text
            x={toX(s.x)}
            y={toY(s.y) + 5}
            fill={color}
            fontSize="13"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace"
            fontWeight="500"
            textAnchor="middle"
            pointerEvents="none"
          >
            {s.code || "\\text{LaTeX}"}
          </text>
        </g>
      );
    }
    const html = renderKatexCached(s.code || " ");
    return (
      <g key={s.id} {...interact}>
        <rect
          x={toX(s.x) - fW / 2}
          y={toY(s.y) - fH / 2}
          width={fW}
          height={fH}
          fill="transparent"
        />
        <foreignObject
          x={toX(s.x) - fW / 2}
          y={toY(s.y) - fH / 2}
          width={fW}
          height={fH}
          pointerEvents="none"
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
              fontSize: 18,
              lineHeight: 1.2,
            }}
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </foreignObject>
        {isSelected && (
          <rect
            x={toX(s.x) - fW / 2}
            y={toY(s.y) - fH / 2}
            width={fW}
            height={fH}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeDasharray="4 2"
            pointerEvents="none"
          />
        )}
      </g>
    );
  }
  if (s.kind === "button") {
    const w = (s.w / dx) * W;
    const h = (s.h / dx) * W;
    const active = ctx.clickedButtonId === s.buttonId;
    const fill = active ? color : "#18181b";
    const textFill = active ? "#0a0a0a" : color;
    return (
      <g
        key={s.id}
        {...interact}
        onClick={
          ctx.onClick
            ? (e) => {
                e.stopPropagation();
                ctx.onClick?.(s.buttonId);
              }
            : undefined
        }
        style={{
          cursor: ctx.onClick ? "pointer" : (interact.style?.cursor as string),
        }}
      >
        <rect
          x={toX(s.cx) - w / 2}
          y={toY(s.cy) - h / 2}
          width={w}
          height={h}
          fill={fill}
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "3" : "2"}
          rx="8"
        />
        <text
          x={toX(s.cx)}
          y={toY(s.cy) + 5}
          fill={textFill}
          fontSize="15"
          fontWeight="600"
          textAnchor="middle"
          pointerEvents="none"
        >
          {s.label}
        </text>
      </g>
    );
  }
  // point
  return (
    <g key={s.id} {...interact}>
      <circle
        cx={toX(s.x)}
        cy={toY(s.y)}
        r={isSelected ? 8 : 6}
        fill={color}
        stroke={selectionStroke}
        strokeWidth={isSelected ? "2" : "0"}
      />
      {s.label && (
        <text
          x={toX(s.x) + 10}
          y={toY(s.y) - 8}
          fill={color}
          fontSize="13"
          fontWeight="600"
          pointerEvents="none"
        >
          {s.label}
        </text>
      )}
    </g>
  );
}

// ---------------- Player runtime ----------------

export function SceneRunner({
  scene,
  onCheckResult,
}: {
  scene: Scene;
  onCheckResult?: (correct: boolean) => void;
}) {
  const [clickedButtonId, setClickedButtonId] = useState<string | undefined>();
  const [checked, setChecked] = useState<{ correct: boolean } | null>(null);

  function reset() {
    setClickedButtonId(undefined);
    setChecked(null);
  }

  function check() {
    if (!scene.correctButtonId) return;
    const correct = clickedButtonId === scene.correctButtonId;
    setChecked({ correct });
    onCheckResult?.(correct);
  }

  return (
    <div className="space-y-4">
      <SceneCanvas
        scene={scene}
        clickedButtonId={clickedButtonId}
        onClickButton={(id) => {
          setClickedButtonId(id);
          setChecked(null);
        }}
      />

      {scene.correctButtonId && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={check}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-black hover:bg-cyan-400"
          >
            Check
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800"
          >
            Reset
          </button>
        </div>
      )}

      {checked && (
        <div
          className={
            "rounded-xl p-4 text-sm ring-1 " +
            (checked.correct
              ? "bg-emerald-500/10 text-emerald-200 ring-emerald-500/30"
              : "bg-rose-500/10 text-rose-200 ring-rose-500/30")
          }
        >
          <p className="font-semibold">
            {checked.correct ? "Correct" : "Not yet"}
          </p>
          {!checked.correct && scene.hint && (
            <p className="mt-1 text-zinc-300">{scene.hint}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------- Editor ----------------

export function SceneEditor({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (next: Scene) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [boundsOpen, setBoundsOpen] = useState(false);
  const [spacePan, setSpacePan] = useState(false);
  // ID of the latex shape whose code input is currently focused in the
  // ContextBar. While set, the canvas shows the raw LaTeX source for that
  // shape. When the input blurs (user clicks out), this clears and the
  // canvas flips back to the rendered version.
  const [editingLatexId, setEditingLatexId] = useState<string | null>(null);

  const selectedId_ = selectedIds.length === 1 ? selectedIds[0] : null;
  useEffect(() => {
    if (editingLatexId && editingLatexId !== selectedId_) {
      setEditingLatexId(null);
    }
  }, [selectedId_, editingLatexId]);

  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  // Undo/redo history stacks (refs to avoid re-renders on every push)
  const historyRef = useRef<Scene[]>([]);
  const redoRef = useRef<Scene[]>([]);
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  const selected = useMemo(
    () =>
      selectedId
        ? (scene.shapes.find((s) => s.id === selectedId) ?? null)
        : null,
    [scene.shapes, selectedId],
  );

  useEffect(() => {
    setSelectedIds((cur) => {
      const filtered = cur.filter((id) => scene.shapes.some((s) => s.id === id));
      return filtered.length === cur.length ? cur : filtered;
    });
  }, [scene.shapes]);

  function snapshot() {
    historyRef.current.push(sceneRef.current);
    if (historyRef.current.length > 200) historyRef.current.shift();
    redoRef.current = [];
  }

  function undo() {
    const prev = historyRef.current.pop();
    if (!prev) return;
    redoRef.current.push(sceneRef.current);
    onChange(prev);
  }

  function redo() {
    const next = redoRef.current.pop();
    if (!next) return;
    historyRef.current.push(sceneRef.current);
    onChange(next);
  }

  function updateShape(id: string, patch: Partial<SceneShape>) {
    onChange({
      ...scene,
      shapes: scene.shapes.map((s) =>
        s.id === id ? ({ ...s, ...patch } as SceneShape) : s,
      ),
    });
  }

  function updateShapes(updates: { id: string; patch: Partial<SceneShape> }[]) {
    const map = new Map(updates.map((u) => [u.id, u.patch]));
    onChange({
      ...scene,
      shapes: scene.shapes.map((s) => {
        const p = map.get(s.id);
        return p ? ({ ...s, ...p } as SceneShape) : s;
      }),
    });
  }

  function applyPatchToSelected(patch: Partial<SceneShape>) {
    if (selectedIds.length === 0) return;
    if (selectedIds.length === 1) {
      updateShape(selectedIds[0], patch);
    } else {
      updateShapes(selectedIds.map((id) => ({ id, patch })));
    }
  }

  function placeShape(kind: SceneShape["kind"], wx: number, wy: number) {
    snapshot();
    const s = makeShape(kind, wx, wy);
    onChange({ ...scene, shapes: [...scene.shapes, s] });
    setSelectedIds([s.id]);
    setActiveTool("select");
  }

  function copyShape(shape: SceneShape, newId: string, offset: number): SceneShape {
    if (
      shape.kind === "point" ||
      shape.kind === "text" ||
      shape.kind === "latex" ||
      shape.kind === "function" ||
      shape.kind === "code" ||
      shape.kind === "output"
    ) {
      return {
        ...shape,
        id: newId,
        x: round(shape.x + offset),
        y: round(shape.y - offset),
      };
    }
    if (shape.kind === "line") {
      return {
        ...shape,
        id: newId,
        x1: round(shape.x1 + offset),
        y1: round(shape.y1 - offset),
        x2: round(shape.x2 + offset),
        y2: round(shape.y2 - offset),
      };
    }
    if (shape.kind === "polyline") {
      return {
        ...shape,
        id: newId,
        vertices: shape.vertices.map((v) => ({
          x: round(v.x + offset),
          y: round(v.y - offset),
        })),
      };
    }
    if (shape.kind === "button") {
      return {
        ...shape,
        id: newId,
        cx: round(shape.cx + offset),
        cy: round(shape.cy - offset),
        buttonId: `btn-${newId}`,
      };
    }
    return {
      ...shape,
      id: newId,
      cx: round(shape.cx + offset),
      cy: round(shape.cy - offset),
    };
  }

  function duplicateShape(id: string) {
    const shape = scene.shapes.find((s) => s.id === id);
    if (!shape) return;
    snapshot();
    const newId = uid();
    const copy = copyShape(shape, newId, 0.6);
    onChange({ ...scene, shapes: [...scene.shapes, copy] });
    setSelectedIds([newId]);
  }

  function duplicateSelected() {
    if (selectedIds.length === 0) return;
    snapshot();
    const offset = 0.6;
    const newIds: string[] = [];
    const additions: SceneShape[] = [];
    for (const id of selectedIds) {
      const shape = scene.shapes.find((s) => s.id === id);
      if (!shape) continue;
      const newId = uid();
      newIds.push(newId);
      additions.push(copyShape(shape, newId, offset));
    }
    onChange({ ...scene, shapes: [...scene.shapes, ...additions] });
    setSelectedIds(newIds);
  }

  // In-app clipboard for Ctrl/Cmd + C / V. Stored on a ref so copying
  // doesn't trigger a re-render, and reset to offset 0 on every copy so
  // repeated pastes after a single copy fan out instead of stacking on
  // the same spot.
  const clipboardRef = useRef<SceneShape[]>([]);
  const pasteCountRef = useRef(0);

  function copySelected() {
    if (selectedIds.length === 0) return;
    const ids = new Set(selectedIds);
    clipboardRef.current = scene.shapes.filter((s) => ids.has(s.id));
    pasteCountRef.current = 0;
  }

  function pasteFromClipboard() {
    if (clipboardRef.current.length === 0) return;
    snapshot();
    pasteCountRef.current += 1;
    const offset = 0.6 * pasteCountRef.current;
    const newIds: string[] = [];
    const additions: SceneShape[] = [];
    for (const shape of clipboardRef.current) {
      const newId = uid();
      newIds.push(newId);
      additions.push(copyShape(shape, newId, offset));
    }
    onChange({ ...scene, shapes: [...scene.shapes, ...additions] });
    setSelectedIds(newIds);
  }

  function removeShape(id: string) {
    const shape = scene.shapes.find((s) => s.id === id);
    if (!shape) return;
    snapshot();
    const next: Scene = {
      ...scene,
      shapes: scene.shapes.filter((s) => s.id !== id),
    };
    if (
      shape.kind === "button" &&
      next.correctButtonId === shape.buttonId
    ) {
      next.correctButtonId = undefined;
    }
    onChange(next);
    setSelectedIds((cur) => cur.filter((sid) => sid !== id));
  }

  function removeSelected() {
    if (selectedIds.length === 0) return;
    snapshot();
    const ids = new Set(selectedIds);
    let correctButtonId = scene.correctButtonId;
    for (const s of scene.shapes) {
      if (s.kind === "button" && ids.has(s.id) && correctButtonId === s.buttonId) {
        correctButtonId = undefined;
      }
    }
    onChange({
      ...scene,
      shapes: scene.shapes.filter((s) => !ids.has(s.id)),
      correctButtonId,
    });
    setSelectedIds([]);
  }

  function reorderShape(
    id: string,
    direction: "front" | "back" | "forward" | "backward",
  ) {
    const idx = scene.shapes.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const shape = scene.shapes[idx];
    snapshot();
    const others = scene.shapes.filter((_, i) => i !== idx);
    let shapes: SceneShape[];
    if (direction === "front") {
      shapes = [...others, shape];
    } else if (direction === "back") {
      shapes = [shape, ...others];
    } else if (direction === "forward") {
      shapes = [...others];
      shapes.splice(Math.min(idx + 1, others.length), 0, shape);
    } else {
      shapes = [...others];
      shapes.splice(Math.max(idx - 1, 0), 0, shape);
    }
    onChange({ ...scene, shapes });
  }

  function nudgeSelected(dxw: number, dyw: number) {
    if (selectedIds.length === 0) return;
    snapshot();
    const updates = selectedIds
      .map((id) => {
        const shape = scene.shapes.find((s) => s.id === id);
        return shape ? { id, patch: movePatch(shape, dxw, dyw) } : null;
      })
      .filter((x): x is { id: string; patch: Partial<SceneShape> } => !!x);
    updateShapes(updates);
  }

  function toggleSelect(id: string) {
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inField =
        !!target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      const mod = e.metaKey || e.ctrlKey;

      // Undo/redo work everywhere except inside an editable field, where
      // the field's own undo/redo (e.g. CodeMirror, plain inputs) takes
      // precedence over the scene history.
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        if (inField) return;
        e.preventDefault();
        undo();
        return;
      }
      if (
        mod &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
        if (inField) return;
        e.preventDefault();
        redo();
        return;
      }

      // Suppress other shortcuts while typing in a field
      if (inField) return;

      // Spacebar: enter pan mode
      if (e.code === "Space" && !e.repeat) {
        e.preventDefault();
        setSpacePan(true);
        return;
      }

      // Cmd/Ctrl+A: select all
      if (mod && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(scene.shapes.map((s) => s.id));
        return;
      }

      // Esc: deselect / reset tool
      if (e.key === "Escape") {
        setSelectedIds([]);
        setActiveTool("select");
        return;
      }

      // Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          removeSelected();
        }
        return;
      }

      // Cmd/Ctrl+D: duplicate
      if (mod && e.key.toLowerCase() === "d") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          duplicateSelected();
        }
        return;
      }

      // Cmd/Ctrl+C: copy selected shapes to the in-app clipboard
      if (mod && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          copySelected();
        }
        return;
      }

      // Cmd/Ctrl+V: paste from the in-app clipboard
      if (mod && e.key.toLowerCase() === "v") {
        if (clipboardRef.current.length > 0) {
          e.preventDefault();
          pasteFromClipboard();
        }
        return;
      }

      // Cmd/Ctrl+X: cut = copy + remove
      if (mod && e.key.toLowerCase() === "x") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          copySelected();
          removeSelected();
        }
        return;
      }

      // Arrow nudge (Shift = bigger step)
      if (selectedIds.length > 0 && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        let dxw = 0;
        let dyw = 0;
        if (e.key === "ArrowLeft") dxw = -step;
        else if (e.key === "ArrowRight") dxw = step;
        else if (e.key === "ArrowUp") dyw = step;
        else if (e.key === "ArrowDown") dyw = -step;
        nudgeSelected(dxw, dyw);
      }
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.code === "Space") {
        setSpacePan(false);
      }
    }

    document.addEventListener("keydown", onKey);
    document.addEventListener("keyup", onKeyUp);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("keyup", onKeyUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds, scene.shapes]);

  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
      <div className="relative bg-[#0a0a0c]">
        {/* Floating sidebar */}
        <div className="absolute left-4 top-4 z-20">
          <Sidebar
            activeTool={activeTool}
            onSelectTool={(t) => {
              setActiveTool(t);
              if (t !== "select") setSelectedIds([]);
            }}
            boundsOpen={boundsOpen}
            onToggleBounds={() => setBoundsOpen((v) => !v)}
          />
        </div>

        {/* Floating contextual top bar */}
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <ContextBar
            selected={selected}
            multiCount={selectedIds.length}
            correctButtonId={scene.correctButtonId}
            onBeginEdit={snapshot}
            onUpdate={(patch) => selected && updateShape(selected.id, patch)}
            onMultiUpdate={(patch) => {
              snapshot();
              applyPatchToSelected(patch);
            }}
            onRemove={() => selected && removeShape(selected.id)}
            onMultiRemove={removeSelected}
            onSetCorrect={(buttonId) => {
              snapshot();
              onChange({ ...scene, correctButtonId: buttonId });
            }}
            onLatexFocus={() => selected && setEditingLatexId(selected.id)}
            onLatexBlur={() => setEditingLatexId(null)}
          />
        </div>

        <SceneCanvas
          scene={scene}
          selectedId={selectedId ?? undefined}
          selectedIds={selectedIds}
          editingLatexId={editingLatexId ?? undefined}
          activeTool={activeTool}
          spacePan={spacePan}
          onSelect={(id, opts) => {
            if (activeTool !== "select") setActiveTool("select");
            if (id === null) {
              setSelectedIds([]);
              return;
            }
            if (opts?.additive) {
              toggleSelect(id);
            } else {
              setSelectedIds([id]);
            }
          }}
          onSelectMany={(ids) => {
            if (activeTool !== "select") setActiveTool("select");
            setSelectedIds(ids);
          }}
          onUpdateShape={updateShape}
          onUpdateShapes={updateShapes}
          onPlaceShape={placeShape}
          onSetView={(view) => {
            snapshot();
            onChange({ ...scene, view });
          }}
          onCommitTool={(t) => setActiveTool(t)}
          onDuplicateShape={duplicateShape}
          onRemoveShape={removeShape}
          onBeginEdit={snapshot}
          onReorderShape={reorderShape}
        />
      </div>

      {boundsOpen && <ViewBoundsRow scene={scene} onChange={onChange} />}
      <HintRow scene={scene} onChange={onChange} />
    </div>
  );
}

// ---------------- Sidebar ----------------

const TOOL_COLORS = {
  select: { idle: "text-violet-300", active: "bg-violet-500/15 text-violet-200" },
  shapes: { idle: "text-zinc-300", active: "bg-zinc-700/40 text-zinc-100" },
  point: { idle: "text-rose-300", active: "bg-rose-500/15 text-rose-200" },
  circle: { idle: "text-emerald-300", active: "bg-emerald-500/15 text-emerald-200" },
  rect: { idle: "text-indigo-300", active: "bg-indigo-500/15 text-indigo-200" },
  lines: { idle: "text-sky-300", active: "bg-sky-500/15 text-sky-200" },
  line: { idle: "text-sky-300", active: "bg-sky-500/15 text-sky-200" },
  polyline: { idle: "text-sky-300", active: "bg-sky-500/15 text-sky-200" },
  texts: { idle: "text-violet-300", active: "bg-violet-500/15 text-violet-200" },
  text: { idle: "text-violet-300", active: "bg-violet-500/15 text-violet-200" },
  latex: { idle: "text-violet-300", active: "bg-violet-500/15 text-violet-200" },
  function: { idle: "text-cyan-300", active: "bg-cyan-500/15 text-cyan-200" },
  code: { idle: "text-emerald-300", active: "bg-emerald-500/15 text-emerald-200" },
  output: { idle: "text-sky-300", active: "bg-sky-500/15 text-sky-200" },
  button: { idle: "text-amber-300", active: "bg-amber-500/15 text-amber-200" },
  viewport: { idle: "text-amber-300", active: "bg-amber-500/15 text-amber-200" },
  canvas: { idle: "text-zinc-400", active: "bg-zinc-700/40 text-zinc-100" },
};

function Sidebar({
  activeTool,
  onSelectTool,
  boundsOpen,
  onToggleBounds,
}: {
  activeTool: ActiveTool;
  onSelectTool: (t: ActiveTool) => void;
  boundsOpen: boolean;
  onToggleBounds: () => void;
}) {
  const [shapesOpen, setShapesOpen] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);
  const [textsOpen, setTextsOpen] = useState(false);
  const shapesFlyoutRef = useRef<HTMLDivElement>(null);
  const shapesAnchorRef = useRef<HTMLButtonElement>(null);
  const linesFlyoutRef = useRef<HTMLDivElement>(null);
  const linesAnchorRef = useRef<HTMLButtonElement>(null);
  const textsFlyoutRef = useRef<HTMLDivElement>(null);
  const textsAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!shapesOpen && !linesOpen && !textsOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        shapesFlyoutRef.current?.contains(target) ||
        shapesAnchorRef.current?.contains(target)
      ) {
        return;
      }
      if (
        linesFlyoutRef.current?.contains(target) ||
        linesAnchorRef.current?.contains(target)
      ) {
        return;
      }
      if (
        textsFlyoutRef.current?.contains(target) ||
        textsAnchorRef.current?.contains(target)
      ) {
        return;
      }
      setShapesOpen(false);
      setLinesOpen(false);
      setTextsOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [shapesOpen, linesOpen, textsOpen]);

  const shapeActive =
    activeTool === "point" || activeTool === "circle" || activeTool === "rect";
  const lineActive = activeTool === "line" || activeTool === "polyline";
  const textActive =
    activeTool === "text" || activeTool === "latex" || activeTool === "function";

  return (
    <div className="relative flex flex-col gap-1 rounded-2xl bg-zinc-900/95 p-1.5 shadow-2xl shadow-black/60 ring-1 ring-white/5 backdrop-blur">
      <ToolButton
        label="Select"
        active={activeTool === "select"}
        tone={TOOL_COLORS.select}
        onClick={() => onSelectTool("select")}
      >
        <CursorIcon />
      </ToolButton>

      <div className="relative">
        <ToolButton
          label="Shapes"
          active={shapeActive || shapesOpen}
          tone={TOOL_COLORS.shapes}
          onClick={() => setShapesOpen((v) => !v)}
          buttonRef={shapesAnchorRef}
        >
          <ShapesIcon />
        </ToolButton>
        {shapesOpen && (
          <div
            ref={shapesFlyoutRef}
            className="absolute left-full top-0 z-20 ml-2 flex flex-col gap-1 rounded-2xl bg-zinc-900 p-2 shadow-2xl ring-1 ring-zinc-800"
          >
            <FlyoutItem
              label="Point"
              onClick={() => {
                onSelectTool("point");
                setShapesOpen(false);
              }}
              tone={TOOL_COLORS.point}
              active={activeTool === "point"}
            >
              <PointIcon />
            </FlyoutItem>
            <FlyoutItem
              label="Circle"
              onClick={() => {
                onSelectTool("circle");
                setShapesOpen(false);
              }}
              tone={TOOL_COLORS.circle}
              active={activeTool === "circle"}
            >
              <CircleIcon />
            </FlyoutItem>
            <FlyoutItem
              label="Rectangle"
              onClick={() => {
                onSelectTool("rect");
                setShapesOpen(false);
              }}
              tone={TOOL_COLORS.rect}
              active={activeTool === "rect"}
            >
              <RectIcon />
            </FlyoutItem>
          </div>
        )}
      </div>

      <div className="relative">
        <ToolButton
          label="Lines"
          active={lineActive || linesOpen}
          tone={TOOL_COLORS.lines}
          onClick={() => setLinesOpen((v) => !v)}
          buttonRef={linesAnchorRef}
        >
          <LineIcon />
        </ToolButton>
        {linesOpen && (
          <div
            ref={linesFlyoutRef}
            className="absolute left-full top-0 z-20 ml-2 flex flex-col gap-1 rounded-2xl bg-zinc-900 p-2 shadow-2xl ring-1 ring-zinc-800"
          >
            <FlyoutItem
              label="Line"
              onClick={() => {
                onSelectTool("line");
                setLinesOpen(false);
              }}
              tone={TOOL_COLORS.line}
              active={activeTool === "line"}
            >
              <LineIcon />
            </FlyoutItem>
            <FlyoutItem
              label="Polyline (3 vertices)"
              onClick={() => {
                onSelectTool("polyline");
                setLinesOpen(false);
              }}
              tone={TOOL_COLORS.polyline}
              active={activeTool === "polyline"}
            >
              <PolylineIcon />
            </FlyoutItem>
          </div>
        )}
      </div>

      <div className="relative">
        <ToolButton
          label="Text"
          active={textActive || textsOpen}
          tone={TOOL_COLORS.texts}
          onClick={() => setTextsOpen((v) => !v)}
          buttonRef={textsAnchorRef}
        >
          <TextIcon />
        </ToolButton>
        {textsOpen && (
          <div
            ref={textsFlyoutRef}
            className="absolute left-full top-0 z-20 ml-2 flex flex-col gap-1 rounded-2xl bg-zinc-900 p-2 shadow-2xl ring-1 ring-zinc-800"
          >
            <FlyoutItem
              label="Text"
              onClick={() => {
                onSelectTool("text");
                setTextsOpen(false);
              }}
              tone={TOOL_COLORS.text}
              active={activeTool === "text"}
            >
              <TextIcon />
            </FlyoutItem>
            <FlyoutItem
              label="LaTeX"
              onClick={() => {
                onSelectTool("latex");
                setTextsOpen(false);
              }}
              tone={TOOL_COLORS.latex}
              active={activeTool === "latex"}
            >
              <LatexIcon />
            </FlyoutItem>
            <FlyoutItem
              label="Function (y = f(x))"
              onClick={() => {
                onSelectTool("function");
                setTextsOpen(false);
              }}
              tone={TOOL_COLORS.function}
              active={activeTool === "function"}
            >
              <FunctionIcon />
            </FlyoutItem>
          </div>
        )}
      </div>

      <ToolButton
        label="Button"
        active={activeTool === "button"}
        tone={TOOL_COLORS.button}
        onClick={() => onSelectTool("button")}
      >
        <ButtonIcon />
      </ToolButton>

      <ToolButton
        label="JS — JavaScript runner"
        active={activeTool === "code"}
        tone={TOOL_COLORS.code}
        onClick={() => onSelectTool("code")}
      >
        <JsIcon />
      </ToolButton>

      <ToolButton
        label="Output — canvas surface a JS block draws into"
        active={activeTool === "output"}
        tone={TOOL_COLORS.output}
        onClick={() => onSelectTool("output")}
      >
        <OutputIcon />
      </ToolButton>

      <ToolButton
        label="Viewport — drag a rect to set the preview frame"
        active={activeTool === "viewport"}
        tone={TOOL_COLORS.viewport}
        onClick={() => onSelectTool("viewport")}
      >
        <ViewportIcon />
      </ToolButton>

      <div className="mt-1 border-t border-zinc-800 pt-1">
        <ToolButton
          label="Canvas"
          active={boundsOpen}
          tone={TOOL_COLORS.canvas}
          onClick={onToggleBounds}
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
        </ToolButton>
      </div>
    </div>
  );
}

function ToolButton({
  children,
  label,
  active,
  tone,
  onClick,
  buttonRef,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  tone: { idle: string; active: string };
  onClick: () => void;
  buttonRef?: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "flex h-10 w-10 items-center justify-center rounded-xl transition " +
        (active ? tone.active : `${tone.idle} hover:bg-zinc-800`)
      }
    >
      {children}
    </button>
  );
}

function FlyoutItem({
  children,
  label,
  active,
  tone,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  active: boolean;
  tone: { idle: string; active: string };
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={
        "flex h-9 w-9 items-center justify-center rounded-lg transition " +
        (active ? tone.active : `${tone.idle} hover:bg-zinc-800`)
      }
    >
      {children}
    </button>
  );
}

// ---------------- JS code shape ----------------

// Live registry mapping output-shape id → its canvas element. OutputShape
// registers on mount; CodeShape's Run picks the first entry to draw into.
// Module-scope so both components share it without threading refs through
// props / context.
const outputCanvases = new Map<string, HTMLCanvasElement>();

function runJsOnCanvas(
  source: string,
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
): { ok: boolean; error: string | null } {
  try {
    // ctx, canvas, width, height are the entire surface exposed to user
    // code. console.log goes through the browser console as usual.
    const fn = new Function(
      "ctx",
      "canvas",
      "width",
      "height",
      `"use strict";\n${source}`,
    );
    fn(ctx, canvas, canvas.clientWidth, canvas.clientHeight);
    return { ok: true, error: null };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? `${e.name}: ${e.message}` : String(e),
    };
  }
}

function CodeShape({
  s,
  toX,
  toY,
  isSelected,
  color,
  interact,
  onUpdate,
}: {
  s: SceneShape & { kind: "code" };
  toX: (wx: number) => number;
  toY: (wy: number) => number;
  isSelected: boolean;
  color: string;
  interact: {
    onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
    onContextMenu?: (e: React.MouseEvent<SVGGElement>) => void;
    style?: React.CSSProperties;
  };
  onUpdate?: (id: string, patch: Partial<SceneShape>) => void;
}) {
  const w = s.w ?? 10;
  const h = s.h ?? 8;
  const left = toX(s.x - w / 2);
  const right = toX(s.x + w / 2);
  const top = toY(s.y + h / 2);
  const bottom = toY(s.y - h / 2);
  const boxW = right - left;
  const boxH = bottom - top;

  const headerH = 28;
  const errorH = s.error ? 22 : 0;

  // Editing state is local; we only push the source up to the shape on a
  // small debounce so each keystroke doesn't ripple through the whole scene.
  const [localSource, setLocalSource] = useState(s.source ?? "");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => setLocalSource(s.source ?? ""), [s.source]);
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleSourceChange = (v: string) => {
    setLocalSource(v);
    pendingRef.current = v;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      pendingRef.current = null;
      onUpdate?.(s.id, { source: v });
    }, 250);
  };

  const handleRun = () => {
    // Flush any pending source first so we run what the user sees.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      pendingRef.current = null;
    }
    // Draw to the first output shape in the scene. Its OutputShape component
    // registered its canvas in the module-scope outputCanvases map on mount.
    const first = outputCanvases.values().next().value as
      | HTMLCanvasElement
      | undefined;
    if (!first) {
      onUpdate?.(s.id, {
        source: localSource,
        error: "No Output block in this scene — drop one from the sidebar.",
      });
      return;
    }
    const ctx = first.getContext("2d");
    if (!ctx) {
      onUpdate?.(s.id, {
        source: localSource,
        error: "Couldn't get a 2D context on the Output canvas.",
      });
      return;
    }
    // The OutputShape's own ResizeObserver keeps width/height in sync; just
    // clear and run in CSS pixels.
    const cssW = first.clientWidth;
    const cssH = first.clientHeight;
    ctx.clearRect(0, 0, cssW, cssH);
    const result = runJsOnCanvas(localSource, ctx, first);
    onUpdate?.(s.id, {
      source: localSource,
      error: result.ok ? undefined : result.error ?? undefined,
    });
  };

  // Stop pointer events that originate inside the editor from bubbling up
  // to the shape's drag handler. Header bar still drags.
  const stopDrag = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <g key={s.id} {...interact}>
      <rect
        x={left}
        y={top}
        width={boxW}
        height={boxH}
        fill="#18181b"
        stroke={color}
        strokeOpacity="0.6"
        strokeWidth="1.5"
        rx="6"
        ry="6"
      />
      <foreignObject x={left} y={top} width={boxW} height={boxH}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 6,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            color: "#e4e4e7",
          }}
        >
          <div
            style={{
              height: headerH,
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 10px",
              background: "#27272a",
              borderBottom: "1px solid #3f3f46",
              cursor: interact.style?.cursor ?? "default",
              userSelect: "none",
              fontSize: 12,
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ color: "#a1a1aa", fontWeight: 600 }}>JS</span>
            <button
              type="button"
              onMouseDown={stopDrag}
              onClick={(e) => {
                e.stopPropagation();
                handleRun();
              }}
              style={{
                background: "#10b981",
                color: "#052e1f",
                border: "none",
                borderRadius: 4,
                padding: "3px 10px",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Run
            </button>
          </div>
          {/* Editor takes the whole body now — the canvas moved out to its
              own Output shape. */}
          <div
            onMouseDown={stopDrag}
            onMouseMove={stopDrag}
            onClick={stopDrag}
            style={{
              flex: "1 1 auto",
              overflow: "auto",
              minHeight: 0,
            }}
          >
            <CodeMirror
              value={localSource}
              onChange={handleSourceChange}
              extensions={[javascript()]}
              theme={oneDark}
              basicSetup={{
                lineNumbers: true,
                foldGutter: false,
                autocompletion: true,
                closeBrackets: true,
                bracketMatching: true,
                highlightActiveLine: true,
                highlightActiveLineGutter: true,
                indentOnInput: true,
              }}
              height="100%"
              style={{ height: "100%", fontSize: 13 }}
            />
          </div>
          {errorH > 0 && (
            <div
              onMouseDown={stopDrag}
              style={{
                height: errorH,
                flex: "0 0 auto",
                background: "#3f1d1d",
                color: "#fca5a5",
                padding: "2px 10px",
                fontSize: 11,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                borderTop: "1px solid #7f1d1d",
              }}
              title={s.error}
            >
              {s.error}
            </div>
          )}
        </div>
      </foreignObject>
      {isSelected && (
        <rect
          x={left}
          y={top}
          width={boxW}
          height={boxH}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeDasharray="4 2"
          rx="6"
          ry="6"
          pointerEvents="none"
        />
      )}
    </g>
  );
}

function OutputShape({
  s,
  toX,
  toY,
  isSelected,
  color,
  interact,
}: {
  s: SceneShape & { kind: "output" };
  toX: (wx: number) => number;
  toY: (wy: number) => number;
  isSelected: boolean;
  color: string;
  interact: {
    onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
    onContextMenu?: (e: React.MouseEvent<SVGGElement>) => void;
    style?: React.CSSProperties;
  };
}) {
  const w = s.w ?? 10;
  const h = s.h ?? 8;
  const left = toX(s.x - w / 2);
  const right = toX(s.x + w / 2);
  const top = toY(s.y + h / 2);
  const bottom = toY(s.y - h / 2);
  const boxW = right - left;
  const boxH = bottom - top;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const headerH = 24;

  // Register this canvas so CodeShape's Run can find it. Cleanup removes it
  // when the shape unmounts (or its id changes, though ids are stable).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    outputCanvases.set(s.id, canvas);
    return () => {
      outputCanvases.delete(s.id);
    };
  }, [s.id]);

  // Keep the canvas backing store synced with CSS size × devicePixelRatio
  // (same reason as any HiDPI-aware canvas — 300×150 default otherwise).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (cssW <= 0 || cssH <= 0) return;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  const stopDrag = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <g key={s.id} {...interact}>
      <rect
        x={left}
        y={top}
        width={boxW}
        height={boxH}
        fill="#0a0a0c"
        stroke={color}
        strokeOpacity="0.55"
        strokeWidth="1.5"
        rx="6"
        ry="6"
      />
      <foreignObject x={left} y={top} width={boxW} height={boxH}>
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderRadius: 6,
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            color: "#e4e4e7",
          }}
        >
          <div
            style={{
              height: headerH,
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              padding: "0 10px",
              background: "#0f172a",
              borderBottom: "1px solid #1e293b",
              cursor: interact.style?.cursor ?? "default",
              userSelect: "none",
              fontSize: 11,
              color: "#7dd3fc",
              letterSpacing: "0.04em",
              fontWeight: 600,
            }}
          >
            Output
          </div>
          <canvas
            ref={canvasRef}
            onMouseDown={stopDrag}
            onMouseMove={stopDrag}
            onClick={stopDrag}
            style={{
              flex: "1 1 auto",
              minHeight: 0,
              width: "100%",
              background: "#0a0a0c",
              display: "block",
            }}
          />
        </div>
      </foreignObject>
      {isSelected && (
        <rect
          x={left}
          y={top}
          width={boxW}
          height={boxH}
          fill="none"
          stroke="#22d3ee"
          strokeWidth="2"
          strokeDasharray="4 2"
          rx="6"
          ry="6"
          pointerEvents="none"
        />
      )}
    </g>
  );
}

// ---------------- Context bar ----------------

// Debounced text input — used for the function shape's `expr` field where
// the downstream work (Cortex parse + 200 evals + KaTeX render) is heavy
// enough to make uncontrolled per-keystroke updates feel laggy. The input
// itself reflects what the user typed immediately; onCommit fires 150 ms
// after they pause, or on blur. Local state syncs from `value` so external
// updates (selection change, undo) still flow through.
function DebouncedInput({
  value,
  onCommit,
  onFocus,
  onBlur,
  delay = 150,
  className,
  placeholder,
  spellCheck,
}: {
  value: string;
  onCommit: (v: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  delay?: number;
  className?: string;
  placeholder?: string;
  spellCheck?: boolean;
}) {
  const [local, setLocal] = useState(value);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<string | null>(null);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  return (
    <input
      value={local}
      onFocus={onFocus}
      onChange={(e) => {
        const v = e.target.value;
        setLocal(v);
        pendingRef.current = v;
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          pendingRef.current = null;
          onCommit(v);
        }, delay);
      }}
      onBlur={() => {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
          if (pendingRef.current !== null) {
            onCommit(pendingRef.current);
            pendingRef.current = null;
          }
        }
        onBlur?.();
      }}
      placeholder={placeholder}
      spellCheck={spellCheck}
      suppressHydrationWarning
      className={className}
    />
  );
}

function ContextBar({
  selected,
  multiCount = 0,
  correctButtonId,
  onBeginEdit,
  onUpdate,
  onMultiUpdate,
  onRemove,
  onMultiRemove,
  onSetCorrect,
  onLatexFocus,
  onLatexBlur,
}: {
  selected: SceneShape | null;
  multiCount?: number;
  correctButtonId?: string;
  onBeginEdit?: () => void;
  onUpdate: (patch: Partial<SceneShape>) => void;
  onMultiUpdate?: (patch: Partial<SceneShape>) => void;
  onRemove: () => void;
  onMultiRemove?: () => void;
  onSetCorrect: (id: string | undefined) => void;
  onLatexFocus?: () => void;
  onLatexBlur?: () => void;
}) {
  if (!selected && multiCount > 1) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-zinc-900/95 px-3 py-1.5 shadow-2xl shadow-black/60 ring-1 ring-white/5 backdrop-blur">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
          {multiCount} selected
        </span>
        <Sep />
        <ColorBar
          color="cyan"
          onChange={(c) => onMultiUpdate?.({ color: c })}
        />
        <Sep />
        <button
          type="button"
          onClick={() => onMultiUpdate?.({ filled: true })}
          className="rounded-full bg-zinc-950/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-300 ring-1 ring-zinc-800 transition hover:bg-zinc-800 hover:text-zinc-100"
          title="Fill all"
        >
          Fill all
        </button>
        <button
          type="button"
          onClick={() => onMultiUpdate?.({ filled: false })}
          className="rounded-full bg-zinc-950/60 px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-zinc-300 ring-1 ring-zinc-800 transition hover:bg-zinc-800 hover:text-zinc-100"
          title="Outline all"
        >
          Outline all
        </button>
        <button
          type="button"
          onClick={onMultiRemove}
          className="ml-1 rounded-md p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
          aria-label="Delete selected"
          title="Delete selected"
        >
          <svg
            viewBox="0 0 16 16"
            className="h-3.5 w-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="3" x2="13" y2="13" />
            <line x1="13" y1="3" x2="3" y2="13" />
          </svg>
        </button>
      </div>
    );
  }
  if (!selected) {
    return (
      <div className="rounded-full bg-zinc-900/95 px-4 py-1.5 text-[11px] text-zinc-500 shadow-lg shadow-black/40 ring-1 ring-white/5 backdrop-blur">
        Pick a tool to add a shape · click an existing shape to edit · shift-click to multi-select
      </div>
    );
  }

  const inputCls =
    "rounded-md bg-zinc-950/80 px-2 py-1 text-xs text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400";

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-full bg-zinc-900/95 px-3 py-1.5 shadow-2xl shadow-black/60 ring-1 ring-white/5 backdrop-blur">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {selected.kind}
      </span>

      <Sep />

      <ColorBar
        color={selected.color}
        onChange={(c) => {
          onBeginEdit?.();
          onUpdate({ color: c });
        }}
      />

      {(selected.kind === "circle" || selected.kind === "rect") && (
        <>
          <Sep />
          <FillToggle
            filled={!!selected.filled}
            color={selected.color}
            onToggle={() => {
              onBeginEdit?.();
              onUpdate({ filled: !selected.filled });
            }}
          />
        </>
      )}

      {selected.kind === "circle" && (
        <>
          <Sep />
          <span className="text-[11px] text-zinc-500">d</span>
          <input
            type="number"
            value={Number((selected.r * 2).toFixed(2))}
            onFocus={onBeginEdit}
            onChange={(e) => {
              const d = Number(e.target.value);
              if (!Number.isNaN(d) && d > 0) {
                onUpdate({ r: roundFine(d / 2) });
              }
            }}
            step="0.05"
            min="0.02"
            suppressHydrationWarning
            className={`${inputCls} w-20 font-mono`}
          />
        </>
      )}

      {(selected.kind === "point" ||
        selected.kind === "circle" ||
        selected.kind === "rect") && (
        <>
          <Sep />
          <input
            value={selected.label ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Label"
            suppressHydrationWarning
            className={`${inputCls} w-32`}
          />
        </>
      )}
      {selected.kind === "text" && (
        <>
          <Sep />
          <input
            value={selected.text}
            onFocus={onBeginEdit}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Text"
            suppressHydrationWarning
            className={`${inputCls} w-40`}
          />
          <span className="text-[11px] text-zinc-500">size</span>
          <input
            type="number"
            value={selected.size ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => {
              const v = e.target.value;
              onUpdate({ size: v === "" ? undefined : Number(v) });
            }}
            placeholder="15"
            min="4"
            suppressHydrationWarning
            className={`${inputCls} w-16 font-mono`}
          />
        </>
      )}
      {selected.kind === "latex" && (
        <>
          <Sep />
          <input
            value={selected.code}
            onFocus={() => {
              onBeginEdit?.();
              onLatexFocus?.();
            }}
            onBlur={() => onLatexBlur?.()}
            onChange={(e) => onUpdate({ code: e.target.value })}
            placeholder="x^2 + y^2 = r^2"
            spellCheck={false}
            suppressHydrationWarning
            className={`${inputCls} w-56 font-mono`}
          />
        </>
      )}
      {selected.kind === "function" && (
        <>
          <Sep />
          <span className="text-[11px] text-zinc-500">y =</span>
          <DebouncedInput
            value={selected.expr}
            onFocus={onBeginEdit}
            onCommit={(v) => onUpdate({ expr: v })}
            placeholder="\sin(x)"
            spellCheck={false}
            className={`${inputCls} w-56 font-mono`}
          />
          <span className="text-[11px] text-zinc-500">x</span>
          <input
            type="number"
            value={selected.xmin ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => {
              const v = e.target.value;
              onUpdate({ xmin: v === "" ? undefined : Number(v) });
            }}
            placeholder="xmin"
            suppressHydrationWarning
            className={`${inputCls} w-14 font-mono`}
          />
          <input
            type="number"
            value={selected.xmax ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => {
              const v = e.target.value;
              onUpdate({ xmax: v === "" ? undefined : Number(v) });
            }}
            placeholder="xmax"
            suppressHydrationWarning
            className={`${inputCls} w-14 font-mono`}
          />
          <span className="text-[11px] text-zinc-500">y</span>
          <input
            type="number"
            value={selected.ymin ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => {
              const v = e.target.value;
              onUpdate({ ymin: v === "" ? undefined : Number(v) });
            }}
            placeholder="ymin"
            suppressHydrationWarning
            className={`${inputCls} w-14 font-mono`}
          />
          <input
            type="number"
            value={selected.ymax ?? ""}
            onFocus={onBeginEdit}
            onChange={(e) => {
              const v = e.target.value;
              onUpdate({ ymax: v === "" ? undefined : Number(v) });
            }}
            placeholder="ymax"
            suppressHydrationWarning
            className={`${inputCls} w-14 font-mono`}
          />
        </>
      )}
      {selected.kind === "button" && (
        <>
          <Sep />
          <input
            value={selected.label}
            onFocus={onBeginEdit}
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Label"
            suppressHydrationWarning
            className={`${inputCls} w-28`}
          />
          <input
            value={selected.buttonId}
            onFocus={onBeginEdit}
            onChange={(e) => onUpdate({ buttonId: e.target.value })}
            placeholder="ID"
            suppressHydrationWarning
            className={`${inputCls} w-24`}
          />
          <label className="flex items-center gap-1.5 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-300 ring-1 ring-zinc-800">
            <input
              type="checkbox"
              checked={correctButtonId === selected.buttonId}
              onChange={(e) =>
                onSetCorrect(e.target.checked ? selected.buttonId : undefined)
              }
              suppressHydrationWarning
              className="accent-cyan-500"
            />
            Correct
          </label>
        </>
      )}

      <button
        type="button"
        onClick={onRemove}
        className="ml-auto rounded-md p-1.5 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
        aria-label="Delete"
        title="Delete"
      >
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <line x1="3" y1="3" x2="13" y2="13" />
          <line x1="13" y1="3" x2="3" y2="13" />
        </svg>
      </button>
    </div>
  );
}

function Sep() {
  return <div className="h-5 w-px bg-zinc-800" />;
}

function FillToggle({
  filled,
  color,
  onToggle,
}: {
  filled: boolean;
  color: string;
  onToggle: () => void;
}) {
  const swatch = COLORS[color] ?? color;
  return (
    <button
      type="button"
      onClick={onToggle}
      title={filled ? "Switch to outline" : "Fill shape"}
      aria-label={filled ? "Switch to outline" : "Fill shape"}
      aria-pressed={filled}
      className="flex h-7 items-center gap-1.5 rounded-full bg-zinc-950/60 px-2 ring-1 ring-zinc-800 transition hover:ring-zinc-600"
    >
      {filled ? (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" fill={swatch} />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5">
          <rect
            x="2.5"
            y="2.5"
            width="11"
            height="11"
            rx="2"
            fill="none"
            stroke={swatch}
            strokeWidth="2"
          />
        </svg>
      )}
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
        {filled ? "Fill" : "Outline"}
      </span>
    </button>
  );
}

function ContextMenu({
  x,
  y,
  onClose,
  onDuplicate,
  onRemove,
  onReorder,
}: {
  x: number;
  y: number;
  onClose: () => void;
  onDuplicate?: () => void;
  onRemove?: () => void;
  onReorder?: (dir: "front" | "back" | "forward" | "backward") => void;
}) {
  void onClose;
  type MenuItem =
    | {
        kind: "item";
        label: string;
        action: () => void;
        shortcut?: string;
        danger?: boolean;
      }
    | { kind: "divider" };

  const items: MenuItem[] = [];
  if (onDuplicate) {
    items.push({
      kind: "item",
      label: "Duplicate",
      shortcut: "Ctrl+D",
      action: onDuplicate,
    });
  }
  if (onReorder) {
    items.push({ kind: "divider" });
    items.push({
      kind: "item",
      label: "Bring to front",
      action: () => onReorder("front"),
    });
    items.push({
      kind: "item",
      label: "Bring forward",
      action: () => onReorder("forward"),
    });
    items.push({
      kind: "item",
      label: "Send backward",
      action: () => onReorder("backward"),
    });
    items.push({
      kind: "item",
      label: "Send to back",
      action: () => onReorder("back"),
    });
  }
  if (onRemove) {
    items.push({ kind: "divider" });
    items.push({
      kind: "item",
      label: "Delete",
      shortcut: "Del",
      action: onRemove,
      danger: true,
    });
  }

  return (
    <div
      className="absolute z-50 w-44 overflow-hidden rounded-xl bg-zinc-900 py-1 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur"
      style={{ left: x, top: y }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {items.map((it, i) =>
        it.kind === "divider" ? (
          <div key={`d-${i}`} className="my-1 h-px bg-zinc-800" />
        ) : (
          <button
            key={`m-${i}`}
            type="button"
            onClick={it.action}
            className={
              "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition " +
              (it.danger
                ? "text-rose-300 hover:bg-rose-500/15 hover:text-rose-200"
                : "text-zinc-200 hover:bg-zinc-800")
            }
          >
            <span>{it.label}</span>
            {it.shortcut && (
              <span className="text-[10px] text-zinc-500">{it.shortcut}</span>
            )}
          </button>
        ),
      )}
    </div>
  );
}

function LayerMenuButton({
  onPick,
}: {
  onPick: (dir: "front" | "back" | "forward" | "backward") => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const items: {
    label: string;
    dir: "front" | "back" | "forward" | "backward";
  }[] = [
    { label: "Bring to front", dir: "front" },
    { label: "Bring forward", dir: "forward" },
    { label: "Send backward", dir: "backward" },
    { label: "Send to back", dir: "back" },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Layer"
        aria-label="Layer order"
        className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor">
          <circle cx="4" cy="8" r="1.3" />
          <circle cx="8" cy="8" r="1.3" />
          <circle cx="12" cy="8" r="1.3" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-40 mt-2 w-40 -translate-x-1/2 overflow-hidden rounded-xl bg-zinc-900 py-1 shadow-2xl shadow-black/60 ring-1 ring-white/10 backdrop-blur">
          {items.map((it) => (
            <button
              key={it.dir}
              type="button"
              onClick={() => {
                onPick(it.dir);
                setOpen(false);
              }}
              className="block w-full px-3 py-1.5 text-left text-xs text-zinc-200 transition hover:bg-zinc-800"
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function isValidHex(v: string): boolean {
  return /^#?([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/.test(v.trim());
}
function normalizeHex(v: string): string {
  const t = v.trim();
  return t.startsWith("#") ? t.toLowerCase() : `#${t.toLowerCase()}`;
}

function ColorBar({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hexDraft, setHexDraft] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (open) {
      setHexDraft(
        color.startsWith("#") ? color : (COLORS[color] ?? "#" + color),
      );
    }
  }, [open, color]);

  function commitHex() {
    if (isValidHex(hexDraft)) {
      onChange(normalizeHex(hexDraft));
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Color"
        aria-label="Color"
        className="flex h-7 w-7 items-center justify-center rounded-full ring-2 ring-zinc-700 transition hover:ring-zinc-500"
        style={{ backgroundColor: COLORS[color] ?? color }}
      />
      {open && (
        <div className="absolute left-0 top-full z-30 mt-2 w-48 rounded-xl bg-zinc-900 p-2 shadow-2xl ring-1 ring-zinc-800">
          <div className="grid grid-cols-6 gap-1">
            {COLOR_NAMES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onChange(c);
                  setOpen(false);
                }}
                title={c}
                aria-label={c}
                className={
                  "h-6 w-6 rounded-full ring-1 transition " +
                  (color === c
                    ? "ring-2 ring-cyan-400"
                    : "ring-zinc-700 hover:ring-zinc-500")
                }
                style={{ backgroundColor: COLORS[c] }}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1 border-t border-zinc-800 pt-2">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Hex
            </span>
            <input
              value={hexDraft}
              onChange={(e) => setHexDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commitHex();
                }
              }}
              onBlur={commitHex}
              placeholder="#22d3ee"
              spellCheck={false}
              suppressHydrationWarning
              className={
                "flex-1 rounded-md bg-zinc-950 px-2 py-1 font-mono text-[11px] text-zinc-100 ring-1 transition focus:outline-none focus:ring-2 focus:ring-cyan-400 " +
                (isValidHex(hexDraft) || hexDraft === ""
                  ? "ring-zinc-800"
                  : "ring-rose-500/50")
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  className: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <input
        type="number"
        step={0.1}
        value={value}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!Number.isNaN(n)) onChange(n);
        }}
        suppressHydrationWarning
        className={`mt-1 ${className}`}
      />
    </div>
  );
}

function ViewBoundsRow({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (next: Scene) => void;
}) {
  const fieldClass =
    "w-full rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400";
  function update(patch: Partial<Scene["view"]>) {
    onChange({ ...scene, view: { ...scene.view, ...patch } });
  }
  return (
    <div className="flex items-center gap-3 border-t border-zinc-800/50 px-4 py-3">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Bounds
      </span>
      <div className="grid flex-1 grid-cols-4 gap-2">
        <NumField
          label="X min"
          value={scene.view.xmin}
          onChange={(v) => update({ xmin: v })}
          className={fieldClass}
        />
        <NumField
          label="X max"
          value={scene.view.xmax}
          onChange={(v) => update({ xmax: v })}
          className={fieldClass}
        />
        <NumField
          label="Y min"
          value={scene.view.ymin}
          onChange={(v) => update({ ymin: v })}
          className={fieldClass}
        />
        <NumField
          label="Y max"
          value={scene.view.ymax}
          onChange={(v) => update({ ymax: v })}
          className={fieldClass}
        />
      </div>
    </div>
  );
}

function HintRow({
  scene,
  onChange,
}: {
  scene: Scene;
  onChange: (next: Scene) => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-zinc-800/50 px-4 py-3">
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        Hint
      </span>
      <input
        value={scene.hint ?? ""}
        onChange={(e) => onChange({ ...scene, hint: e.target.value })}
        placeholder="Shown when the learner picks the wrong answer"
        suppressHydrationWarning
        className="flex-1 bg-transparent text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
      />
    </div>
  );
}
