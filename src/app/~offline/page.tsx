import { CloudOff } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/empty-state";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <EmptyState
      icon={CloudOff}
      title="Sin conexión"
      description="Esta pantalla aún no estaba guardada en el dispositivo. Vuelve a intentarlo cuando tengas conexión."
    />
  );
}
