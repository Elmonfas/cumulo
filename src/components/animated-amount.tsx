"use client";

import Decimal from "decimal.js";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { formatCurrency } from "@/lib/format";

interface AnimatedAmountProps {
  value: Decimal;
  format?: (value: Decimal) => string;
  className?: string;
}

const FIRST_DURATION = 900;
const UPDATE_DURATION = 200;
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Cifra que cuenta hasta su valor al montarse y se desliza en cada cambio.
 * La interpolación se hace en Decimal y el último fotograma es el valor exacto.
 */
export function AnimatedAmount({ value, format = formatCurrency, className }: AnimatedAmountProps) {
  const reducedMotion = useReducedMotion();
  const [display, setDisplay] = useState(() => new Decimal(0));
  const displayRef = useRef(display);
  const firstRun = useRef(true);

  useEffect(() => {
    const from = displayRef.current;
    const duration = firstRun.current ? FIRST_DURATION : UPDATE_DURATION;
    firstRun.current = false;

    if (reducedMotion || from.eq(value)) {
      displayRef.current = value;
      const frame = requestAnimationFrame(() => setDisplay(value));
      return () => cancelAnimationFrame(frame);
    }

    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const next = t === 1 ? value : from.plus(value.minus(from).times(easeOut(t)));
      displayRef.current = next;
      setDisplay(next);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, reducedMotion]);

  const finalText = format(value);
  return (
    <span className={className} style={{ "--hero-chars": finalText.length } as CSSProperties}>
      <span aria-hidden>{format(display)}</span>
      <span className="sr-only">{finalText}</span>
    </span>
  );
}
