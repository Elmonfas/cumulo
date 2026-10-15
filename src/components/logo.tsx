import { cn } from "@/lib/utils";

/** Diez burbujas que dibujan la "c" de cúmulo (docs/brand, dirección 2a), en un lienzo de 64×64. */
const CIRCLES: [number, number, number][] = [
  [42.07, 47.27, 4.5],
  [35.41, 50.93, 4.97],
  [27.58, 50.9, 5.49],
  [20.55, 46.98, 6.06],
  [16.18, 39.96, 6.69],
  [15.75, 31.48, 7.39],
  [19.58, 23.65, 8.17],
  [26.9, 18.53, 9.02],
  [36.01, 17.57, 9.96],
  [44.64, 21.22, 11.0],
];

/** Símbolo de marca en el color de acento (morado en claro, lila en oscuro). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={cn("size-8 fill-accent", className)}>
      {CIRCLES.map(([cx, cy, r]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />
      ))}
    </svg>
  );
}

/** Símbolo + "cúmulo" en Geist 500, como el lockup horizontal. */
export function LogoLockup({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <LogoMark className="size-7" />
      <span className="text-lg font-medium tracking-[-0.02em] text-text">cúmulo</span>
    </span>
  );
}
