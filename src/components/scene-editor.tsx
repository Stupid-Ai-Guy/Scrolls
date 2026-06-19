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

const W = 640;
const H = 420;

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

function defaultShape(kind: SceneShape["kind"]): SceneShape {
  const id = uid();
  switch (kind) {
    case "point":
      return { id, kind, x: 0, y: 0, color: "emerald", label: "" };
    case "line":
      return { id, kind, x1: -2, y1: 0, x2: 2, y2: 0, color: "emerald" };
    case "circle":
      return {
        id,
        kind,
        cx: 0,
        cy: 0,
        r: 2,
        color: "emerald",
        label: "",
      };
    case "rect":
      return {
        id,
        kind,
        cx: 0,
        cy: 0,
        w: 3,
        h: 2,
        color: "slate",
        label: "",
      };
    case "text":
      return { id, kind, x: 0, y: 0, text: "Text", color: "slate" };
    case "button":
      return {
        id,
        kind,
        cx: 0,
        cy: 0,
        w: 3,
        h: 1.5,
        label: "Click",
        buttonId: `btn-${id}`,
        color: "indigo",
      };
  }
}

// ---------------- Icons ----------------

const ICONS: Record<SceneShape["kind"], React.ReactNode> = {
  point: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <circle cx="8" cy="8" r="3" />
    </svg>
  ),
  line: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <line x1="3" y1="13" x2="13" y2="3" />
    </svg>
  ),
  circle: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="8" cy="8" r="5" />
    </svg>
  ),
  rect: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="3" y="4" width="10" height="8" rx="1" />
    </svg>
  ),
  text: (
    <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor">
      <text
        x="8"
        y="13"
        textAnchor="middle"
        fontSize="13"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui"
      >
        T
      </text>
    </svg>
  ),
  button: (
    <svg
      viewBox="0 0 16 16"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="2" y="3" width="12" height="7" rx="2" />
      <circle cx="8" cy="13" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  ),
};

// ---------------- Renderer ----------------

type ResizeHandle =
  | "tl"
  | "tr"
  | "bl"
  | "br"
  | "end1"
  | "end2"
  | "radius";

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

type RendererProps = {
  scene: Scene;
  selectedId?: string;
  clickedButtonId?: string;
  onSelect?: (id: string | null) => void;
  onUpdateShape?: (id: string, patch: Partial<SceneShape>) => void;
  onClickButton?: (buttonId: string) => void;
};

