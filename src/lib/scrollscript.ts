export type Expr =
  | { kind: "num"; value: number }
  | { kind: "str"; value: string }
  | { kind: "var"; name: string }
  | { kind: "bin"; op: BinOp; left: Expr; right: Expr }
  | { kind: "unary"; op: "-" | "not"; operand: Expr }
  | { kind: "call"; name: string; args: Expr[] };

export type BinOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "^"
  | "<"
  | ">"
  | "<="
  | ">="
  | "=="
  | "!="
  | "and"
  | "or";

export type Slider = {
  name: string;
  min: number;
  max: number;
  default: number;
  label?: string;
};

export type Shape =
  | { kind: "point"; x: number; y: number; color: string; label?: string }
  | {
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }
  | {
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      color: string;
      label?: string;
    }
  | {
      kind: "rect";
      cx: number;
      cy: number;
      w: number;
      h: number;
      color: string;
      label?: string;
    }
  | { kind: "text"; x: number; y: number; text: string; color: string }
  | {
      kind: "button";
      cx: number;
      cy: number;
      w: number;
      h: number;
      label: string;
      id: string;
      color: string;
    };

type IfBranch = { cond: Expr; body: Statement[] };

export type Statement =
  | { kind: "view"; xmin: number; xmax: number; ymin: number; ymax: number }
  | { kind: "slider"; slider: Slider }
  | { kind: "assign"; name: string; expr: Expr }
  | { kind: "if"; branches: IfBranch[]; else?: Statement[] }
  | {
      kind: "point";
      x: Expr;
      y: Expr;
      color?: string;
      label?: string;
    }
  | {
      kind: "line";
      x1: Expr;
      y1: Expr;
      x2: Expr;
      y2: Expr;
      color?: string;
    }
  | {
      kind: "circle";
      cx: Expr;
      cy: Expr;
      r: Expr;
      color?: string;
      label?: string;
    }
  | {
      kind: "rect";
      cx: Expr;
      cy: Expr;
      w: Expr;
      h: Expr;
      color?: string;
      label?: string;
    }
  | { kind: "text"; x: Expr; y: Expr; text: string; color?: string }
  | {
      kind: "button";
      cx: Expr;
      cy: Expr;
      w: Expr;
      h: Expr;
      label: string;
      id: string;
      color?: string;
    }
  | { kind: "check"; expr: Expr }
  | { kind: "hint"; text: string };

export type Program = {
  sliders: Slider[];
  view: { xmin: number; xmax: number; ymin: number; ymax: number };
  statements: Statement[];
  check?: Expr;
  hint?: string;
};

export const COLORS: Record<string, string> = {
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
  gray: "#9ca3af",
  black: "#0f172a",
  white: "#ffffff",
};

export const FUNCTIONS = new Set([
  "sin",
  "cos",
  "tan",
  "sqrt",
  "abs",
  "min",
  "max",
  "floor",
  "ceil",
  "round",
]);

export const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

export const STATEMENT_KEYWORDS = new Set([
  "view",
  "slider",
  "point",
  "line",
  "circle",
  "rect",
  "text",
  "check",
  "hint",
  "if",
]);

export const PROPERTY_NAMES = new Set([
  "cords",
  "from",
  "to",
  "dims",
  "color",
  "type",
  "label",
  "id",
  "value",
]);

export const RESERVED = new Set([
  ...STATEMENT_KEYWORDS,
  "elif",
  "else",
  "end",
  "and",
  "or",
  "not",
]);

const BLOCK_INNER_FORBIDDEN = new Set(["view", "slider", "check", "hint"]);

export class ScrollScriptError extends Error {
  line: number;
  constructor(message: string, line: number) {
    super(`Line ${line}: ${message}`);
    this.line = line;
  }
}

