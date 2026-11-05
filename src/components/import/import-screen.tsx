"use client";

import { CheckCircle2, Download, FileUp, Loader2, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type DragEvent } from "react";
import { AssetAvatar } from "@/components/asset-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { transactionTotal } from "@/domain/portfolio";
import { getRepositories } from "@/data/repositories";
import type { TransactionType } from "@/domain/models";
import { describeOtherBroker, diagnoseFile } from "@/importers/diagnose";
import { parseTradeRepublicCsv } from "@/importers/trade-republic";
import { UnrecognizedFormatError, type ParsedImport } from "@/importers/types";
import { formatCurrency, formatDate, formatQuantity } from "@/lib/format";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
import { TRANSACTION_TYPE_LABELS } from "@/lib/labels";
import { useWideScreen } from "@/hooks/use-media-query";
import { usePortfolio } from "@/hooks/use-portfolio";
import { saveBackupCopy } from "@/lib/backup-file";
import { cn } from "@/lib/utils";
import { commitImport, prepareImport, type ImportPreview } from "@/services/import";

type Step =
  | { name: "upload"; error?: { message: string; columns: string[] } }
  | { name: "reading" }
  | { name: "preview"; preview: ImportPreview; parsed: ParsedImport; fileName: string }
  | { name: "importing"; preview: ImportPreview; parsed: ParsedImport; fileName: string }
  | { name: "done"; imported: number; replaced: number; assetIds: string[] };

