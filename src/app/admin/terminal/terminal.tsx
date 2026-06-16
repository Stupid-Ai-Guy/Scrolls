"use client";

import { useState } from "react";
import {
  evalStandaloneExpression,
  SAMPLE_BUTTONS,
  SAMPLE_IF,
  SAMPLE_SCROLLSCRIPT,
  ScrollScriptError,
  type Env,
  type Value,
} from "@/lib/scrollscript";
import ScrollScriptRunner from "@/components/scrollscript-runner";
import ScrollScriptEditor from "@/components/scrollscript-editor";

type ReplLine =
  | { kind: "input"; text: string }
  | { kind: "output"; text: string }
  | { kind: "error"; text: string };

function formatValue(v: Value): string {
  if (typeof v === "string") return `"${v}"`;
  if (Number.isInteger(v)) return String(v);
  return v.toFixed(4).replace(/\.?0+$/, "");
}

export default function Terminal() {
  const [code, setCode] = useState(SAMPLE_SCROLLSCRIPT);
  const [env, setEnv] = useState<Env>({});
  const [replInput, setReplInput] = useState("");
  const [history, setHistory] = useState<ReplLine[]>([]);

  function loadSample(s: string) {
    setCode(s);
    setHistory([]);
  }

  function runRepl() {
    const expr = replInput.trim();
    if (!expr) return;
    const lines: ReplLine[] = [{ kind: "input", text: expr }];
    try {
      const result = evalStandaloneExpression(expr, env);
      lines.push({ kind: "output", text: formatValue(result) });
    } catch (e) {
      lines.push({
        kind: "error",
        text:
          e instanceof ScrollScriptError
            ? e.message
            : e instanceof Error
              ? e.message
              : String(e),
      });
    }
    setHistory((h) => [...h, ...lines]);
    setReplInput("");
  }

  const lineCount = code.split("\n").length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-zinc-950 p-3 ring-1 ring-zinc-800">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-medium text-zinc-500">Samples</span>
          <button
            type="button"
            onClick={() => loadSample(SAMPLE_SCROLLSCRIPT)}
            className="rounded-full bg-zinc-900 px-3 py-1 font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Angle
          </button>
          <button
            type="button"
            onClick={() => loadSample(SAMPLE_BUTTONS)}
            className="rounded-full bg-zinc-900 px-3 py-1 font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100"
          >
            Buttons
          </button>
          <button
            type="button"
            onClick={() => loadSample(SAMPLE_IF)}
            className="rounded-full bg-zinc-900 px-3 py-1 font-medium text-zinc-300 ring-1 ring-zinc-800 hover:bg-zinc-800 hover:text-zinc-100"
          >
            If/elif
          </button>
          <button
            type="button"
            onClick={() => {
              setCode("");
              setHistory([]);
            }}
            className="rounded-full px-3 py-1 font-medium text-zinc-500 hover:bg-zinc-900 hover:text-zinc-300"
          >
            Clear
          </button>
        </div>
        <div className="text-xs text-zinc-500">
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_1fr]">
        <ScrollScriptEditor
          value={code}
          onChange={setCode}
          minRows={20}
          label="scroll.script"
        />
        <PreviewPane code={code} onEnvChange={setEnv} env={env} />
      </div>

      <ReplPanel
        input={replInput}
        history={history}
        onInputChange={setReplInput}
        onRun={runRepl}
        onClear={() => setHistory([])}
      />
    </div>
  );
}

function PreviewPane({
  code,
  env,
  onEnvChange,
}: {
  code: string;
  env: Env;
  onEnvChange: (env: Env) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
        <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-2.5">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Preview
          </span>
        </div>
        <div className="p-5">
          <ScrollScriptRunner code={code} onEnvChange={onEnvChange} />
        </div>
      </div>

      <VariablesPanel env={env} />
    </div>
  );
}

function VariablesPanel({ env }: { env: Env }) {
  const entries = Object.entries(env);
  if (entries.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
      <div className="border-b border-zinc-900 px-5 py-2.5">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Variables
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 px-5 py-4 font-mono text-xs sm:grid-cols-3">
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="flex items-baseline justify-between gap-2 truncate"
          >
            <span className="truncate text-zinc-500">{k}</span>
            <span className="truncate text-cyan-300">{formatValue(v)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReplPanel({
  input,
  history,
  onInputChange,
  onRun,
  onClear,
}: {
  input: string;
  history: ReplLine[];
  onInputChange: (v: string) => void;
  onRun: () => void;
  onClear: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl bg-zinc-950 ring-1 ring-zinc-800">
      <div className="flex items-center justify-between border-b border-zinc-900 px-5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
            REPL
          </span>
          <span className="text-xs text-zinc-500">
            evaluates against the running program
          </span>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs font-medium text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
        >
          Clear
        </button>
      </div>

      <div className="max-h-60 overflow-y-auto px-5 py-3 font-mono text-[13px] leading-6">
        {history.length === 0 ? (
          <p className="italic text-zinc-500">
            Type an expression and press Enter. Try{" "}
            <span className="text-cyan-300">cos(0)</span>,{" "}
            <span className="text-cyan-300">x + y</span>, or{" "}
            <span className="text-cyan-300">clicked</span>.
          </p>
        ) : (
          history.map((line, i) => {
            if (line.kind === "input")
              return (
                <div key={i} className="text-zinc-300">
                  <span className="text-cyan-400">{"› "}</span>
                  {line.text}
                </div>
              );
            if (line.kind === "error")
              return (
                <div key={i} className="text-rose-400">
                  {line.text}
                </div>
              );
            return (
              <div key={i} className="text-emerald-300">
                {line.text}
              </div>
            );
          })
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onRun();
        }}
        className="flex items-center gap-2 border-t border-zinc-900 px-5 py-3"
      >
        <span className="font-mono text-sm font-bold text-cyan-400">›</span>
        <input
          value={input}
          onChange={(e) => onInputChange(e.target.value)}
          spellCheck={false}
          placeholder="sin(pi / 2)"
          autoComplete="off"
          suppressHydrationWarning
          className="flex-1 bg-transparent font-mono text-[13px] text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-cyan-500 px-3 py-1 text-xs font-semibold text-black hover:bg-cyan-400"
        >
          Run
        </button>
      </form>
    </div>
  );
}