type Tok =
  | { kind: "IDENT"; name: string; line: number }
  | { kind: "NUM"; value: number; line: number }
  | { kind: "STR"; value: string; line: number }
  | { kind: "LPAREN"; line: number }
  | { kind: "RPAREN"; line: number }
  | { kind: "COMMA"; line: number }
  | { kind: "OP"; op: string; line: number }
  | { kind: "EQ"; line: number }
  | { kind: "NL"; line: number }
  | { kind: "EOF"; line: number };

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let line = 1;
  let i = 0;

  while (i < src.length) {
    const c = src[i];
    if (c === "\n") {
      toks.push({ kind: "NL", line });
      line++;
      i++;
      continue;
    }
    if (c === " " || c === "\t" || c === "\r") {
      i++;
      continue;
    }
    if (c === "#") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === '"') {
      i++;
      const start = i;
      while (i < src.length && src[i] !== '"') {
        if (src[i] === "\n")
          throw new ScrollScriptError("Unterminated string", line);
        i++;
      }
      if (i >= src.length)
        throw new ScrollScriptError("Unterminated string", line);
      toks.push({ kind: "STR", value: src.slice(start, i), line });
      i++;
      continue;
    }
    if (c === "(") {
      toks.push({ kind: "LPAREN", line });
      i++;
      continue;
    }
    if (c === ")") {
      toks.push({ kind: "RPAREN", line });
      i++;
      continue;
    }
    if (c === ",") {
      toks.push({ kind: "COMMA", line });
      i++;
      continue;
    }
    if (/[0-9]/.test(c) || (c === "." && /[0-9]/.test(src[i + 1] ?? ""))) {
      const start = i;
      let sawDot = false;
      while (i < src.length) {
        const ch = src[i];
        if (ch === ".") {
          if (sawDot) break;
          sawDot = true;
          i++;
          continue;
        }
        if (/[0-9]/.test(ch)) {
          i++;
          continue;
        }
        break;
      }
      toks.push({ kind: "NUM", value: parseFloat(src.slice(start, i)), line });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      const start = i;
      while (i < src.length && /[a-zA-Z_0-9]/.test(src[i])) i++;
      toks.push({ kind: "IDENT", name: src.slice(start, i), line });
      continue;
    }
    if (c === "<" && src[i + 1] === "=") {
      toks.push({ kind: "OP", op: "<=", line });
      i += 2;
      continue;
    }
    if (c === ">" && src[i + 1] === "=") {
      toks.push({ kind: "OP", op: ">=", line });
      i += 2;
      continue;
    }
    if (c === "=" && src[i + 1] === "=") {
      toks.push({ kind: "OP", op: "==", line });
      i += 2;
      continue;
    }
    if (c === "!" && src[i + 1] === "=") {
      toks.push({ kind: "OP", op: "!=", line });
      i += 2;
      continue;
    }
    if (c === "=") {
      toks.push({ kind: "EQ", line });
      i++;
      continue;
    }
    if ("+-*/^<>".includes(c)) {
      toks.push({ kind: "OP", op: c, line });
      i++;
      continue;
    }
    throw new ScrollScriptError(`Unexpected character '${c}'`, line);
  }
  toks.push({ kind: "EOF", line });
  return toks;
}

type Props = {
  cords?: Expr[];
  from?: Expr[];
  to?: Expr[];
  dims?: Expr[];
  color?: string;
  type?: string;
  label?: string;
  id?: string;
  value?: string;
};

class Parser {
  private i = 0;
  constructor(private toks: Tok[]) {}

  peek(): Tok {
    return this.toks[this.i];
  }
  peekAt(offset: number): Tok {
    return this.toks[this.i + offset] ?? this.toks[this.toks.length - 1];
  }
  advance(): Tok {
    return this.toks[this.i++];
  }
  atEnd(): boolean {
    return this.peek().kind === "EOF";
  }
  atLineEnd(): boolean {
    const t = this.peek();
    return t.kind === "NL" || t.kind === "EOF";
  }
  skipNewlines(): void {
    while (this.peek().kind === "NL") this.advance();
  }
  consumeNewline(): void {
    if (this.peek().kind === "NL") this.advance();
    else if (this.peek().kind !== "EOF") {
      const t = this.peek();
      throw new ScrollScriptError(
        `Expected end of line, got ${describe(t)}`,
        t.line,
      );
    }
  }

  expect<K extends Tok["kind"]>(kind: K): Extract<Tok, { kind: K }> {
    const t = this.advance();
    if (t.kind !== kind) {
      throw new ScrollScriptError(
        `Expected ${friendly(kind)}, got ${describe(t)}`,
        t.line,
      );
    }
    return t as Extract<Tok, { kind: K }>;
  }

  peekIdent(name: string): boolean {
    const t = this.peek();
    return t.kind === "IDENT" && t.name === name;
  }

  parseSignedNumber(): number {
    const t = this.peek();
    if (t.kind === "OP" && t.op === "-") {
      this.advance();
      return -this.expect("NUM").value;
    }
    return this.expect("NUM").value;
  }

