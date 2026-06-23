export const SUBJECT_IDS = [
  "math",
  "language",
  "science",
  "calculus",
] as const;
export type SubjectId = (typeof SUBJECT_IDS)[number];

export const SUBJECT_LABEL: Record<SubjectId, string> = {
  math: "Math",
  language: "Language",
  science: "Science",
  calculus: "Calculus",
};

const SUBJECT_PILL_MAP: Record<SubjectId, string> = {
  math: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
  language: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30",
  science: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30",
  calculus: "bg-violet-500/10 text-violet-300 ring-1 ring-violet-500/30",
};

const DEFAULT_PILL =
  "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800";

export function subjectPill(s: string): string {
  return isSubjectId(s) ? SUBJECT_PILL_MAP[s] : DEFAULT_PILL;
}

export const GRADES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const MAX_GRADE = 12;

export function isSubjectId(s: string): s is SubjectId {
  return (SUBJECT_IDS as readonly string[]).includes(s);
}

export function normalizeSubject(raw: string | undefined): SubjectId {
  return raw && isSubjectId(raw) ? raw : "math";
}

export function parseGrade(raw: string | undefined): number {
  if (!raw) return 1;
  if (raw.toUpperCase() === "K") return 0;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 && n <= MAX_GRADE ? n : 1;
}

export function gradeShortLabel(g: number): string {
  return g === 0 ? "K" : `Grade ${g}`;
}

export function gradeLongLabel(g: number): string {
  return g === 0 ? "Kindergarten" : `Grade ${g}`;
}

export function gradeParam(g: number): string {
  return g === 0 ? "K" : String(g);
}
