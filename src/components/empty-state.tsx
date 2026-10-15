import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  footnote?: string;
}

export function EmptyState({ icon: Icon, title, description, actions, footnote }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center px-6 py-12 text-center md:py-16">
      <div className="relative mb-5 flex size-16 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-accent/15" />
        <div className="absolute inset-2 rounded-full bg-accent/15" />
        <Icon className="relative size-6 text-accent" aria-hidden />
      </div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-2 max-w-sm text-sm text-pretty text-text-muted">{description}</p>
      {actions && (
        <div className="mt-6 flex w-full flex-col justify-center gap-2 sm:w-auto sm:flex-row">{actions}</div>
      )}
      {footnote && <p className="mt-3 text-xs text-text-muted">{footnote}</p>}
    </Card>
  );
}