  parseProgram(): Program {
    const program: Program = {
      sliders: [],
      view: { xmin: -10, xmax: 10, ymin: -10, ymax: 10 },
      statements: [],
    };

    while (!this.atEnd()) {
      this.skipNewlines();
      if (this.atEnd()) break;

      const stmt = this.parseStatement();
      if (stmt.kind === "view") {
        program.view = {
          xmin: stmt.xmin,
          xmax: stmt.xmax,
          ymin: stmt.ymin,
          ymax: stmt.ymax,
        };
      } else if (stmt.kind === "slider") {
        program.sliders.push(stmt.slider);
        program.statements.push(stmt);
      } else if (stmt.kind === "check") {
        program.check = stmt.expr;
      } else if (stmt.kind === "hint") {
        program.hint = stmt.text;
      } else {
        program.statements.push(stmt);
      }

      this.consumeNewline();
    }
    return program;
  }

  parseStatement(): Statement {
    const t = this.peek();
    if (t.kind !== "IDENT") {
      throw new ScrollScriptError(
        `Expected a command, got ${describe(t)}`,
        t.line,
      );
    }

    if (STATEMENT_KEYWORDS.has(t.name)) {
      this.advance();
      switch (t.name) {
        case "view":
          return this.parseView();
        case "slider":
          return this.parseSlider();
        case "point":
          return this.parsePoint(t.line);
        case "line":
          return this.parseLine(t.line);
        case "circle":
          return this.parseCircle(t.line);
        case "rect":
          return this.parseRect(t.line);
        case "text":
          return this.parseText(t.line);
        case "check":
          return this.parseCheck();
        case "hint":
          return this.parseHint();
        case "if":
          return this.parseIf();
      }
    }

    // Assignment: NAME = EXPR
    if (this.peekAt(1).kind === "EQ") {
      const name = this.expect("IDENT").name;
      if (RESERVED.has(name)) {
        throw new ScrollScriptError(
          `'${name}' is reserved and can't be assigned`,
          t.line,
        );
      }
      this.expect("EQ");
      const expr = this.parseExpr();
      return { kind: "assign", name, expr };
    }

    throw new ScrollScriptError(
      `Unknown command '${t.name}'`,
      t.line,
    );
  }

  private parseView(): Statement {
    const xmin = this.parseSignedNumber();
    const xmax = this.parseSignedNumber();
    const ymin = this.parseSignedNumber();
    const ymax = this.parseSignedNumber();
    return { kind: "view", xmin, xmax, ymin, ymax };
  }

  private parseSlider(): Statement {
    const name = this.expect("IDENT").name;
    const min = this.parseSignedNumber();
    const max = this.parseSignedNumber();
    const def = this.parseSignedNumber();
    let label: string | undefined;
    if (this.peek().kind === "STR") label = this.expect("STR").value;
    return { kind: "slider", slider: { name, min, max, default: def, label } };
  }

  private parseProperties(): Props {
    const props: Props = {};
    while (!this.atLineEnd()) {
      const t = this.peek();
      if (t.kind !== "IDENT") {
        throw new ScrollScriptError(
          `Expected a property like cords(…), got ${describe(t)}`,
          t.line,
        );
      }
      this.advance();
      const name = t.name;
      if (!PROPERTY_NAMES.has(name)) {
        throw new ScrollScriptError(
          `Unknown property '${name}'`,
          t.line,
        );
      }
      this.expect("LPAREN");

      if (name === "cords" || name === "from" || name === "to" || name === "dims") {
        if (props[name as "cords"] !== undefined) {
          throw new ScrollScriptError(`Duplicate '${name}'`, t.line);
        }
        const exprs: Expr[] = [this.parseExpr()];
        while (this.peek().kind === "COMMA") {
          this.advance();
          exprs.push(this.parseExpr());
        }
        (props as Record<string, Expr[]>)[name] = exprs;
      } else if (name === "color" || name === "type") {
        if (props[name] !== undefined) {
          throw new ScrollScriptError(`Duplicate '${name}'`, t.line);
        }
        (props as Record<string, string>)[name] = this.expect("IDENT").name;
      } else {
        // label, id, value
        if (props[name as "label"] !== undefined) {
          throw new ScrollScriptError(`Duplicate '${name}'`, t.line);
        }
        (props as Record<string, string>)[name] = this.expect("STR").value;
      }

      this.expect("RPAREN");
    }
    return props;
  }

