import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dbGet, type LessonRow } from "@/lib/db";
import { parseLessonContent } from "@/lib/lesson-content";
import LessonPlayer from "./player";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const lessonId = Number(id);
  if (!Number.isInteger(lessonId) || lessonId <= 0) notFound();

  const lesson = await dbGet<LessonRow>(
    "SELECT id, title, description, content, grade, subject, created_by, created_at FROM lessons WHERE id = ?",
    [lessonId],
  );

  if (!lesson) notFound();

  const { blocks } = parseLessonContent(lesson.content);

  return (
    <LessonPlayer
      lessonId={lesson.id}
      title={lesson.title}
      description={lesson.description}
      subject={lesson.subject}
      grade={lesson.grade}
      blocks={blocks}
    />
  );
}
