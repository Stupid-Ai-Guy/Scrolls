import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// KaTeX styles must load before any client component that calls
// renderToString — without them the MathML accessibility node renders
// alongside the HTML output (visible "duplication") and symbol fonts /
// fraction layout / etc. are missing.
import "katex/dist/katex.min.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "Scrolls",
  description: "Learn math, language, and science — intuitively.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-black text-zinc-100 antialiased font-sans">
        {children}
      </body>
    </html>
  );
}