  private requirePair(
    props: Props,
    name: "cords" | "from" | "to",
    line: number,
    shape: string,
  ): [Expr, Expr] {
    const arr = props[name];
    if (!arr || arr.length !== 2) {
      throw new ScrollScriptError(
        `${shape} needs ${name}(x, y)`,
        line,
      );
    }
    return [arr[0], arr[1]];
  }

  private requireDims(
    props: Props,
    n: 1 | 2,
    line: number,
    shape: string,
  ): Expr[] {
    if (!props.dims || props.dims.length !== n) {
      const example =
        n === 1 ? "dims(radius)" : "dims(width, height)";
      throw new ScrollScriptError(`${shape} needs ${example}`, line);
    }
    return props.dims;
  }

  private parsePoint(line: number): Statement {
    const props = this.parseProperties();
    const [x, y] = this.requirePair(props, "cords", line, "point");
    return {
      kind: "point",
      x,
      y,
      color: props.color,
      label: props.label,
    };
  }

  private parseLine(line: number): Statement {
    const props = this.parseProperties();
    const [x1, y1] = this.requirePair(props, "from", line, "line");
    const [x2, y2] = this.requirePair(props, "to", line, "line");
    return {
      kind: "line",
      x1,
      y1,
      x2,
      y2,
      color: props.color,
    };
  }

  private parseCircle(line: number): Statement {
    const props = this.parseProperties();
    const [cx, cy] = this.requirePair(props, "cords", line, "circle");
    const [r] = this.requireDims(props, 1, line, "circle");
    return {
      kind: "circle",
      cx,
      cy,
      r,
      color: props.color,
      label: props.label,
    };
  }

  private parseRect(line: number): Statement {
    const props = this.parseProperties();
    const [cx, cy] = this.requirePair(props, "cords", line, "rect");
    const [w, h] = this.requireDims(props, 2, line, "rect");
    if (props.type === "button") {
      if (!props.id) {
        throw new ScrollScriptError(
          `type(button) needs id("…")`,
          line,
        );
      }
      if (!props.label) {
        throw new ScrollScriptError(
          `type(button) needs label("…")`,
          line,
        );
      }
      return {
        kind: "button",
        cx,
        cy,
        w,
        h,
        label: props.label,
        id: props.id,
        color: props.color,
      };
    }
    if (props.type && props.type !== "static") {
      throw new ScrollScriptError(
        `type() must be 'static' or 'button'`,
        line,
      );
    }
    return {
      kind: "rect",
      cx,
      cy,
      w,
      h,
      color: props.color,
      label: props.label,
    };
  }

  private parseText(line: number): Statement {
    const props = this.parseProperties();
    const [x, y] = this.requirePair(props, "cords", line, "text");
    if (!props.value) {
      throw new ScrollScriptError(
        `text needs value("…")`,
        line,
      );
    }
    return {
      kind: "text",
      x,
      y,
      text: props.value,
      color: props.color,
    };
  }

  private parseCheck(): Statement {
    const expr = this.parseExpr();
    return { kind: "check", expr };
  }

  private parseHint(): Statement {
    const text = this.expect("STR").value;
    return { kind: "hint", text };
  }

  private parseIf(): Statement {
    const branches: IfBranch[] = [];
    const cond = this.parseExpr();
    this.consumeNewline();
    branches.push({ cond, body: this.parseBlock() });

    while (this.peekIdent("elif")) {
      this.advance();
      const c = this.parseExpr();
      this.consumeNewline();
      branches.push({ cond: c, body: this.parseBlock() });
    }

    let elseBody: Statement[] | undefined;
    if (this.peekIdent("else")) {
      this.advance();
      this.consumeNewline();
      elseBody = this.parseBlock();
    }

    if (!this.peekIdent("end")) {
      const t = this.peek();
      throw new ScrollScriptError(
        `Expected 'end' to close 'if', got ${describe(t)}`,
        t.line,
      );
    }
    this.advance();
    return { kind: "if", branches, else: elseBody };
  }

  private parseBlock(): Statement[] {
    const stmts: Statement[] = [];
    while (true) {
      this.skipNewlines();
      const t = this.peek();
      if (t.kind === "EOF") {
        throw new ScrollScriptError("Unexpected end of input inside block", t.line);
      }
      if (
        t.kind === "IDENT" &&
        (t.name === "elif" || t.name === "else" || t.name === "end")
      ) {
        break;
      }
      const stmt = this.parseStatement();
      if (BLOCK_INNER_FORBIDDEN.has(stmt.kind)) {
        throw new ScrollScriptError(
          `'${stmt.kind}' can only be used at the top level`,
          t.line,
        );
      }
      stmts.push(stmt);
      this.consumeNewline();
    }
    return stmts;
  }

