"use client";

import { useEffect, useState } from "react";

// Tiny tick-up animation for headline numbers on the dashboard (streak,
// mastered count, reviews). Runs once on mount, 700ms with an ease-out
// curve so a 15-streak feels alive on load without being distracting.
export default function CountUp({
  value,
  duration = 700,
}: {
  value: number;
  duration?: number;
}) {
  const [n, setN] = useState(value === 0 ? 0 : 0);

  useEffect(() => {
    if (value === 0) {
      setN(0);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(eased * value));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return <>{n}</>;
}
