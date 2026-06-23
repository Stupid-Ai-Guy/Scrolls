export const SUBJECT_IDS = ["math", "language", "science"] as const;
export type SubjectId = (typeof SUBJECT_IDS)[number];

export const SUBJECT_LABEL: Record<SubjectId, string> = {
  math: "Math",
  language: "Language",
  science: "Science",
};

const SUBJECT_PILL_MAP: Record<SubjectId, string> = {
  math: "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30",
  language: "bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30",
  science: "bg-sky-500/10 text-sky-300 ring-1 ring-sky-500/30",
};

const DEFAULT_PILL =
  "bg-zinc-900 text-zinc-300 ring-1 ring-zinc-800";

export function subjectPill(s: string): string {
  return isSubjectId(s) ? SUBJECT_PILL_MAP[s] : DEFAULT_PILL;
}

export const GRADES = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
] as const;
export const MAX_GRADE = 13;
export const CALCULUS_GRADE = 13;

// Calculus is technically a math-only level. Callers that show
// per-subject grade pickers should filter using this helper.
export function gradeIsValidFor(g: number, subject: SubjectId): boolean {
  if (g === CALCULUS_GRADE) return subject === "math";
  return g >= 0 && g <= 12;
}

export function isSubjectId(s: string): s is SubjectId {
  return (SUBJECT_IDS as readonly string[]).includes(s);
}

export function normalizeSubject(raw: string | undefined): SubjectId {
  return raw && isSubjectId(raw) ? raw : "math";
}

export function parseGrade(raw: string | undefined): number {
  if (!raw) return 1;
  const upper = raw.toUpperCase();
  if (upper === "K") return 0;
  if (upper === "CALC" || upper === "CALCULUS") return CALCULUS_GRADE;
  const n = parseInt(raw, 10);
  return Number.isInteger(n) && n >= 0 && n <= MAX_GRADE ? n : 1;
}

export function gradeShortLabel(g: number): string {
  if (g === 0) return "K";
  if (g === CALCULUS_GRADE) return "Calc";
  return `Grade ${g}`;
}

export function gradeLongLabel(g: number): string {
  if (g === 0) return "Kindergarten";
  if (g === CALCULUS_GRADE) return "Calculus";
  return `Grade ${g}`;
}

export function gradeParam(g: number): string {
  if (g === 0) return "K";
  if (g === CALCULUS_GRADE) return "calc";
  return String(g);
}
