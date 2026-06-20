"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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

type ResizeHandle = "tl" | "tr" | "bl" | "br" | "end1" | "end2" | "radius";

type DragState =
  | { type: "move"; shapeId: string; original: SceneShape; startWX: number; startWY: number }
  | {
      type: "resize";
      shapeId: string;
      original: SceneShape;
      handle: ResizeHandle;
      startWX: number;
      startWY: number;
    };

// ---------------- Canvas ----------------

type ActiveTool = "select" | SceneShape["kind"];

type RendererProps = {
  scene: Scene;
  selectedId?: string;
  clickedButtonId?: string;
  activeTool?: ActiveTool;
  spacePan?: boolean;
  onSelect?: (id: string | null) => void;
  onUpdateShape?: (id: string, patch: Partial<SceneShape>) => void;
  onPlaceShape?: (kind: SceneShape["kind"], wx: number, wy: number) => void;
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
  if (s.kind === "point" || s.kind === "text") return { x: s.x, y: s.y };
  if (s.kind === "line")
    return { x: (s.x1 + s.x2) / 2, y: Math.max(s.y1, s.y2) };
  if (s.kind === "circle") return { x: s.cx, y: s.cy + s.r };
  return { x: s.cx, y: s.cy + s.h / 2 };
}

function SceneCanvas({
  scene,
  selectedId,
  clickedButtonId,
  activeTool = "select",
  spacePan = false,
  onSelect,
  onUpdateShape,
  onPlaceShape,
  onClickButton,
  onDuplicateShape,
  onRemoveShape,
  onBeginEdit,
  onReorderShape,
}: RendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);
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
  const showFloatingMenu =
    editable && selectedShape && activeTool === "select" && !isDragging;
  let floatingPos: { x: number; y: number } | null = null;
  if (showFloatingMenu && selectedShape) {
    const anchor = shapeTopAnchor(selectedShape);
    floatingPos = worldToContainerPx(anchor.x, anchor.y);
  }

  function beginMove(e: React.MouseEvent, shape: SceneShape) {
    if (!onUpdateShape || activeTool !== "select" || spacePan) return;
    e.stopPropagation();
    onSelect?.(shape.id);
    onBeginEdit?.();
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);
    dragRef.current = {
      type: "move",
      shapeId: shape.id,
      original: shape,
      startWX: wx,
      startWY: wy,
    };
    movedRef.current = false;
    setIsDragging(true);
  }

  function beginResize(e: React.MouseEvent, shape: SceneShape, handle: ResizeHandle) {
    if (!onUpdateShape) return;
    e.stopPropagation();
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
    if (!d || !onUpdateShape) return;
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);

    if (d.type === "move") {
      const dxw = wx - d.startWX;
      const dyw = wy - d.startWY;
      if (Math.abs(dxw) < 0.01 && Math.abs(dyw) < 0.01) return;
      movedRef.current = true;
      const patch = movePatch(d.original, dxw, dyw);
      onUpdateShape(d.shapeId, patch);
    } else {
      movedRef.current = true;
      const patch = resizePatch(d.original, d.handle, wx, wy);
      if (patch) onUpdateShape(d.shapeId, patch);
    }
  }

  function handleMouseUp() {
    dragRef.current = null;
    if (isDragging) setIsDragging(false);
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (spacePan) return;
    if (activeTool !== "select" && onPlaceShape) {
      const [wx, wy] = svgToWorld(e.clientX, e.clientY);
      onPlaceShape(activeTool, wx, wy);
      return;
    }
    onSelect?.(null);
  }

  // Spacebar+drag = pan
  const panDragRef = useRef<{ startX: number; startY: number } | null>(null);
  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if (!spacePan) return;
    panDragRef.current = { startX: e.clientX, startY: e.clientY };
    movedRef.current = false;
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
            clickedButtonId,
            onClick: onClickButton,
            onMouseDown:
              onUpdateShape && activeTool === "select" && !spacePan
                ? (e) => beginMove(e, s)
                : undefined,
            onContextMenu: editable
              ? (e) => handleShapeContextMenu(e, s)
              : undefined,
          }),
        )}

        {onUpdateShape &&
          activeTool === "select" &&
          scene.shapes
            .filter((s) => s.id === selectedId)
            .map((s) =>
              renderHandles(s, toX, toY, (e, h) => beginResize(e, s, h)),
            )}
      </svg>
    </div>
  );
}

