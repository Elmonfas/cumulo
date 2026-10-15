"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Monta `children` solo cuando el hueco se acerca a la vista. Sirve para no
 * descargar ni pintar gráficas que están por debajo del pliegue.
 */
export function LazyVisible({ children, placeholder, rootMargin = "0px" }: { children: ReactNode; placeholder: ReactNode; rootMargin?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!("IntersectionObserver" in window)) {
      const frame = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{visible ? children : placeholder}</div>;
}
