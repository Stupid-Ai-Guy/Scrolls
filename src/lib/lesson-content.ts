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

export type Block = TextBlock | ImageBlock | QuestionBlock | InteractiveBlock;
export type BlockType = Block["type"];
export type LessonContent = { blocks: Block[] };

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
  if (obj.type === "interactive") {
    return typeof obj.code === "string";
  }
  return false;
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
      return { blocks };
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
    else if (b.type === "question") question++;
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