  parseExpr(): Expr {
    return this.parseOr();
  }
  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.peekIdent("or")) {
      this.advance();
      left = { kind: "bin", op: "or", left, right: this.parseAnd() };
    }
    return left;
  }
  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.peekIdent("and")) {
      this.advance();
      left = { kind: "bin", op: "and", left, right: this.parseNot() };
    }
    return left;
  }
  private parseNot(): Expr {
    if (this.peekIdent("not")) {
      this.advance();
      return { kind: "unary", op: "not", operand: this.parseNot() };
    }
    return this.parseCmp();
  }
  private parseCmp(): Expr {
    const left = this.parseAdd();
    const t = this.peek();
    if (
      t.kind === "OP" &&
      (t.op === "<" ||
        t.op === ">" ||
        t.op === "<=" ||
        t.op === ">=" ||
        t.op === "==" ||
        t.op === "!=")
    ) {
      this.advance();
      return {
        kind: "bin",
        op: t.op as BinOp,
        left,
        right: this.parseAdd(),
      };
    }
    return left;
  }
  private parseAdd(): Expr {
    let left = this.parseMul();
    while (true) {
      const t = this.peek();
      if (t.kind === "OP" && (t.op === "+" || t.op === "-")) {
        this.advance();
        left = {
          kind: "bin",
          op: t.op as BinOp,
          left,
          right: this.parseMul(),
        };
      } else break;
    }
    return left;
  }
  private parseMul(): Expr {
    let left = this.parsePow();
    while (true) {
      const t = this.peek();
      if (t.kind === "OP" && (t.op === "*" || t.op === "/")) {
        this.advance();
        left = {
          kind: "bin",
          op: t.op as BinOp,
          left,
          right: this.parsePow(),
        };
      } else break;
    }
    return left;
  }
  private parsePow(): Expr {
    const base = this.parseUnary();
    const t = this.peek();
    if (t.kind === "OP" && t.op === "^") {
      this.advance();
      return { kind: "bin", op: "^", left: base, right: this.parsePow() };
    }
    return base;
  }
  private parseUnary(): Expr {
    const t = this.peek();
    if (t.kind === "OP" && t.op === "-") {
      this.advance();
      return { kind: "unary", op: "-", operand: this.parseUnary() };
    }
    return this.parsePrimary();
  }
  parsePrimary(): Expr {
    const t = this.peek();
    if (t.kind === "OP" && t.op === "-") {
      this.advance();
      return { kind: "unary", op: "-", operand: this.parsePrimary() };
    }
    if (t.kind === "NUM") {
      this.advance();
      return { kind: "num", value: t.value };
    }
    if (t.kind === "STR") {
      this.advance();
      return { kind: "str", value: t.value };
    }
    if (t.kind === "LPAREN") {
      this.advance();
      const e = this.parseExpr();
      this.expect("RPAREN");
      return e;
    }
    if (t.kind === "IDENT") {
      this.advance();
      if (this.peek().kind === "LPAREN" && FUNCTIONS.has(t.name)) {
        this.advance();
        const args: Expr[] = [];
        if (this.peek().kind !== "RPAREN") {
          args.push(this.parseExpr());
          while (this.peek().kind === "COMMA") {
            this.advance();
            args.push(this.parseExpr());
          }
        }
        this.expect("RPAREN");
        return { kind: "call", name: t.name, args };
      }
      if (t.name in CONSTANTS) {
        return { kind: "num", value: CONSTANTS[t.name] };
      }
      if (
        RESERVED.has(t.name) &&
        t.name !== "and" &&
        t.name !== "or" &&
        t.name !== "not"
      ) {
        throw new ScrollScriptError(
          `Unexpected keyword '${t.name}' in expression`,
          t.line,
        );
      }
      return { kind: "var", name: t.name };
    }
    throw new ScrollScriptError(
      `Expected expression, got ${describe(t)}`,
      t.line,
    );
  }
}

