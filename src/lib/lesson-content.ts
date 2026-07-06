export type TextBlock = {
  type: "text";
  title?: string;
  body: string;
};

export type ImageBlock = {
  type: "image";
  url: string;
  caption?: string;
};

export type QuestionBlock = {
  type: "question";
  prompt: string;
  options: string[];
  correctIndex: number;
  explanation?: string;
  imageUrl?: string;
};

// Free-response question. The author lists one or more accepted answers;
// the student types and must match one. `alwaysLatex` swaps the input for
// a rendered preview the student builds via keystrokes plus admin-defined
// `buttons` (each is a LaTeX snippet inserted at the cursor; empty `{}`,
// `()` or `[]` pairs in the snippet act as the slot the cursor lands in).
// `caseSensitive` defaults to false; when alwaysLatex is on it's forced
// true because LaTeX commands like \sin / \Sin differ.
export type WritingBlock = {
  type: "writing";
  prompt: string;
  acceptedAnswers: string[];
  caseSensitive?: boolean;
  alwaysLatex?: boolean;
  buttons?: { label: string; latex: string }[];
  explanation?: string;
  imageUrl?: string;
};

export type SceneShape =
  | {
      id: string;
      kind: "point";
      x: number;
      y: number;
      color: string;
      label?: string;
    }
  | {
      id: string;
      kind: "line";
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      color: string;
    }
  | {
      id: string;
      kind: "polyline";
      vertices: { x: number; y: number }[];
      color: string;
    }
  | {
      id: string;
      kind: "circle";
      cx: number;
      cy: number;
      r: number;
      color: string;
      label?: string;
      filled?: boolean;
    }
  | {
      id: string;
      kind: "rect";
      cx: number;
      cy: number;
      w: number;
      h: number;
      color: string;
      label?: string;
      filled?: boolean;
    }
  | {
      id: string;
      kind: "text";
      x: number;
      y: number;
      text: string;
      color: string;
      size?: number;
    }
  | {
      id: string;
      kind: "latex";
      x: number;
      y: number;
      code: string;
      color: string;
    }
  | {
      id: string;
      kind: "button";
      cx: number;
      cy: number;
      w: number;
      h: number;
      label: string;
      buttonId: string;
      color: string;
    }
  | {
      id: string;
      kind: "function";
      x: number;
      y: number;
      w?: number;
      h?: number;
      expr: string;
      color: string;
      xmin?: number;
      xmax?: number;
      ymin?: number;
      ymax?: number;
      samples?: number;
    }
  | {
      id: string;
      kind: "code";
      x: number;
      y: number;
      w?: number;
      h?: number;
      source: string;
      color: string;
      error?: string;
      // Id of the Output shape this JS block owns. Set on the first Run.
      // Future Runs draw into that specific canvas — never any other
      // Output shape floating around the scene.
      linkedOutputId?: string;
    }
  | {
      // Canvas surface a code shape draws into. Kept separate so authors can
      // move / resize the code editor and the output area independently.
      id: string;
      kind: "output";
      x: number;
      y: number;
      w?: number;
      h?: number;
      color: string;
    };

export type Scene = {
  view: { xmin: number; xmax: number; ymin: number; ymax: number };
  shapes: SceneShape[];
  correctButtonId?: string;
  hint?: string;
};

export type InteractiveBlock = {
  type: "interactive";
  prompt?: string;
  code: string;
  scene?: Scene;
  imageUrl?: string;
};

export type Block =
  | TextBlock
  | ImageBlock
  | QuestionBlock
  | WritingBlock
  | InteractiveBlock;
export type BlockType = Block["type"];

// Spaced-repetition review sets. Authors define two extra question sets per
// lesson; students see day1 a day after first completion and day3 two days
// after that. Each set holds multiple-choice (QuestionBlock) or free-response
// (WritingBlock) questions, mixed in any order.
export type ReviewBlock = QuestionBlock | WritingBlock;
export type RepetitionSets = {
  day1: ReviewBlock[];
  day3: ReviewBlock[];
};
export const EMPTY_REPETITION_SETS: RepetitionSets = { day1: [], day3: [] };

export type LessonContent = {
  blocks: Block[];
  repetitionSets?: RepetitionSets;
};

function isValidBlock(b: unknown): b is Block {
  if (!b || typeof b !== "object") return false;
  const obj = b as Record<string, unknown>;
  if (obj.type === "text") return typeof obj.body === "string";
  if (obj.type === "image") return typeof obj.url === "string";
  if (obj.type === "question") {
    return (
      typeof obj.prompt === "string" &&
      Array.isArray(obj.options) &&
      obj.options.every((o) => typeof o === "string") &&
      typeof obj.correctIndex === "number"
    );
  }
  if (obj.type === "writing") {
    if (typeof obj.prompt !== "string") return false;
    if (!Array.isArray(obj.acceptedAnswers)) return false;
    if (!obj.acceptedAnswers.every((a) => typeof a === "string")) return false;
    if (obj.buttons !== undefined) {
      if (!Array.isArray(obj.buttons)) return false;
      for (const b of obj.buttons) {
        if (!b || typeof b !== "object") return false;
        const bb = b as Record<string, unknown>;
        if (typeof bb.label !== "string" || typeof bb.latex !== "string")
          return false;
      }
    }
    return true;
  }
  if (obj.type === "interactive") {
    return typeof obj.code === "string";
  }
  return false;
}

function pickReviewBlocks(raw: unknown): ReviewBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (b): b is ReviewBlock =>
      isValidBlock(b) &&
      ((b as Block).type === "question" || (b as Block).type === "writing"),
  ) as ReviewBlock[];
}

export function parseLessonContent(raw: string): LessonContent {
  if (!raw || !raw.trim()) return { blocks: [] };
  try {
    const obj: unknown = JSON.parse(raw);
    if (
      obj &&
      typeof obj === "object" &&
      Array.isArray((obj as { blocks?: unknown }).blocks)
    ) {
      const candidates = (obj as { blocks: unknown[] }).blocks;
      const blocks = candidates.filter(isValidBlock) as Block[];
      const repObj = (obj as { repetitionSets?: unknown }).repetitionSets;
      let repetitionSets: RepetitionSets | undefined;
      if (repObj && typeof repObj === "object") {
        const r = repObj as { day1?: unknown; day3?: unknown };
        const day1 = pickReviewBlocks(r.day1);
        const day3 = pickReviewBlocks(r.day3);
        if (day1.length > 0 || day3.length > 0) {
          repetitionSets = { day1, day3 };
        }
      }
      return repetitionSets ? { blocks, repetitionSets } : { blocks };
    }
  } catch {
    // not JSON — legacy plain-text content
  }
  return { blocks: [{ type: "text", body: raw }] };
}

export function emptyBlock(type: BlockType): Block {
  if (type === "text") return { type: "text", body: "" };
  if (type === "image") return { type: "image", url: "" };
  if (type === "interactive")
    return {
      type: "interactive",
      prompt: "",
      code: "",
    };
  if (type === "writing")
    return {
      type: "writing",
      prompt: "",
      acceptedAnswers: [""],
    };
  return { type: "question", prompt: "", options: ["", ""], correctIndex: 0 };
}

export function countBlocks(content: LessonContent) {
  let text = 0;
  let image = 0;
  let question = 0;
  let interactive = 0;
  for (const b of content.blocks) {
    if (b.type === "text") text++;
    else if (b.type === "image") image++;
    else if (b.type === "question" || b.type === "writing") question++;
    else if (b.type === "interactive") interactive++;
  }
  return {
    text,
    image,
    question,
    interactive,
    total: content.blocks.length,
  };
}
