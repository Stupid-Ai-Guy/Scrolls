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
  onSelect?: (id: string | null) => void;
  onUpdateShape?: (id: string, patch: Partial<SceneShape>) => void;
  onPlaceShape?: (kind: SceneShape["kind"], wx: number, wy: number) => void;
  onClickButton?: (buttonId: string) => void;
};

function SceneCanvas({
  scene,
  selectedId,
  clickedButtonId,
  activeTool = "select",
  onSelect,
  onUpdateShape,
  onPlaceShape,
  onClickButton,
}: RendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const movedRef = useRef(false);

  const { xmin, xmax, ymin, ymax } = scene.view;
  const dx = xmax - xmin;
  const dy = ymax - ymin;
  const toX = (wx: number) => ((wx - xmin) / dx) * W;
  const toY = (wy: number) => ((ymax - wy) / dy) * H;

  function svgToWorld(clientX: number, clientY: number): [number, number] {
    const svg = svgRef.current;
    if (!svg) return [0, 0];
    const rect = svg.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    const sy = ((clientY - rect.top) / rect.height) * H;
    const wx = (sx / W) * dx + xmin;
    const wy = ymax - (sy / H) * dy;
    return [wx, wy];
  }

  function beginMove(e: React.MouseEvent, shape: SceneShape) {
    if (!onUpdateShape || activeTool !== "select") return;
    e.stopPropagation();
    onSelect?.(shape.id);
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);
    dragRef.current = {
      type: "move",
      shapeId: shape.id,
      original: shape,
      startWX: wx,
      startWY: wy,
    };
    movedRef.current = false;
  }

  function beginResize(e: React.MouseEvent, shape: SceneShape, handle: ResizeHandle) {
    if (!onUpdateShape) return;
    e.stopPropagation();
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
  }

  function handleSvgClick(e: React.MouseEvent<SVGSVGElement>) {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    if (activeTool !== "select" && onPlaceShape) {
      const [wx, wy] = svgToWorld(e.clientX, e.clientY);
      onPlaceShape(activeTool, wx, wy);
      return;
    }
    onSelect?.(null);
  }

  const placementMode = activeTool !== "select";

  return (
    <div className="relative h-full overflow-hidden rounded-2xl bg-zinc-925 ring-1 ring-zinc-800">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleSvgClick}
        style={{ cursor: placementMode ? "crosshair" : "default" }}
      >
        <defs>
          <pattern
            id="scene-dots"
            width="22"
            height="22"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="11" cy="11" r="1.2" fill="#3f3f46" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="#0f0f12" />
        <rect width={W} height={H} fill="url(#scene-dots)" />

        {scene.shapes.map((s) =>
          renderShape(s, toX, toY, dx, {
            selectedId,
            clickedButtonId,
            onClick: onClickButton,
            onMouseDown: onUpdateShape && activeTool === "select"
              ? (e) => beginMove(e, s)
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
    <circle
      key={h}
      cx={x}
      cy={y}
      r="5"
      fill="#22d3ee"
      stroke="#0a0a0a"
      strokeWidth="1.5"
      style={{ cursor }}
      onMouseDown={(e) => onMouseDown(e, h)}
    />
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
  },
) {
  const color = COLORS[s.color] ?? s.color;
  const isSelected = ctx.selectedId === s.id;
  const selectionStroke = isSelected ? "#22d3ee" : undefined;

  const interact: {
    onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void;
    style?: React.CSSProperties;
  } = {
    onMouseDown: ctx.onMouseDown,
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

  const selected = useMemo(
    () => scene.shapes.find((s) => s.id === selectedId) ?? null,
    [scene.shapes, selectedId],
  );

  useEffect(() => {
    if (selectedId && !scene.shapes.some((s) => s.id === selectedId)) {
      setSelectedId(null);
    }
  }, [scene.shapes, selectedId]);

  function updateShape(id: string, patch: Partial<SceneShape>) {
    onChange({
      ...scene,
      shapes: scene.shapes.map((s) =>
        s.id === id ? ({ ...s, ...patch } as SceneShape) : s,
      ),
    });
  }

  function placeShape(kind: SceneShape["kind"], wx: number, wy: number) {
    const s = makeShape(kind, wx, wy);
    onChange({ ...scene, shapes: [...scene.shapes, s] });
    setSelectedId(s.id);
    setActiveTool("select");
  }

  function removeShape(id: string) {
    const shape = scene.shapes.find((s) => s.id === id);
    const next: Scene = {
      ...scene,
      shapes: scene.shapes.filter((s) => s.id !== id),
    };
    if (
      shape &&
      shape.kind === "button" &&
      next.correctButtonId === shape.buttonId
    ) {
      next.correctButtonId = undefined;
    }
    onChange(next);
    if (selectedId === id) setSelectedId(null);
  }

  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
      <ContextBar
        selected={selected}
        correctButtonId={scene.correctButtonId}
        onUpdate={(patch) => selected && updateShape(selected.id, patch)}
        onRemove={() => selected && removeShape(selected.id)}
        onSetCorrect={(buttonId) =>
          onChange({ ...scene, correctButtonId: buttonId })
        }
      />
      <div className="h-px bg-zinc-800" />

      <div className="flex gap-3 p-3">
        <Sidebar
          activeTool={activeTool}
          onSelectTool={(t) => {
            setActiveTool(t);
            if (t !== "select") setSelectedId(null);
          }}
          boundsOpen={boundsOpen}
          onToggleBounds={() => setBoundsOpen((v) => !v)}
        />

        <div className="min-w-0 flex-1">
          <SceneCanvas
            scene={scene}
            selectedId={selectedId ?? undefined}
            activeTool={activeTool}
            onSelect={(id) => {
              if (activeTool !== "select") setActiveTool("select");
              setSelectedId(id);
            }}
            onUpdateShape={updateShape}
            onPlaceShape={placeShape}
          />
        </div>
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
    <div className="relative flex flex-col gap-1 rounded-2xl bg-zinc-900 p-2 ring-1 ring-zinc-800">
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
  onUpdate,
  onRemove,
  onSetCorrect,
}: {
  selected: SceneShape | null;
  correctButtonId?: string;
  onUpdate: (patch: Partial<SceneShape>) => void;
  onRemove: () => void;
  onSetCorrect: (id: string | undefined) => void;
}) {
  if (!selected) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 text-xs text-zinc-500">
        <svg
          viewBox="0 0 16 16"
          className="h-3.5 w-3.5 text-zinc-600"
          fill="currentColor"
        >
          <circle cx="8" cy="8" r="3" />
        </svg>
        <span>
          Pick a tool from the sidebar to add a shape, or click an existing
          shape to edit it.
        </span>
      </div>
    );
  }

  const inputCls =
    "rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400";

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2">
      <span className="rounded-md bg-zinc-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400 ring-1 ring-zinc-800">
        {selected.kind}
      </span>

      <Sep />

      <ColorBar
        color={selected.color}
        onChange={(c) => onUpdate({ color: c })}
      />

      {(selected.kind === "point" ||
        selected.kind === "circle" ||
        selected.kind === "rect") && (
        <>
          <Sep />
          <input
            value={selected.label ?? ""}
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
            onChange={(e) => onUpdate({ label: e.target.value })}
            placeholder="Label"
            suppressHydrationWarning
            className={`${inputCls} w-28`}
          />
          <input
            value={selected.buttonId}
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

function ColorBar({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {COLOR_NAMES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          title={c}
          aria-label={c}
          className={
            "h-5 w-5 rounded-full ring-1 transition " +
            (color === c
              ? "ring-2 ring-cyan-400"
              : "ring-zinc-700 hover:ring-zinc-500")
          }
          style={{ backgroundColor: COLORS[c] }}
        />
      ))}
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
    <div className="grid grid-cols-4 gap-2 border-t border-zinc-800 px-3 py-3">
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
    <div className="border-t border-zinc-800 p-3">
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Hint
        </span>
        <input
          value={scene.hint ?? ""}
          onChange={(e) => onChange({ ...scene, hint: e.target.value })}
          placeholder="Shown when the learner picks the wrong answer"
          suppressHydrationWarning
          className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
      </div>
    </div>
  );
}
