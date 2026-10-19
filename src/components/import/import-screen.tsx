"use client";

import { CheckCircle2, FileUp, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getRepositories } from "@/data/repositories";
import type { TransactionType } from "@/domain/models";
import { parseTradeRepublicCsv } from "@/importers/trade-republic";
import { UnrecognizedFormatError } from "@/importers/types";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { cn } from "@/lib/utils";
import { commitImport, prepareImport, type ImportPreview } from "@/services/import";

type Step =
  | { name: "upload"; error?: { message: string; columns: string[] } }
  | { name: "reading" }
  | { name: "preview"; preview: ImportPreview; fileName: string }
  | { name: "importing"; preview: ImportPreview; fileName: string }
  | { name: "done"; imported: number };

const TYPE_ORDER: TransactionType[] = ["buy", "sell", "dividend", "interest", "fee"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ImportScreen() {
  const [step, setStep] = useState<Step>({ name: "upload" });

  async function readFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setStep({ name: "upload", error: { message: "El archivo supera los 10 MB.", columns: [] } });
      return;
    }
    setStep({ name: "reading" });
    try {
      const parsed = await parseTradeRepublicCsv(await file.text());
      const preview = await prepareImport(getRepositories(), parsed);
      setStep({ name: "preview", preview, fileName: file.name });
    } catch (error) {
      setStep({
        name: "upload",
        error: {
          message: error instanceof Error ? error.message : "No se pudo leer el archivo.",
          columns: error instanceof UnrecognizedFormatError ? error.columns : [],
        },
      });
    }
  }

  async function confirm(preview: ImportPreview, fileName: string) {
    setStep({ name: "importing", preview, fileName });
    try {
      const { imported } = await commitImport(getRepositories(), preview);
      setStep({ name: "done", imported });
    } catch (error) {
      setStep({
        name: "upload",
        error: { message: error instanceof Error ? error.message : "No se pudo importar.", columns: [] },
      });
    }
  }

  return (
    <>
      <PageHeader
        title="Importar CSV"
        description="Exportación de transacciones de Trade Republic."
        back={{ href: "/operaciones", label: "Operaciones" }}
      />
      {(step.name === "upload" || step.name === "reading") && (
        <UploadStep busy={step.name === "reading"} error={step.name === "upload" ? step.error : undefined} onFile={readFile} />
      )}
      {(step.name === "preview" || step.name === "importing") && (
        <PreviewStep
          preview={step.preview}
          fileName={step.fileName}
          busy={step.name === "importing"}
          onCancel={() => setStep({ name: "upload" })}
          onConfirm={() => confirm(step.preview, step.fileName)}
        />
      )}
      {step.name === "done" && (
        <Card className="flex flex-col items-center px-6 py-12 text-center">
          <CheckCircle2 className="mb-4 size-10 text-accent" aria-hidden />
          <h2 className="text-lg font-semibold">
            {step.imported === 0 ? "No había operaciones nuevas" : `${step.imported} operaciones importadas`}
          </h2>
          <p className="mt-2 text-sm text-text-muted">Los datos se han guardado solo en este dispositivo.</p>
          <Link href="/operaciones" className={cn(buttonVariants({ size: "lg" }), "mt-6")}>
            Ver operaciones
          </Link>
        </Card>
      )}
    </>
  );
}