function friendly(kind: Tok["kind"]): string {
  switch (kind) {
    case "IDENT":
      return "a name";
    case "NUM":
      return "a number";
    case "STR":
      return "a string";
    case "LPAREN":
      return "'('";
    case "RPAREN":
      return "')'";
    case "COMMA":
      return "','";
    case "OP":
      return "an operator";
    case "EQ":
      return "'='";
    case "NL":
      return "end of line";
    case "EOF":
      return "end of input";
  }
}

function describe(t: Tok): string {
  if (t.kind === "NUM") return String(t.value);
  if (t.kind === "IDENT") return `'${t.name}'`;
  if (t.kind === "STR") return `"${t.value}"`;
  if (t.kind === "LPAREN") return "'('";
  if (t.kind === "RPAREN") return "')'";
  if (t.kind === "COMMA") return "','";
  if (t.kind === "OP") return `'${t.op}'`;
  if (t.kind === "EQ") return "'='";
  if (t.kind === "NL") return "newline";
  return "end of input";
}

export function parse(source: string): Program {
  return new Parser(tokenize(source)).parseProgram();
}

export type Value = number | string;
export type Env = Record<string, Value>;

function asNumber(v: Value, op: string): number {
  if (typeof v !== "number")
    throw new ScrollScriptError(`'${op}' needs a number, got "${v}"`, 0);
  return v;
}

function evalExpr(e: Expr, env: Env): Value {
  switch (e.kind) {
    case "num":
      return e.value;
    case "str":
      return e.value;
    case "var": {
      if (e.name in env) return env[e.name];
      throw new ScrollScriptError(`Unknown variable '${e.name}'`, 0);
    }
    case "bin": {
      const l = evalExpr(e.left, env);
      const r = evalExpr(e.right, env);
      if (e.op === "==") return l === r ? 1 : 0;
      if (e.op === "!=") return l !== r ? 1 : 0;
      const ln = asNumber(l, e.op);
      const rn = asNumber(r, e.op);
      switch (e.op) {
        case "+":
          return ln + rn;
        case "-":
          return ln - rn;
        case "*":
          return ln * rn;
        case "/":
          return rn === 0 ? 0 : ln / rn;
        case "^":
          return Math.pow(ln, rn);
        case "<":
          return ln < rn ? 1 : 0;
        case ">":
          return ln > rn ? 1 : 0;
        case "<=":
          return ln <= rn ? 1 : 0;
        case ">=":
          return ln >= rn ? 1 : 0;
        case "and":
          return ln !== 0 && rn !== 0 ? 1 : 0;
        case "or":
          return ln !== 0 || rn !== 0 ? 1 : 0;
      }
      return 0;
    }
    case "unary": {
      const v = evalExpr(e.operand, env);
      const n = asNumber(v, e.op);
      return e.op === "-" ? -n : n === 0 ? 1 : 0;
    }
    case "call": {
      const args = e.args.map((a) => asNumber(evalExpr(a, env), e.name));
      switch (e.name) {
        case "sin":
          return Math.sin(args[0] ?? 0);
        case "cos":
          return Math.cos(args[0] ?? 0);
        case "tan":
          return Math.tan(args[0] ?? 0);
        case "sqrt":
          return Math.sqrt(args[0] ?? 0);
        case "abs":
          return Math.abs(args[0] ?? 0);
        case "floor":
          return Math.floor(args[0] ?? 0);
        case "ceil":
          return Math.ceil(args[0] ?? 0);
        case "round":
          return Math.round(args[0] ?? 0);
        case "min":
          return Math.min(...args);
        case "max":
          return Math.max(...args);
      }
      throw new ScrollScriptError(`Unknown function '${e.name}'`, 0);
    }
  }
}

function isTruthy(v: Value): boolean {
  return typeof v === "number" ? v !== 0 : v.length > 0;
}

function evalNum(e: Expr, env: Env): number {
  return asNumber(evalExpr(e, env), "shape coordinate");
}

function runStatements(stmts: Statement[], env: Env, shapes: Shape[]) {
  for (const stmt of stmts) {
    runOne(stmt, env, shapes);
  }
}

