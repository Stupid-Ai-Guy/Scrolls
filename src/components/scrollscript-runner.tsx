"use client";

import { useEffect, useMemo, useState } from "react";
import {
  COLORS,
  parse,
  runProgram,
  ScrollScriptError,
  type Env,
  type Program,
  type Shape,
} from "@/lib/scrollscript";

type Props = {
  code: string;
  showCheck?: boolean;
  onCheckResult?: (correct: boolean) => void;
  onEnvChange?: (env: Env) => void;
};

export default function ScrollScriptRunner({
  code,
  showCheck = true,
  onCheckResult,
  onEnvChange,
}: Props) {
  const parsed = useMemo<
    { ok: true; program: Program } | { ok: false; error: string }
  >(() => {
    try {
      return { ok: true, program: parse(code) };
    } catch (e) {
      if (e instanceof ScrollScriptError)
        return { ok: false, error: e.message };
      return { ok: false, error: String(e) };
    }
  }, [code]);

  if (!parsed.ok) {
    return (
      <div className="rounded-xl bg-rose-50 p-5 text-sm text-rose-700 ring-1 ring-rose-200">
        <p className="font-semibold">Couldn&apos;t run this lesson</p>
        <p className="mt-1 font-mono text-xs">{parsed.error}</p>
      </div>
    );
  }

  return (
    <Runner
      program={parsed.program}
      showCheck={showCheck}
      onCheckResult={onCheckResult}
      onEnvChange={onEnvChange}
    />
  );
}

function Runner({
  program,
  showCheck,
  onCheckResult,
  onEnvChange,
}: {
  program: Program;
  showCheck: boolean;
  onCheckResult?: (correct: boolean) => void;
  onEnvChange?: (env: Env) => void;
}) {
  const initial = useMemo(() => {
    const o: Record<string, number> = {};
    for (const s of program.sliders) o[s.name] = s.default;
    return o;
  }, [program]);
  const [values, setValues] = useState<Record<string, number>>(initial);
  const [clicked, setClicked] = useState<string>("");
  const [checkState, setCheckState] = useState<
    { checked: false } | { checked: true; correct: boolean }
  >({ checked: false });

  const { shapes, lastCheck, lastEnv, runError } = useMemo(() => {
    try {
      const result = runProgram(program, { ...values, clicked });
      return {
        shapes: result.shapes,
        lastCheck: result.check,
        lastEnv: result.env,
        runError: null as string | null,
      };
    } catch (e) {
      return {
        shapes: [] as Shape[],
        lastCheck: undefined as boolean | undefined,
        lastEnv: {} as Env,
        runError: e instanceof Error ? e.message : String(e),
      };
    }
  }, [program, values, clicked]);

  const envKey = JSON.stringify(lastEnv);
  useEffect(() => {
    onEnvChange?.(lastEnv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envKey]);

  function handleClickShape(id: string) {
    setClicked(id);
    setCheckState({ checked: false });
  }

  function handleCheck() {
    if (lastCheck === undefined) return;
    setCheckState({ checked: true, correct: lastCheck });
    onCheckResult?.(lastCheck);
  }

  function handleReset() {
    setValues(initial);
    setClicked("");
    setCheckState({ checked: false });
  }

  return (
    <div className="space-y-4">
      {program.sliders.length > 0 && (
        <div className="space-y-3">
          {program.sliders.map((s) => (
            <div key={s.name}>
              <div className="flex items-baseline justify-between">
                <label
                  htmlFor={`slider-${s.name}`}
                  className="text-sm font-medium text-slate-700"
                >
                  {s.label ?? s.name}
                </label>
                <span className="text-xs font-mono text-slate-500">
                  {formatNumber(values[s.name] ?? s.default)}
                </span>
              </div>
              <input
                id={`slider-${s.name}`}
                type="range"
                min={s.min}
                max={s.max}
                step={(s.max - s.min) / 200}
                value={values[s.name] ?? s.default}
                suppressHydrationWarning
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  setValues((prev) => ({ ...prev, [s.name]: v }));
                  setCheckState({ checked: false });
                }}
                className="mt-1 w-full accent-emerald-600"
              />
            </div>
          ))}
        </div>
      )}

      <SceneSvg
        view={program.view}
        shapes={shapes}
        clicked={clicked}
        onClickShape={handleClickShape}
      />

      {runError && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700 ring-1 ring-rose-200">
          {runError}
        </div>
      )}

      {showCheck && program.check && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCheck}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
          >
            Check
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Reset
          </button>
        </div>
      )}

      {showCheck && checkState.checked && (
        <div
          className={
            "rounded-xl p-4 text-sm ring-1 " +
            (checkState.correct
              ? "bg-emerald-50 text-emerald-900 ring-emerald-200"
              : "bg-rose-50 text-rose-900 ring-rose-200")
          }
        >
          <p className="font-semibold">
            {checkState.correct ? "Correct" : "Not yet"}
          </p>
          {!checkState.correct && program.hint && (
            <p className="mt-1 text-slate-700">{program.hint}</p>
          )}
        </div>
      )}
    </div>
  );
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(2);
}