function UploadStep({
  busy,
  error,
  onFile,
}: {
  busy: boolean;
  error?: { message: string; columns: string[] };
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <Card
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex flex-col items-center border-dashed px-6 py-12 text-center transition-colors",
          dragging && "border-accent bg-accent/5",
        )}
      >
        <div className="mb-5 flex size-16 items-center justify-center rounded-full bg-accent/15 text-accent">
          {busy ? <Loader2 className="size-6 animate-spin" aria-hidden /> : <FileUp className="size-6" aria-hidden />}
        </div>
        <h2 className="text-lg font-semibold">{busy ? "Leyendo el archivo…" : "Sube tu CSV"}</h2>
        <p className="mt-2 max-w-sm text-sm text-pretty text-text-muted">
          En la app de Trade Republic: Perfil → Extractos → Exportación de transacciones, desde la apertura de la
          cuenta. Súbelo tal cual (sin abrirlo en Excel). Se lee en tu dispositivo y no se envía a ningún servidor.
        </p>
        <input
          ref={input}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          aria-label="Archivo CSV"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFile(file);
            e.target.value = "";
          }}
        />
        <Button size="lg" className="mt-6" disabled={busy} onClick={() => input.current?.click()}>
          Elegir archivo
        </Button>
      </Card>

      {error && (
        <Card role="alert" className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-pretty">{error.message}</p>
            {error.columns.length > 0 && (
              <>
                <p className="mt-2 text-xs text-text-muted">Columnas encontradas:</p>
                <p className="mt-1 font-mono text-xs break-words text-text-muted">{error.columns.join(" · ")}</p>
              </>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function PreviewStep({
  preview,
  fileName,
  busy,
  onCancel,
  onConfirm,
}: {
  preview: ImportPreview;
  fileName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const types = TYPE_ORDER.filter((t) => preview.totals[t]);
  const importedBefore = preview.rows.filter((r) => r.duplicateOf === "import").length;
  const manualDuplicates = preview.rows.filter((r) => r.duplicateOf === "manual").length;
  // Filas omitidas agrupadas por motivo, con sus números de línea.
  const skippedReasons = [
    ...preview.parsed.skipped.reduce((groups, s) => groups.set(s.reason, [...(groups.get(s.reason) ?? []), s.line]), new Map<string, number[]>()),
  ];
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <Card>
        <p className="truncate text-sm text-text-muted">{fileName}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums">
          {preview.newCount} {preview.newCount === 1 ? "operación nueva" : "operaciones nuevas"}
        </p>
        {(importedBefore > 0 || manualDuplicates > 0 || skippedReasons.length > 0 || preview.cancels.length > 0) && (
          <ul className="mt-3 grid gap-1 text-sm text-text-muted">
            {importedBefore > 0 && <li>{plural(importedBefore, "ya estaba importada", "ya estaban importadas")} y se omite{importedBefore === 1 ? "" : "n"}.</li>}
            {manualDuplicates > 0 && (
              <li>{plural(manualDuplicates, "coincide con una operación que registraste a mano", "coinciden con operaciones que registraste a mano")} y se omite{manualDuplicates === 1 ? "" : "n"}.</li>
            )}
            {preview.parsed.skipped.length > 0 && (
              <li>{plural(preview.parsed.skipped.length, "fila no se importa", "filas no se importan")}: el motivo de cada una está abajo.</li>
            )}
            {preview.cancels.length > 0 && (
              <li className="text-text">
                {plural(preview.cancels.length, "dividendo ya importado se anula", "dividendos ya importados se anulan")} por una corrección del
                archivo.
              </li>
            )}
          </ul>
        )}

        {types.length > 0 && (
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {types.map((type) => (
              <div key={type} className="rounded-2xl bg-surface-2 p-3.5">
                <dt className="text-xs text-text-muted">
                  {TRANSACTION_TYPE_LABELS[type]} · {preview.totals[type]!.count}
                </dt>
                <dd className="mt-1 font-medium tabular-nums">{formatCurrency(preview.totals[type]!.amount)}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      {preview.parsed.skipped.length > 0 && (
        <details className="group rounded-card border border-border bg-surface">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-card px-5 py-4 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-accent/40 [&::-webkit-details-marker]:hidden">
            Filas que no se importan · {preview.parsed.skipped.length}
            <span className="text-xs font-normal text-text-muted group-open:hidden">Ver por qué</span>
          </summary>
          <ul className="max-h-80 overflow-y-auto px-5 pb-4 text-sm">
            {skippedReasons.map(([reason, lines]) => (
              <li key={reason} className="border-t border-border py-2.5 first:border-t-0">
                <span className="block text-pretty">{reason}</span>
                <span className="mt-0.5 block text-xs text-text-muted tabular-nums">
                  {lines.length === 1 ? "Línea" : "Líneas"} {lines.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {preview.problem && (
        <Card role="alert" className="flex gap-3">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-accent" aria-hidden />
          <p className="text-sm text-pretty">{preview.problem}</p>
        </Card>
      )}

      <Card className="p-1.5 md:p-2">
        <ul className="max-h-[26rem] overflow-y-auto">
          {preview.rows.map(({ transaction: t, duplicate, duplicateOf }) => (
            <li key={`${t.line}-${t.importHash}`} className={cn("flex items-center gap-3 rounded-2xl px-2.5 py-2.5", duplicate && "opacity-50")}>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{t.asset?.name ?? TRANSACTION_TYPE_LABELS[t.type]}</span>
                <span className="block truncate text-xs text-text-muted tabular-nums">
                  {TRANSACTION_TYPE_LABELS[t.type]} · {formatDate(t.date)} · {formatQuantity(t.quantity)} uds
                </span>
              </span>
              {duplicate && (
                <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[11px] text-text-muted">
                  {duplicateOf === "manual" ? "Ya la tienes" : "Ya importada"}
                </span>
              )}
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" size="lg" onClick={onCancel} disabled={busy}>
          Cancelar
        </Button>
        <Button size="lg" onClick={onConfirm} disabled={busy || Boolean(preview.problem) || preview.newCount === 0}>
          {busy && <Loader2 className="animate-spin" aria-hidden />}
          {preview.newCount === 0 ? "Nada que importar" : `Importar ${preview.newCount}`}
        </Button>
      </div>
    </div>
  );
}
