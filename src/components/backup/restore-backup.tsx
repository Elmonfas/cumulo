"use client";

import { Upload } from "lucide-react";
import { useRef, useState } from "react";
import { rememberAvatar } from "@/components/layout/settings-link";
import { Button } from "@/components/ui/button";
import { getRepositories } from "@/data/repositories";
import { formatDate } from "@/lib/format";
import { readBackup, restoreBackup, type BackupSummary } from "@/services/backup";
import { cn } from "@/lib/utils";

type State = { status: "idle" } | { status: "confirm"; summary: BackupSummary } | { status: "done"; message: string };

/** Botón «Restaurar copia» con su confirmación. Se usa en Ajustes y en la bienvenida. */
export function RestoreBackup({
  label = "Restaurar copia",
  variant = "outline",
  size,
  replacesData = true,
  className,
}: {
  label?: string;
  variant?: "outline" | "ghost" | "secondary";
  size?: "lg";
  /** Si ya hay datos, se avisa de que se sustituyen. */
  replacesData?: boolean;
  className?: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<State>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File) {
    setError(null);
    try {
      setState({ status: "confirm", summary: readBackup(await file.text()) });
    } catch (e) {
      setState({ status: "idle" });
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  async function onRestore(summary: BackupSummary) {
    setBusy(true);
    try {
      await restoreBackup(getRepositories(), summary.data);
      rememberAvatar(Boolean(summary.data.settings.avatar));
      setState({ status: "done", message: `Copia restaurada: ${summary.transactions} operaciones y ${summary.assets} activos.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo restaurar.");
      setState({ status: "idle" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant={variant} size={size} onClick={() => fileInput.current?.click()} className={className}>
        <Upload aria-hidden />
        {label}
      </Button>
      <input
        ref={fileInput}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label="Archivo de copia de seguridad"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      {state.status === "confirm" && (
        <div
          role="alertdialog"
          aria-label="Confirmar restauración"
          className="grid basis-full gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4 text-left"
        >
          <p className="text-sm text-pretty">
            Copia del {formatDate(state.summary.exportedAt.slice(0, 10))} con {state.summary.transactions} operaciones y{" "}
            {state.summary.assets} activos.
            {replacesData && <strong className="font-medium"> Sustituirá todos los datos actuales.</strong>}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setState({ status: "idle" })} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => onRestore(state.summary)} disabled={busy}>
              Restaurar
            </Button>
          </div>
        </div>
      )}
      {(state.status === "done" || error) && (
        <p role={error ? "alert" : "status"} className={cn("basis-full text-sm text-pretty text-accent")}>
          {error ?? (state.status === "done" ? state.message : "")}
        </p>
      )}
    </>
  );
}