const W = 480;
const H = 360;

function SceneSvg({
  view,
  shapes,
  clicked,
  onClickShape,
}: {
  view: { xmin: number; xmax: number; ymin: number; ymax: number };
  shapes: Shape[];
  clicked: string;
  onClickShape: (id: string) => void;
}) {
  const { xmin, xmax, ymin, ymax } = view;
  const dx = xmax - xmin;
  const dy = ymax - ymin;
  const toX = (wx: number) => ((wx - xmin) / dx) * W;
  const toY = (wy: number) => ((ymax - wy) / dy) * H;
  const showXAxis = ymin <= 0 && ymax >= 0;
  const showYAxis = xmin <= 0 && xmax >= 0;

  return (
    <div className="overflow-hidden rounded-xl bg-zinc-900 ring-1 ring-zinc-800">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block h-auto w-full"
        preserveAspectRatio="xMidYMid meet"
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

        {shapes.map((s, idx) => renderShape(s, idx, toX, toY, dx, W, clicked, onClickShape))}
      </svg>
    </div>
  );
}

function renderShape(
  s: Shape,
  idx: number,
  toX: (wx: number) => number,
  toY: (wy: number) => number,
  dx: number,
  W: number,
  clicked: string,
  onClickShape: (id: string) => void,
) {
  const color = COLORS[s.color] ?? s.color;

  if (s.kind === "circle") {
    const r = (s.r / dx) * W;
    return (
      <g key={idx}>
        <circle
          cx={toX(s.cx)}
          cy={toY(s.cy)}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="2"
        />
        {s.label && (
          <text
            x={toX(s.cx)}
            y={toY(s.cy) + 5}
            fill={color}
            fontSize="14"
            fontWeight="600"
            fontFamily="ui-sans-serif, system-ui"
            textAnchor="middle"
          >
            {s.label}
          </text>
        )}
      </g>
    );
  }
  if (s.kind === "line") {
    return (
      <line
        key={idx}
        x1={toX(s.x1)}
        y1={toY(s.y1)}
        x2={toX(s.x2)}
        y2={toY(s.y2)}
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    );
  }
  if (s.kind === "rect") {
    const w = (s.w / dx) * W;
    const h = (s.h / dx) * W;
    return (
      <g key={idx}>
        <rect
          x={toX(s.cx) - w / 2}
          y={toY(s.cy) - h / 2}
          width={w}
          height={h}
          fill="none"
          stroke={color}
          strokeWidth="2"
          rx="4"
        />
        {s.label && (
          <text
            x={toX(s.cx)}
            y={toY(s.cy) + 5}
            fill={color}
            fontSize="14"
            fontWeight="600"
            fontFamily="ui-sans-serif, system-ui"
            textAnchor="middle"
          >
            {s.label}
          </text>
        )}
      </g>
    );
  }
  if (s.kind === "text") {
    return (
      <text
        key={idx}
        x={toX(s.x)}
        y={toY(s.y) + 5}
        fill={color}
        fontSize="15"
        fontWeight="500"
        fontFamily="ui-sans-serif, system-ui"
        textAnchor="middle"
      >
        {s.text}
      </text>
    );
  }
  if (s.kind === "button") {
    const w = (s.w / dx) * W;
    const h = (s.h / dx) * W;
    const isActive = clicked === s.id;
    const fill = isActive ? color : "#18181b";
    const textFill = isActive ? "#0a0a0a" : color;
    return (
      <g
        key={idx}
        style={{ cursor: "pointer" }}
        onClick={() => onClickShape(s.id)}
      >
        <rect
          x={toX(s.cx) - w / 2}
          y={toY(s.cy) - h / 2}
          width={w}
          height={h}
          fill={fill}
          stroke={color}
          strokeWidth="2"
          rx="8"
        />
        <text
          x={toX(s.cx)}
          y={toY(s.cy) + 5}
          fill={textFill}
          fontSize="15"
          fontWeight="600"
          fontFamily="ui-sans-serif, system-ui"
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
    <g key={idx}>
      <circle cx={toX(s.x)} cy={toY(s.y)} r={6} fill={color} />
      {s.label && (
        <text
          x={toX(s.x) + 10}
          y={toY(s.y) - 8}
          fill={color}
          fontSize="13"
          fontWeight="600"
          fontFamily="ui-sans-serif, system-ui"
        >
          {s.label}
        </text>
      )}
    </g>
  );
}
