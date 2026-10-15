import { ViewTransition, type ReactNode } from "react";

/**
 * Se monta de nuevo en cada navegación (a diferencia del layout), así que la
 * página entrante y la saliente pueden animarse con View Transitions.
 */
export default function Template({ children }: { children: ReactNode }) {
  return (
    <ViewTransition enter="page-in" exit="page-out" default="none">
      <div>{children}</div>
    </ViewTransition>
  );
}
