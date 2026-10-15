"use client";

import { Download, Loader2, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import type { ShareOptions } from "@/lib/share-builders";
import { cardToFile, downloadFile, renderShareCard, shareOrDownload, type CardFormat, type CardModel } from "@/lib/share-card";
import { cn } from "@/lib/utils";

interface ShareSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Nombre base del archivo, sin extensión. */
  fileName: string;
  build: (options: ShareOptions) => Promise<CardModel>;
}

type Preview = { status: "loading" } | { status: "ready"; url: string; file: File } | { status: "error" };

/**
 * Vista previa y opciones de una tarjeta para compartir. La imagen se genera
 * en el dispositivo; por defecto solo lleva porcentajes.
 */
export function ShareSheet({ open, onOpenChange, title, fileName, build }: ShareSheetProps) {
  const [format, setFormat] = useState<CardFormat>("story");
  const [showAmounts, setShowAmounts] = useState(false);
  const [preview, setPreview] = useState<Preview>({ status: "loading" });
  const [message, setMessage] = useState<string | null>(null);
  // `build` suele ser una función nueva en cada render: se guarda aparte para no regenerar sin parar.
  const buildRef = useRef(build);
  useEffect(() => {
    buildRef.current = build;
  }, [build]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let url: string | null = null;
    (async () => {
      try {
        const model = await buildRef.current({ showAmounts });
        const canvas = await renderShareCard(model, format);
        const file = await cardToFile(canvas, `${fileName}-${format === "story" ? "historia" : "cuadrada"}.png`);
        if (cancelled) return;
        url = URL.createObjectURL(file);
        setPreview({ status: "ready", url, file });
      } catch {
        if (!cancelled) setPreview({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [open, showAmounts, format, fileName]);

  const regenerate = (update: () => void) => {
    setPreview({ status: "loading" });
    setMessage(null);
    update();
  };

  async function onShare() {
    if (preview.status !== "ready") return;
    const result = await shareOrDownload(preview.file, title);
    setMessage(result === "downloaded" ? "Imagen descargada." : result === "shared" ? "¡Compartida!" : null);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={title} description="Se genera en tu dispositivo; nada pasa por ningún servidor.">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 pt-1">
        <div className={cn("relative mx-auto w-full overflow-hidden rounded-3xl border border-border bg-bg", format === "story" ? "max-w-[15rem] aspect-[9/16]" : "max-w-[18rem] aspect-square")}>
          {preview.status === "ready" ? (
            // eslint-disable-next-line @next/next/no-img-element -- imagen generada en el dispositivo (blob:)
            <img src={preview.url} alt="Vista previa de la tarjeta" className="size-full object-contain" />
          ) : preview.status === "error" ? (
            <p className="flex size-full items-center justify-center p-4 text-center text-sm text-text-muted">No se pudo generar la tarjeta.</p>
          ) : (
            <span className="flex size-full items-center justify-center">
              <Loader2 className="size-6 animate-spin text-accent" aria-hidden />
            </span>
          )}
        </div>

        <div role="radiogroup" aria-label="Formato" className="grid grid-cols-2 gap-1 rounded-full bg-surface-2 p-1">
          {(["story", "square"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={format === f}
              onClick={() => format !== f && regenerate(() => setFormat(f))}
              className={cn(
                "h-9 rounded-full text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
                format === f ? "bg-accent text-accent-foreground" : "text-text-muted hover:text-text",
              )}
            >
              {f === "story" ? "Historia 9:16" : "Cuadrada 1:1"}
            </button>
          ))}
        </div>

        <Switch
          label="Mostrar importes"
          description="Añade euros y cantidades. Por defecto solo se ven porcentajes."
          checked={showAmounts}
          onCheckedChange={(v) => regenerate(() => setShowAmounts(v))}
        />

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="lg" className="sm:flex-1" onClick={onShare} disabled={preview.status !== "ready"}>
            <Share2 aria-hidden />
            Compartir
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="sm:flex-1"
            onClick={() => preview.status === "ready" && downloadFile(preview.file)}
            disabled={preview.status !== "ready"}
          >
            <Download aria-hidden />
            Descargar
          </Button>
        </div>
        {message && (
          <p role="status" className="text-center text-sm text-accent">
            {message}
          </p>
        )}
      </div>
    </Sheet>
  );
}

/** Botón "Compartir" que abre la hoja con la tarjeta indicada. */
export function ShareButton({
  title,
  fileName,
  build,
  label = "Compartir",
  variant = "outline",
  className,
}: Omit<ShareSheetProps, "open" | "onOpenChange"> & { label?: string; variant?: "outline" | "secondary" | "ghost"; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant={variant} size="sm" onClick={() => setOpen(true)} className={className}>
        <Share2 aria-hidden />
        {label}
      </Button>
      {open && <ShareSheet open={open} onOpenChange={setOpen} title={title} fileName={fileName} build={build} />}
    </>
  );
}
