import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { dbGet, type BlogRow } from "@/lib/db";
import { getTheme } from "@/lib/theme";
import BlogEditor from "./editor";

export default async function BlogEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "admin") redirect("/dashboard");

  const { id } = await params;
  const blogId = Number(id);
  if (!Number.isInteger(blogId) || blogId <= 0) notFound();

  const blog = await dbGet<BlogRow>(
    "SELECT id, author_id, title, body, published, created_at, updated_at FROM blogs WHERE id = $1",
    [blogId],
  );

  if (!blog) notFound();

  const theme = await getTheme();

  return (
    <BlogEditor
      blogId={blog.id}
      initialTitle={blog.title}
      initialBody={blog.body}
      initialPublished={blog.published}
      theme={theme}
    />
  );
}