function SceneCanvas({
  scene,
  selectedId,
  clickedButtonId,
  onSelect,
  onUpdateShape,
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
  const showXAxis = ymin <= 0 && ymax >= 0;
  const showYAxis = xmin <= 0 && xmax >= 0;

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
    if (!onUpdateShape) return;
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

  function beginResize(
    e: React.MouseEvent,
    shape: SceneShape,
    handle: ResizeHandle,
  ) {
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

  function handleSvgClick() {
    if (movedRef.current) {
      movedRef.current = false;
      return;
    }
    onSelect?.(null);
  }

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleSvgClick}
      >
        {/* grid */}
        {Array.from({ length: Math.floor(dx) + 1 }, (_, i) => {
          const wx = Math.ceil(xmin) + i;
          if (wx > xmax) return null;
          return (
            <line
              key={`vg-${i}`}
              x1={toX(wx)}
              y1={0}
              x2={toX(wx)}
              y2={H}
              stroke="#27272a"
              strokeWidth="1"
            />
          );
        })}
        {Array.from({ length: Math.floor(dy) + 1 }, (_, i) => {
          const wy = Math.ceil(ymin) + i;
          if (wy > ymax) return null;
          return (
            <line
              key={`hg-${i}`}
              x1={0}
              y1={toY(wy)}
              x2={W}
              y2={toY(wy)}
              stroke="#27272a"
              strokeWidth="1"
            />
          );
        })}

        {/* axes */}
        {showXAxis && (
          <line
            x1={0}
            y1={toY(0)}
            x2={W}
            y2={toY(0)}
            stroke="#52525b"
            strokeWidth="1.5"
          />
        )}
        {showYAxis && (
          <line
            x1={toX(0)}
            y1={0}
            x2={toX(0)}
            y2={H}
            stroke="#52525b"
            strokeWidth="1.5"
          />
        )}

        {scene.shapes.map((s) =>
          renderShape(s, toX, toY, dx, {
            selectedId,
            clickedButtonId,
            onClick: onClickButton,
            onMouseDown: onUpdateShape
              ? (e) => beginMove(e, s)
              : undefined,
          }),
        )}

        {/* Resize handles for the selected shape */}
        {onUpdateShape &&
          scene.shapes
            .filter((s) => s.id === selectedId)
            .map((s) =>
              renderHandles(s, toX, toY, dx, (e, h) => beginResize(e, s, h)),
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
    // The corner opposite to the dragged handle stays fixed.
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
  dx: number,
  onMouseDown: (e: React.MouseEvent, h: ResizeHandle) => void,
): React.ReactNode {
  const handleStyle = { cursor: "nwse-resize" } as React.CSSProperties;
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
  // point/text: just highlight, no handles
  void handleStyle;
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

  const interact: { onMouseDown?: (e: React.MouseEvent<SVGGElement>) => void; style?: React.CSSProperties } = {
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

  function addShape(kind: SceneShape["kind"]) {
    const s = defaultShape(kind);
    onChange({ ...scene, shapes: [...scene.shapes, s] });
    setSelectedId(s.id);
  }

  function updateShape(id: string, patch: Partial<SceneShape>) {
    onChange({
      ...scene,
      shapes: scene.shapes.map((s) =>
        s.id === id ? ({ ...s, ...patch } as SceneShape) : s,
      ),
    });
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
      <Toolbar onAdd={addShape} boundsOpen={boundsOpen} onToggleBounds={() => setBoundsOpen((v) => !v)} />

      {boundsOpen && <ViewBoundsRow scene={scene} onChange={onChange} />}

      <div className="grid gap-0 lg:grid-cols-[1fr_240px]">
        <div className="p-3">
          <SceneCanvas
            scene={scene}
            selectedId={selectedId ?? undefined}
            onSelect={setSelectedId}
            onUpdateShape={updateShape}
          />
        </div>

        <PropertyPanel
          selected={selected}
          correctButtonId={scene.correctButtonId}
          onUpdate={(patch) => selected && updateShape(selected.id, patch)}
          onRemove={() => selected && removeShape(selected.id)}
          onSetCorrect={(buttonId) =>
            onChange({ ...scene, correctButtonId: buttonId })
          }
        />
      </div>

      <HintRow scene={scene} onChange={onChange} />
    </div>
  );
}

function Toolbar({
  onAdd,
  boundsOpen,
  onToggleBounds,
}: {
  onAdd: (kind: SceneShape["kind"]) => void;
  boundsOpen: boolean;
  onToggleBounds: () => void;
}) {
  const items: { kind: SceneShape["kind"]; label: string }[] = [
    { kind: "point", label: "Point" },
    { kind: "line", label: "Line" },
    { kind: "circle", label: "Circle" },
    { kind: "rect", label: "Rectangle" },
    { kind: "text", label: "Text" },
    { kind: "button", label: "Button" },
  ];
  return (
    <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2">
      <div className="flex items-center gap-1">
        {items.map((item) => (
          <button
            key={item.kind}
            type="button"
            onClick={() => onAdd(item.kind)}
            title={`Add ${item.label}`}
            aria-label={`Add ${item.label}`}
            className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100"
          >
            {ICONS[item.kind]}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={onToggleBounds}
        className={
          "rounded-md px-2.5 py-1 text-xs font-medium transition " +
          (boundsOpen
            ? "bg-zinc-800 text-zinc-100"
            : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200")
        }
      >
        Canvas
      </button>
    </div>
  );
}

function PropertyPanel({
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
      <div className="hidden border-l border-zinc-800 p-4 text-xs text-zinc-500 lg:block">
        <p className="font-medium text-zinc-300">No selection</p>
        <p className="mt-1">
          Pick a tool above to add a shape, or click an existing shape to edit
          it.
        </p>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400";

  return (
    <div className="space-y-3 border-l border-zinc-800 p-4">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {selected.kind}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-md p-1 text-zinc-500 transition hover:bg-rose-500/10 hover:text-rose-300"
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

      {(selected.kind === "point" || selected.kind === "text") && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="X"
            value={selected.x}
            onChange={(v) => onUpdate({ x: v })}
            className={fieldClass}
          />
          <NumField
            label="Y"
            value={selected.y}
            onChange={(v) => onUpdate({ y: v })}
            className={fieldClass}
          />
        </div>
      )}
      {selected.kind === "line" && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="X1"
            value={selected.x1}
            onChange={(v) => onUpdate({ x1: v })}
            className={fieldClass}
          />
          <NumField
            label="Y1"
            value={selected.y1}
            onChange={(v) => onUpdate({ y1: v })}
            className={fieldClass}
          />
          <NumField
            label="X2"
            value={selected.x2}
            onChange={(v) => onUpdate({ x2: v })}
            className={fieldClass}
          />
          <NumField
            label="Y2"
            value={selected.y2}
            onChange={(v) => onUpdate({ y2: v })}
            className={fieldClass}
          />
        </div>
      )}
      {(selected.kind === "circle" ||
        selected.kind === "rect" ||
        selected.kind === "button") && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="X"
            value={selected.cx}
            onChange={(v) => onUpdate({ cx: v })}
            className={fieldClass}
          />
          <NumField
            label="Y"
            value={selected.cy}
            onChange={(v) => onUpdate({ cy: v })}
            className={fieldClass}
          />
        </div>
      )}
      {selected.kind === "circle" && (
        <NumField
          label="Radius"
          value={selected.r}
          onChange={(v) => onUpdate({ r: v })}
          className={fieldClass}
        />
      )}
      {(selected.kind === "rect" || selected.kind === "button") && (
        <div className="grid grid-cols-2 gap-2">
          <NumField
            label="W"
            value={selected.w}
            onChange={(v) => onUpdate({ w: v })}
            className={fieldClass}
          />
          <NumField
            label="H"
            value={selected.h}
            onChange={(v) => onUpdate({ h: v })}
            className={fieldClass}
          />
        </div>
      )}

      <ColorRow color={selected.color} onChange={(c) => onUpdate({ color: c })} />

      {(selected.kind === "point" ||
        selected.kind === "circle" ||
        selected.kind === "rect") && (
        <TextField
          label="Label"
          value={selected.label ?? ""}
          onChange={(v) => onUpdate({ label: v })}
          className={fieldClass}
        />
      )}
      {selected.kind === "text" && (
        <TextField
          label="Text"
          value={selected.text}
          onChange={(v) => onUpdate({ text: v })}
          className={fieldClass}
        />
      )}
      {selected.kind === "button" && (
        <>
          <TextField
            label="Label"
            value={selected.label}
            onChange={(v) => onUpdate({ label: v })}
            className={fieldClass}
          />
          <TextField
            label="Button ID"
            value={selected.buttonId}
            onChange={(v) => onUpdate({ buttonId: v })}
            className={fieldClass}
          />
          <label className="flex items-center gap-2 rounded-md bg-zinc-900 px-2 py-1.5 text-xs text-zinc-300 ring-1 ring-zinc-800">
            <input
              type="checkbox"
              checked={correctButtonId === selected.buttonId}
              onChange={(e) =>
                onSetCorrect(e.target.checked ? selected.buttonId : undefined)
              }
              suppressHydrationWarning
              className="accent-cyan-500"
            />
            Correct answer
          </label>
        </>
      )}
    </div>
  );
}

function ColorRow({
  color,
  onChange,
}: {
  color: string;
  onChange: (c: string) => void;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Color
      </label>
      <div className="mt-1 flex flex-wrap gap-1">
        {COLOR_NAMES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            title={c}
            aria-label={c}
            className={
              "h-5 w-5 rounded-full ring-1 transition " +
              (color === c ? "ring-2 ring-cyan-400" : "ring-zinc-800")
            }
            style={{ backgroundColor: COLORS[c] }}
          />
        ))}
      </div>
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

function TextField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className: string;
}) {
  return (
    <div>
      <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
    <div className="grid grid-cols-4 gap-2 border-b border-zinc-800 bg-zinc-925 p-3">
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