const TYPE_ORDER: TransactionType[] = ["buy", "sell", "dividend", "interest", "fee"];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function ImportScreen() {
  const [step, setStep] = useState<Step>({ name: "upload" });

  async function readFile(file: File) {
    if (file.size > MAX_FILE_BYTES) {
      setStep({ name: "upload", error: { message: "El archivo supera los 10 MB.", columns: [] } });
      return;
    }
    const wrongFile = diagnoseFile(file.name, new Uint8Array(await file.slice(0, 8).arrayBuffer()));
    if (wrongFile) {
      setStep({ name: "upload", error: { message: wrongFile, columns: [] } });
      return;
    }
    setStep({ name: "reading" });
    try {
      const parsed = await parseTradeRepublicCsv(await file.text());
      const preview = await prepareImport(getRepositories(), parsed);
      setStep({ name: "preview", preview, parsed, fileName: file.name });
    } catch (error) {
      setStep({
        name: "upload",
        error: {
          message:
            (error instanceof UnrecognizedFormatError && describeOtherBroker(error.columns)) ||
            (error instanceof Error ? error.message : "No se pudo leer el archivo."),
          columns: error instanceof UnrecognizedFormatError && !describeOtherBroker(error.columns) ? error.columns : [],
        },
      });
    }
  }

  /** Marca o desmarca qué altas rápidas sustituye el archivo; recalcula la vista previa. */
  async function chooseReplacements(parsed: ParsedImport, fileName: string, replaceQuick: string[]) {
    const preview = await prepareImport(getRepositories(), parsed, { replaceQuick });
    setStep({ name: "preview", preview, parsed, fileName });
  }

  async function confirm(preview: ImportPreview, parsed: ParsedImport, fileName: string) {
    setStep({ name: "importing", preview, parsed, fileName });
    try {
      const { imported, replaced, assetIds } = await commitImport(getRepositories(), preview);
      setStep({ name: "done", imported, replaced, assetIds });
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
          onConfirm={() => confirm(step.preview, step.parsed, step.fileName)}
          onReplaceChange={(ids) => void chooseReplacements(step.parsed, step.fileName, ids)}
        />
      )}
      {step.name === "done" && <DoneStep imported={step.imported} replaced={step.replaced} assetIds={step.assetIds} />}
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
          La «Exportación de transacciones» de Trade Republic, tal cual, sin abrirla en Excel ni Numbers. Se lee en tu
          dispositivo y no se envía a ningún servidor.
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

      <ExportGuide />

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
  onReplaceChange,
}: {
  preview: ImportPreview;
  fileName: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  onReplaceChange: (ids: string[]) => void;
}) {
  const replacing = new Set(preview.replaces.map((t) => t.id));
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

      {preview.quick.length > 0 && (
        <QuickReplacements
          preview={preview}
          replacing={replacing}
          disabled={busy}
          onToggle={(id) =>
            onReplaceChange(replacing.has(id) ? [...replacing].filter((x) => x !== id) : [...replacing, id])
          }
        />
      )}

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

      {/* Escritorio: todas las columnas del archivo en una tabla. */}
      <Card className="hidden p-0 md:p-0 xl:block">
        <div className="max-h-[32rem] overflow-y-auto">
          <table className="w-full text-sm tabular-nums">
            <caption className="sr-only">Operaciones del archivo</caption>
            <thead className="sticky top-0 z-10 bg-surface-2 text-xs text-text-muted">
              <tr>
                {["Línea", "Fecha", "Tipo", "Activo", "ISIN", "Cantidad", "Precio", "Comisión", "Impuestos", "Importe", "Estado"].map((h, i) => (
                  <th key={h} scope="col" className={cn("px-2.5 py-2 font-medium first:pl-4 last:pr-4", i >= 5 && i <= 9 ? "text-right" : "text-left")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {preview.rows.map(({ transaction: t, duplicate, duplicateOf }) => (
                <tr key={`${t.line}-${t.importHash}`} className={cn("border-b border-border last:border-0", duplicate && "opacity-50")}>
                  <td className="py-2 pr-2.5 pl-4 text-text-muted">{t.line}</td>
                  <td className="px-2.5 whitespace-nowrap">{formatDate(t.date)}</td>
                  <td className="px-2.5 whitespace-nowrap">{TRANSACTION_TYPE_LABELS[t.type]}</td>
                  <td className="max-w-56 truncate px-2.5 font-medium">{t.asset?.name ?? "—"}</td>
                  <td className="px-2.5 font-mono text-xs text-text-muted">{t.asset?.isin ?? "—"}</td>
                  <td className="px-2.5 text-right">{formatQuantity(t.quantity)}</td>
                  <td className="px-2.5 text-right whitespace-nowrap">{formatCurrency(t.price)}</td>
                  <td className="px-2.5 text-right whitespace-nowrap">{formatCurrency(t.fee)}</td>
                  <td className="px-2.5 text-right whitespace-nowrap">{formatCurrency(t.tax)}</td>
                  <td className="px-2.5 text-right font-medium whitespace-nowrap">
                    {formatCurrency(transactionTotal({ ...t, id: "", origin: "csv-tr" }))}
                  </td>
                  <td className="py-2 pr-4 pl-2.5 text-xs whitespace-nowrap text-text-muted">
                    {duplicate ? (duplicateOf === "manual" ? "Ya la tienes" : "Ya importada") : "Nueva"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="p-1.5 md:p-2 xl:hidden">
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

/** Altas rápidas: las del mismo activo que el archivo se sustituyen por su historial real. */
function QuickReplacements({
  preview,
  replacing,
  disabled,
  onToggle,
}: {
  preview: ImportPreview;
  replacing: Set<string>;
  disabled: boolean;
  onToggle: (id: string) => void;
}) {
  return (
    <Card className="grid grid-cols-[minmax(0,1fr)] gap-3">
      <div>
        <h2 className="font-medium">Posiciones del alta rápida</h2>
        <p className="mt-1 text-sm text-pretty text-text-muted">
          Las marcadas se sustituyen por las compras reales del archivo, para no contarlas dos veces. Desmarca las que
          no sean de esta cuenta.
        </p>
      </div>
      <ul className="grid gap-1">
        {preview.quick.map(({ transaction: t, asset, suggested }) => (
          <li key={t.id}>
            <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-2 py-2.5 hover:bg-surface-2">
              <input
                type="checkbox"
                checked={replacing.has(t.id)}
                disabled={disabled}
                onChange={() => onToggle(t.id)}
                aria-label={`Sustituir el alta rápida de ${asset.name}`}
                className="size-5 shrink-0 accent-accent"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{asset.name}</span>
                <span className="block text-xs text-text-muted tabular-nums">
                  {formatQuantity(t.quantity)} uds a {formatCurrency(t.price)}
                  {suggested ? " · está en el archivo" : " · no está en el archivo"}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const GUIDES = {
  movil: {
    label: "En el iPhone",
    steps: [
      "En la app de Trade Republic: Perfil → Extractos → Exportación de transacciones.",
      "Elige desde la apertura de la cuenta y exporta.",
      "En el menú Compartir, toca «Guardar en Archivos».",
      "Vuelve aquí, toca «Elegir archivo» y ábrelo desde Archivos.",
    ],
  },
  pc: {
    label: "En el ordenador",
    steps: [
      "Entra en la web de Trade Republic (app.traderepublic.com).",
      "Perfil → Extractos → Exportación de transacciones, desde la apertura de la cuenta.",
      "Arrastra el archivo descargado al recuadro de arriba.",
    ],
  },
} as const;

/** Cómo conseguir el archivo, paso a paso. Tarda unos 2 minutos. */
function ExportGuide() {
  const wide = useWideScreen();
  const [chosen, setChosen] = useState<keyof typeof GUIDES | null>(null);
  const tab = chosen ?? (wide ? "pc" : "movil");
  return (
    <Card className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-medium">Cómo conseguir el archivo</h2>
        <span className="text-xs text-text-muted">Unos 2 minutos</span>
      </div>
      <div role="tablist" aria-label="Dónde exportas" className="grid grid-cols-2 gap-1 rounded-full border border-border bg-surface-2 p-1">
        {(Object.keys(GUIDES) as (keyof typeof GUIDES)[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setChosen(key)}
            className={cn(
              "h-9 rounded-full text-[13px] font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-accent/40",
              tab === key ? "bg-surface text-accent shadow-card dark:bg-accent/15" : "text-text-muted hover:text-text",
            )}
          >
            {GUIDES[key].label}
          </button>
        ))}
      </div>
      <ol role="tabpanel" className="grid gap-3">
        {GUIDES[tab].steps.map((step, i) => (
          <li key={step} className="flex gap-3 text-sm">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-medium text-accent tabular-nums">
              {i + 1}
            </span>
            <span className="pt-0.5 text-pretty">{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-xs text-pretty text-text-muted">
        Puedes importar el mismo archivo más adelante: las operaciones que ya estén no se duplican.
      </p>
    </Card>
  );
}

/** Tras importar: comprobar que cuadra con el bróker y guardar una copia. */
function DoneStep({ imported, replaced, assetIds }: { imported: number; replaced: number; assetIds: string[] }) {
  const portfolio = usePortfolio();
  const [answer, setAnswer] = useState<"yes" | "no" | null>(null);
  const [saved, setSaved] = useState(false);
  const positions =
    portfolio.status === "ready"
      ? assetIds.flatMap((id) => {
          const asset = portfolio.data.assets.get(id);
          const position = portfolio.data.state.positions.get(id);
          return asset && position?.quantity.gt(0) ? [{ asset, quantity: position.quantity }] : [];
        })
      : [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5">
      <Card className="flex flex-col items-center px-6 py-10 text-center">
        <CheckCircle2 className="mb-4 size-10 text-accent" aria-hidden />
        <h2 className="text-lg font-semibold">
          {imported === 0 ? "No había operaciones nuevas" : plural(imported, "operación importada", "operaciones importadas")}
        </h2>
        <p className="mt-2 text-sm text-pretty text-text-muted">
          {replaced > 0 && `${plural(replaced, "alta rápida sustituida", "altas rápidas sustituidas")} por su historial real. `}
          Los datos se han guardado solo en este dispositivo.
        </p>
      </Card>

      {positions.length > 0 && (
        <Card className="grid grid-cols-[minmax(0,1fr)] gap-4">
          <div>
            <h2 className="font-medium">¿Cuadra con Trade Republic?</h2>
            <p className="mt-1 text-sm text-pretty text-text-muted">Compara las participaciones con las que ves en tu cartera de TR.</p>
          </div>
          <ul className="grid gap-3">
            {positions.map(({ asset, quantity }) => (
              <li key={asset.id} className="flex items-center gap-3">
                <AssetAvatar asset={asset} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{asset.name}</span>
                <span className="text-sm tabular-nums">{formatQuantity(quantity)}</span>
              </li>
            ))}
          </ul>
          {answer === null && (
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => setAnswer("yes")}>
                Sí, cuadra
              </Button>
              <Button variant="outline" onClick={() => setAnswer("no")}>
                No cuadra
              </Button>
            </div>
          )}
          {answer === "yes" && (
            <p role="status" className="text-sm text-accent">
              Perfecto. Cuando hagas más operaciones, exporta e importa otra vez: solo se añade lo nuevo.
            </p>
          )}
          {answer === "no" && (
            <ul role="status" className="grid gap-2 rounded-2xl bg-surface-2 p-4 text-sm text-pretty">
              <li>· ¿Exportaste solo un periodo? Exporta otra vez desde la apertura de la cuenta e impórtalo: no se duplica nada.</li>
              <li>· ¿Registraste a mano alguna operación de ese activo? Revísala en Operaciones.</li>
              <li>· Los splits y las acciones regaladas aún no se importan: añádelas a mano.</li>
            </ul>
          )}
        </Card>
      )}

      <Card className="flex flex-wrap items-center justify-between gap-3 py-4 md:py-4">
        <p className="min-w-0 flex-1 text-sm text-pretty text-text-muted">
          {saved ? "Copia guardada." : "Guarda una copia por si cambias de móvil."}
        </p>
        <Button
          variant="secondary"
          disabled={saved}
          onClick={async () => setSaved(await saveBackupCopy(getRepositories()))}
        >
          <Download aria-hidden />
          Guardar copia
        </Button>
      </Card>

      <Link href="/cartera" className={buttonVariants({ size: "lg" })}>
        Ver mi cartera
      </Link>
    </div>
  );
}
