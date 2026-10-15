import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Card({ className, ...props }: ComponentProps<"section">) {
  return (
    <section
      data-slot="card"
      className={cn(
        "rounded-card border border-border bg-surface p-5 shadow-card md:p-6",
        className,
      )}
      {...props}
    />
  );
}

export { Card };
