"use client";

// Renders the small "×" delete button inside the blog-list form. Split
// out so we can hang a client-side confirm() on it without turning the
// whole list page into a client component.
export default function DeleteBlogButton({ title }: { title: string }) {
  return (
    <button
      type="submit"
      onClick={(e) => {
        if (!confirm(`Delete "${title}"? This can't be undone.`)) {
          e.preventDefault();
        }
      }}
      aria-label="Delete blog post"
      title="Delete"
      className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-rose-400 opacity-0 transition hover:bg-rose-500/10 group-hover:opacity-100"
    >
      ×
    </button>
  );
}
