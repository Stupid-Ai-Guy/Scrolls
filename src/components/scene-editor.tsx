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

const W = 480;
const H = 360;

export const DEFAULT_SCENE: Scene = {
  view: { xmin: -8, xmax: 8, ymin: -6, ymax: 6 },
  shapes: [],
};

function uid() {
  return crypto.randomUUID().slice(0, 8);
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

// ---------------- Renderer (shared by editor + player) ----------------

type RendererProps = {
  scene: Scene;
  selectedId?: string;
  clickedButtonId?: string;
  onSelect?: (id: string | null) => void;
  onMove?: (id: string, dx: number, dy: number) => void;
  onClickButton?: (buttonId: string) => void;
};

function SceneCanvas({
  scene,
  selectedId,
  clickedButtonId,
  onSelect,
  onMove,
  onClickButton,
}: RendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{
    id: string;
    startX: number;
    startY: number;
  } | null>(null);

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

  function handleShapeMouseDown(
    e: React.MouseEvent<SVGGElement>,
    id: string,
  ) {
    if (!onMove) return;
    e.stopPropagation();
    onSelect?.(id);
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);
    dragRef.current = { id, startX: wx, startY: wy };
  }

  function handleSvgMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    if (!dragRef.current || !onMove) return;
    const [wx, wy] = svgToWorld(e.clientX, e.clientY);
    const dxw = wx - dragRef.current.startX;
    const dyw = wy - dragRef.current.startY;
    if (Math.abs(dxw) < 0.01 && Math.abs(dyw) < 0.01) return;
    onMove(dragRef.current.id, dxw, dyw);
    dragRef.current.startX = wx;
    dragRef.current.startY = wy;
  }

  function handleSvgMouseUp() {
    dragRef.current = null;
  }

  function handleSvgClick() {
    if (dragRef.current) return;
    onSelect?.(null);
  }

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
        onMouseMove={handleSvgMouseMove}
        onMouseUp={handleSvgMouseUp}
        onMouseLeave={handleSvgMouseUp}
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
            onMouseDown: (e) => handleShapeMouseDown(e, s.id),
          }),
        )}
      </svg>
    </div>
  );
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

  const interact = {
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

  function moveShape(id: string, dxw: number, dyw: number) {
    const s = scene.shapes.find((x) => x.id === id);
    if (!s) return;
    if (s.kind === "point" || s.kind === "text") {
      updateShape(id, { x: round(s.x + dxw), y: round(s.y + dyw) });
    } else if (s.kind === "line") {
      updateShape(id, {
        x1: round(s.x1 + dxw),
        y1: round(s.y1 + dyw),
        x2: round(s.x2 + dxw),
        y2: round(s.y2 + dyw),
      });
    } else {
      updateShape(id, { cx: round(s.cx + dxw), cy: round(s.cy + dyw) });
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_240px]">
        <div className="space-y-3">
          <Toolbar onAdd={addShape} />
          <SceneCanvas
            scene={scene}
            selectedId={selectedId ?? undefined}
            onSelect={setSelectedId}
            onMove={moveShape}
          />
          <ViewBoundsRow scene={scene} onChange={onChange} />
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

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function Toolbar({
  onAdd,
}: {
  onAdd: (kind: SceneShape["kind"]) => void;
}) {
  const items: { kind: SceneShape["kind"]; label: string }[] = [
    { kind: "point", label: "Point" },
    { kind: "line", label: "Line" },
    { kind: "circle", label: "Circle" },
    { kind: "rect", label: "Rect" },
    { kind: "text", label: "Text" },
    { kind: "button", label: "Button" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-zinc-950 p-2 ring-1 ring-zinc-800">
      {items.map((item) => (
        <button
          key={item.kind}
          type="button"
          onClick={() => onAdd(item.kind)}
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-zinc-200 ring-1 ring-zinc-800 hover:bg-zinc-800"
        >
          + {item.label}
        </button>
      ))}
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
      <div className="rounded-xl bg-zinc-950 p-4 text-xs text-zinc-500 ring-1 ring-zinc-800">
        <p className="font-medium text-zinc-300">No selection</p>
        <p className="mt-1">
          Click a shape on the canvas to edit its properties, or add a new one
          from the toolbar.
        </p>
      </div>
    );
  }

  const fieldClass =
    "w-full rounded-md bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-100 ring-1 ring-zinc-800 focus:outline-none focus:ring-2 focus:ring-cyan-400";

  return (
    <div className="space-y-3 rounded-xl bg-zinc-950 p-4 ring-1 ring-zinc-800">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
          {selected.kind}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-medium text-rose-400 hover:text-rose-300"
        >
          Delete
        </button>
      </div>

      {/* Position fields per shape type */}
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
            label="CX"
            value={selected.cx}
            onChange={(v) => onUpdate({ cx: v })}
            className={fieldClass}
          />
          <NumField
            label="CY"
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
            label="Width"
            value={selected.w}
            onChange={(v) => onUpdate({ w: v })}
            className={fieldClass}
          />
          <NumField
            label="Height"
            value={selected.h}
            onChange={(v) => onUpdate({ h: v })}
            className={fieldClass}
          />
        </div>
      )}

      {/* Color */}
      <div>
        <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
          Color
        </label>
        <div className="mt-1 grid grid-cols-6 gap-1">
          {COLOR_NAMES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onUpdate({ color: c })}
              title={c}
              className={
                "h-6 rounded-md ring-1 " +
                (selected.color === c
                  ? "ring-cyan-400 ring-2"
                  : "ring-zinc-800")
              }
              style={{ backgroundColor: COLORS[c] }}
            />
          ))}
        </div>
      </div>

      {/* Label / text */}
      {(selected.kind === "point" ||
        selected.kind === "circle" ||
        selected.kind === "rect") && (
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Label
          </label>
          <input
            value={selected.label ?? ""}
            onChange={(e) => onUpdate({ label: e.target.value })}
            suppressHydrationWarning
            className={`mt-1 ${fieldClass}`}
          />
        </div>
      )}
      {selected.kind === "text" && (
        <div>
          <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Text
          </label>
          <input
            value={selected.text}
            onChange={(e) => onUpdate({ text: e.target.value })}
            suppressHydrationWarning
            className={`mt-1 ${fieldClass}`}
          />
        </div>
      )}
      {selected.kind === "button" && (
        <>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Label
            </label>
            <input
              value={selected.label}
              onChange={(e) => onUpdate({ label: e.target.value })}
              suppressHydrationWarning
              className={`mt-1 ${fieldClass}`}
            />
          </div>
          <div>
            <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Button ID
            </label>
            <input
              value={selected.buttonId}
              onChange={(e) => onUpdate({ buttonId: e.target.value })}
              suppressHydrationWarning
              className={`mt-1 ${fieldClass}`}
            />
          </div>
          <label className="flex items-center gap-2 text-xs text-zinc-300">
            <input
              type="checkbox"
              checked={correctButtonId === selected.buttonId}
              onChange={(e) =>
                onSetCorrect(e.target.checked ? selected.buttonId : undefined)
              }
              suppressHydrationWarning
              className="accent-cyan-500"
            />
            Mark as correct answer
          </label>
        </>
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
    <div className="grid grid-cols-4 gap-2">
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
    <div className="rounded-xl bg-zinc-950 p-4 ring-1 ring-zinc-800">
      <label className="block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Hint (shown when the learner picks the wrong answer)
      </label>
      <input
        value={scene.hint ?? ""}
        onChange={(e) => onChange({ ...scene, hint: e.target.value })}
        placeholder="e.g. Count it on your fingers."
        suppressHydrationWarning
        className="mt-1 w-full rounded-md bg-zinc-900 px-3 py-2 text-sm text-zinc-100 ring-1 ring-zinc-800 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-cyan-400"
      />
    </div>
  );
}