function movePatch(s: SceneShape, dxw: number, dyw: number): Partial<SceneShape> {
  if (s.kind === "point" || s.kind === "text") {
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
  if (s.kind === "circle") {
    if (handle !== "radius") return null;
    const r = Math.max(0.2, Math.hypot(wx - s.cx, wy - s.cy));
    return { r: round(r) };
  }
  if (s.kind === "rect" || s.kind === "button") {
    const left = s.cx - s.w / 2;
    const right = s.cx + s.w / 2;
    const top = s.cy + s.h / 2;
    const bottom = s.cy - s.h / 2;
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
    const nw = Math.max(0.4, Math.abs(wx - fixedX));
    const nh = Math.max(0.4, Math.abs(wy - fixedY));
    const ncx = (wx + fixedX) / 2;
    const ncy = (wy + fixedY) / 2;
    return { cx: round(ncx), cy: round(ncy), w: round(nw), h: round(nh) };
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
      {/* outer subtle shadow ring */}
      <circle cx={x} cy={y} r="7.5" fill="#0a0a0c" opacity="0.5" />
      {/* main handle - white fill, cyan border */}
      <circle
        cx={x}
        cy={y}
        r="6"
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
  if (s.kind === "circle") {
    return (
      <g key={`${s.id}-handles`}>
        {dot(toX(s.cx + s.r), toY(s.cy), "radius", "ew-resize")}
      </g>
    );
  }
  if (s.kind === "rect" || s.kind === "button") {
    const left = s.cx - s.w / 2;
    const right = s.cx + s.w / 2;
    const top = s.cy + s.h / 2;
    const bottom = s.cy - s.h / 2;
    return (
      <g key={`${s.id}-handles`}>
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
    clickedButtonId?: string;
    onClick?: (buttonId: string) => void;
    onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
    onContextMenu?: (e: React.MouseEvent<SVGGElement>) => void;
  },
) {
  const color = COLORS[s.color] ?? s.color;
  const isSelected = ctx.selectedId === s.id;
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
    return (
      <g key={s.id} {...interact}>
        <circle
          cx={toX(s.cx)}
          cy={toY(s.cy)}
          r={r}
          fill="none"
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "3" : "2"}
        />
        {s.label && (
          <text
            x={toX(s.cx)}
            y={toY(s.cy) + 5}
            fill={color}
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
        <line
          x1={toX(s.x1)}
          y1={toY(s.y1)}
          x2={toX(s.x2)}
          y2={toY(s.y2)}
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "4" : "2.5"}
          strokeLinecap="round"
        />
      </g>
    );
  }
  if (s.kind === "rect") {
    const w = (s.w / dx) * W;
    const h = (s.h / dx) * W;
    return (
      <g key={s.id} {...interact}>
        <rect
          x={toX(s.cx) - w / 2}
          y={toY(s.cy) - h / 2}
          width={w}
          height={h}
          fill="none"
          stroke={selectionStroke ?? color}
          strokeWidth={isSelected ? "3" : "2"}
          rx="4"
        />
        {s.label && (
          <text
            x={toX(s.cx)}
            y={toY(s.cy) + 5}
            fill={color}
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
  if (s.kind === "text") {
    return (
      <g key={s.id} {...interact}>
        {isSelected && (
          <rect
            x={toX(s.x) - 30}
            y={toY(s.y) - 11}
            width="60"
            height="22"
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2"
            strokeDasharray="4 2"
          />
        )}
        <text
          x={toX(s.x)}
          y={toY(s.y) + 5}
          fill={color}
          fontSize="15"
          fontWeight="500"
          textAnchor="middle"
        >
          {s.text}
        </text>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ActiveTool>("select");
  const [boundsOpen, setBoundsOpen] = useState(false);
  const [spacePan, setSpacePan] = useState(false);

  // Undo/redo history stacks (refs to avoid re-renders on every push)
  const historyRef = useRef<Scene[]>([]);
  const redoRef = useRef<Scene[]>([]);
  const sceneRef = useRef(scene);
  useEffect(() => {
    sceneRef.current = scene;
  }, [scene]);

  const selected = useMemo(
    () => scene.shapes.find((s) => s.id === selectedId) ?? null,
    [scene.shapes, selectedId],
  );

  useEffect(() => {
    if (selectedId && !scene.shapes.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [scene.shapes, selectedId]);

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

  function placeShape(kind: SceneShape["kind"], wx: number, wy: number) {
    snapshot();
    const s = makeShape(kind, wx, wy);
    onChange({ ...scene, shapes: [...scene.shapes, s] });
    setSelectedId(s.id);
    setActiveTool("select");
  }

  function duplicateShape(id: string) {
    const shape = scene.shapes.find((s) => s.id === id);
    if (!shape) return;
    snapshot();
    const newId = uid();
    const offset = 0.6;
    let copy: SceneShape;
    if (shape.kind === "point" || shape.kind === "text") {
      copy = {
        ...shape,
        id: newId,
        x: round(shape.x + offset),
        y: round(shape.y - offset),
      };
    } else if (shape.kind === "line") {
      copy = {
        ...shape,
        id: newId,
        x1: round(shape.x1 + offset),
        y1: round(shape.y1 - offset),
        x2: round(shape.x2 + offset),
        y2: round(shape.y2 - offset),
      };
    } else if (shape.kind === "button") {
      copy = {
        ...shape,
        id: newId,
        cx: round(shape.cx + offset),
        cy: round(shape.cy - offset),
        buttonId: `btn-${newId}`,
      };
    } else {
      copy = {
        ...shape,
        id: newId,
        cx: round(shape.cx + offset),
        cy: round(shape.cy - offset),
      };
    }
    onChange({ ...scene, shapes: [...scene.shapes, copy] });
    setSelectedId(newId);
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
    if (selectedId === id) setSelectedId(null);
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

  function nudge(id: string, dxw: number, dyw: number) {
    const shape = scene.shapes.find((s) => s.id === id);
    if (!shape) return;
    snapshot();
    updateShape(id, movePatch(shape, dxw, dyw));
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

      // Undo/redo work everywhere
      if (mod && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (
        mod &&
        (e.key.toLowerCase() === "y" ||
          (e.shiftKey && e.key.toLowerCase() === "z"))
      ) {
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

      // Esc: deselect / reset tool
      if (e.key === "Escape") {
        setSelectedId(null);
        setActiveTool("select");
        return;
      }

      // Delete / Backspace
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId) {
          e.preventDefault();
          removeShape(selectedId);
        }
        return;
      }

      // Cmd/Ctrl+D: duplicate
      if (mod && e.key.toLowerCase() === "d") {
        if (selectedId) {
          e.preventDefault();
          duplicateShape(selectedId);
        }
        return;
      }

      // Arrow nudge (Shift = bigger step)
      if (selectedId && e.key.startsWith("Arrow")) {
        e.preventDefault();
        const step = e.shiftKey ? 1.0 : 0.1;
        let dxw = 0;
        let dyw = 0;
        if (e.key === "ArrowLeft") dxw = -step;
        else if (e.key === "ArrowRight") dxw = step;
        else if (e.key === "ArrowUp") dyw = step;
        else if (e.key === "ArrowDown") dyw = -step;
        nudge(selectedId, dxw, dyw);
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
  }, [selectedId, scene.shapes]);

  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
      <div className="relative bg-[#0a0a0c]">
        {/* Floating sidebar */}
        <div className="absolute left-4 top-4 z-20">
          <Sidebar
            activeTool={activeTool}
            onSelectTool={(t) => {
              setActiveTool(t);
              if (t !== "select") setSelectedId(null);
            }}
            boundsOpen={boundsOpen}
            onToggleBounds={() => setBoundsOpen((v) => !v)}
          />
        </div>

        {/* Floating contextual top bar */}
        <div className="absolute left-1/2 top-4 z-20 -translate-x-1/2">
          <ContextBar
            selected={selected}
            correctButtonId={scene.correctButtonId}
            onBeginEdit={snapshot}
            onUpdate={(patch) => selected && updateShape(selected.id, patch)}
            onRemove={() => selected && removeShape(selected.id)}
            onSetCorrect={(buttonId) => {
              snapshot();
              onChange({ ...scene, correctButtonId: buttonId });
            }}
          />
        </div>

        <SceneCanvas
          scene={scene}
          selectedId={selectedId ?? undefined}
          activeTool={activeTool}
          spacePan={spacePan}
          onSelect={(id) => {
            if (activeTool !== "select") setActiveTool("select");
            setSelectedId(id);
          }}
          onUpdateShape={updateShape}
          onPlaceShape={placeShape}
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
  line: { idle: "text-sky-300", active: "bg-sky-500/15 text-sky-200" },
  text: { idle: "text-violet-300", active: "bg-violet-500/15 text-violet-200" },
  button: { idle: "text-amber-300", active: "bg-amber-500/15 text-amber-200" },
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
  const flyoutRef = useRef<HTMLDivElement>(null);
  const shapesAnchorRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!shapesOpen) return;
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        flyoutRef.current?.contains(target) ||
        shapesAnchorRef.current?.contains(target)
      ) {
        return;
      }
      setShapesOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [shapesOpen]);

  const shapeActive =
    activeTool === "point" || activeTool === "circle" || activeTool === "rect";

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
            ref={flyoutRef}
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

      <ToolButton
        label="Line"
        active={activeTool === "line"}
        tone={TOOL_COLORS.line}
        onClick={() => onSelectTool("line")}
      >
        <LineIcon />
      </ToolButton>

      <ToolButton
        label="Text"
        active={activeTool === "text"}
        tone={TOOL_COLORS.text}
        onClick={() => onSelectTool("text")}
      >
        <TextIcon />
      </ToolButton>

      <ToolButton
        label="Button"
        active={activeTool === "button"}
        tone={TOOL_COLORS.button}
        onClick={() => onSelectTool("button")}
      >
        <ButtonIcon />
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

// ---------------- Context bar ----------------

function ContextBar({
  selected,
  correctButtonId,
  onBeginEdit,
  onUpdate,
  onRemove,
  onSetCorrect,
}: {
  selected: SceneShape | null;
  correctButtonId?: string;
  onBeginEdit?: () => void;
  onUpdate: (patch: Partial<SceneShape>) => void;
  onRemove: () => void;
  onSetCorrect: (id: string | undefined) => void;
}) {
  if (!selected) {
    return (
      <div className="rounded-full bg-zinc-900/95 px-4 py-1.5 text-[11px] text-zinc-500 shadow-lg shadow-black/40 ring-1 ring-white/5 backdrop-blur">
        Pick a tool to add a shape · click an existing shape to edit
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
