import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dbAll, dbGet, type CategoryRow, type LessonRow } from "@/lib/db";
import { parseLessonContent } from "@/lib/lesson-content";
import LessonEditor from "./editor";

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) notFound();

  const lesson = await dbGet<LessonRow>(
    "SELECT id, title, description, content, grade, subject, category_id, created_by, created_at FROM lessons WHERE id = $1",
    [lessonId],
  );

  if (!lesson) notFound();

  const categories = await dbAll<CategoryRow>(
    "SELECT id, subject, grade, name, position, created_at FROM categories ORDER BY subject, grade, position",
  );

  const content = parseLessonContent(lesson.content);

  return (
    <LessonEditor
      lessonId={lesson.id}
      initialTitle={lesson.title}
      initialDescription={lesson.description}
      initialSubject={
        lesson.subject === "math" ||
        lesson.subject === "language" ||
        lesson.subject === "science" ||
        lesson.subject === "calculus"
          ? lesson.subject
          : "math"
      }
      initialGrade={lesson.grade}
      initialCategoryId={lesson.category_id ?? null}
      initialBlocks={content.blocks}
      categories={categories.map((c) => ({
        id: c.id,
        subject: c.subject,
        grade: c.grade,
        name: c.name,
      }))}
    />
  );
}