function runOne(stmt: Statement, env: Env, shapes: Shape[]) {
  switch (stmt.kind) {
    case "assign":
      env[stmt.name] = evalExpr(stmt.expr, env);
      return;
    case "if": {
      for (const b of stmt.branches) {
        if (isTruthy(evalExpr(b.cond, env))) {
          runStatements(b.body, env, shapes);
          return;
        }
      }
      if (stmt.else) runStatements(stmt.else, env, shapes);
      return;
    }
    case "point":
      shapes.push({
        kind: "point",
        x: evalNum(stmt.x, env),
        y: evalNum(stmt.y, env),
        color: stmt.color ?? "slate",
        label: stmt.label,
      });
      return;
    case "line":
      shapes.push({
        kind: "line",
        x1: evalNum(stmt.x1, env),
        y1: evalNum(stmt.y1, env),
        x2: evalNum(stmt.x2, env),
        y2: evalNum(stmt.y2, env),
        color: stmt.color ?? "slate",
      });
      return;
    case "circle":
      shapes.push({
        kind: "circle",
        cx: evalNum(stmt.cx, env),
        cy: evalNum(stmt.cy, env),
        r: evalNum(stmt.r, env),
        color: stmt.color ?? "slate",
        label: stmt.label,
      });
      return;
    case "rect":
      shapes.push({
        kind: "rect",
        cx: evalNum(stmt.cx, env),
        cy: evalNum(stmt.cy, env),
        w: evalNum(stmt.w, env),
        h: evalNum(stmt.h, env),
        color: stmt.color ?? "slate",
        label: stmt.label,
      });
      return;
    case "text":
      shapes.push({
        kind: "text",
        x: evalNum(stmt.x, env),
        y: evalNum(stmt.y, env),
        text: stmt.text,
        color: stmt.color ?? "slate",
      });
      return;
    case "button":
      shapes.push({
        kind: "button",
        cx: evalNum(stmt.cx, env),
        cy: evalNum(stmt.cy, env),
        w: evalNum(stmt.w, env),
        h: evalNum(stmt.h, env),
        label: stmt.label,
        id: stmt.id,
        color: stmt.color ?? "indigo",
      });
      return;
  }
}

export type RunResult = {
  shapes: Shape[];
  check?: boolean;
  env: Env;
};

export function runProgram(program: Program, initialEnv: Env): RunResult {
  const env: Env = { clicked: "", ...initialEnv };
  const shapes: Shape[] = [];
  runStatements(program.statements, env, shapes);

  let check: boolean | undefined;
  if (program.check) {
    check = isTruthy(evalExpr(program.check, env));
  }
  return { shapes, check, env };
}

export function evalStandaloneExpression(source: string, env: Env): Value {
  const toks = tokenize(source);
  const p = new Parser(toks);
  const expr = p.parseExpr();
  const t = p.peek();
  if (t.kind !== "EOF" && t.kind !== "NL") {
    throw new ScrollScriptError(
      `Unexpected ${describe(t)} after expression`,
      t.line,
    );
  }
  return evalExpr(expr, env);
}

export const SAMPLE_SCROLLSCRIPT = `# Move the slider so point P lands in the first quadrant.
view -8 8 -8 8
slider angle 0 360 200 "Angle (degrees)"

rad = angle * pi / 180
x = cos(rad) * 5
y = sin(rad) * 5

circle cords(0, 0) dims(5) color(slate)
line from(0, 0) to(x, y) color(emerald)
point cords(x, y) color(emerald) label("P")

check x > 0 and y > 0
hint "The first quadrant is the top-right region."
`;

export const SAMPLE_BUTTONS = `# Click the correct answer.
view -6 6 -4 4

text cords(0, 3) value("What is 2 + 2?") color(slate)

rect cords(-3, 0) dims(2.5, 1.5) color(slate) type(button) label("3") id("three")
rect cords(0, 0) dims(2.5, 1.5) color(emerald) type(button) label("4") id("four")
rect cords(3, 0) dims(2.5, 1.5) color(slate) type(button) label("5") id("five")

check clicked == "four"
hint "Count it on your fingers."
`;

export const SAMPLE_IF = `# Classify the angle in real time.
view -8 8 -8 8
slider angle 0 180 60 "Angle (degrees)"

rad = angle * pi / 180
x = cos(rad) * 5
y = sin(rad) * 5

circle cords(0, 0) dims(5) color(slate)
line from(0, 0) to(x, y) color(emerald)
point cords(x, y) color(emerald) label("P")

if angle < 90
  text cords(0, -7) value("Acute") color(sky)
elif angle == 90
  text cords(0, -7) value("Right angle!") color(emerald)
else
  text cords(0, -7) value("Obtuse") color(rose)
end

check angle >= 30 and angle <= 60
hint "Aim for somewhere between 30 and 60."
`;
