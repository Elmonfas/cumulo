"use client";

import { Download, ShieldCheck, Trash2, Upload, UserRound } from "lucide-react";
import { useRef, useState } from "react";
import { PeriodSelector } from "@/components/charts/period-selector";
import { PageHeader } from "@/components/layout/page-header";
import { rememberAvatar } from "@/components/layout/settings-link";
import { NotificationsCard } from "./notifications-card";
import { ThemeSelector } from "@/components/theme-selector";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { setPrivacy, usePrivacy } from "@/lib/privacy";
import { getRepositories, type Repositories } from "@/data/repositories";
import type { Settings } from "@/domain/models";
import { useLiveQuery } from "@/hooks/use-live-query";
import { formatDate } from "@/lib/format";
import { downloadText, squareThumbnail } from "@/lib/image";
import { exportBackup, readBackup, restoreBackup, wipeAllData, type BackupSummary } from "@/services/backup";

const loadSettings = (repositories: Repositories) => repositories.settings.get();

export function SettingsScreen() {
  const settings = useLiveQuery(loadSettings);
  return (
    <>
      <PageHeader title="Ajustes" showSettings={false} showPrivacy={false} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 md:gap-5 lg:grid-cols-2 lg:items-start">
        {settings.status === "ready" ? (
          <ProfileCard key={settings.data.profileName} settings={settings.data} />
        ) : (
          <div className="h-44 animate-pulse rounded-card bg-surface" aria-hidden />
        )}
        <Card className="grid gap-5">
          <div>
            <h2 className="font-medium">Apariencia</h2>
            <p className="mt-1 mb-3 text-sm text-text-muted">Elige un tema o sigue el de tu dispositivo.</p>
            <ThemeSelector />
          </div>
          <PrivacySwitch />
          <div>
            <h2 className="font-medium">Periodo por defecto</h2>
            <p className="mt-1 mb-3 text-sm text-text-muted">El que verás al abrir Inicio.</p>
            {settings.status === "ready" && (
              <PeriodSelector
                value={settings.data.defaultPeriod}
                onChange={(defaultPeriod) => getRepositories().settings.update({ defaultPeriod })}
              />
            )}
          </div>
        </Card>
        <NotificationsCard />
        <DataCard />
        <Card className="flex gap-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-medium">Tus datos no salen de aquí</h2>
            <p className="mt-1 text-sm text-pretty text-text-muted">
              Operaciones, cantidades y ajustes se guardan solo en este navegador. Para pedir precios únicamente se envían
              tickers o ISIN; si activas las alertas con la app cerrada, también su activo y precio. Haz copias de seguridad de vez en cuando.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}

function PrivacySwitch() {
  const hidden = usePrivacy();
  return (
    <Switch
      label="Modo privado"
      description="Oculta los importes (€ y cantidades) y deja los porcentajes. También desde el ojo de cada pantalla."
      checked={hidden}
      onCheckedChange={setPrivacy}
    />
  );
}

function ProfileCard({ settings }: { settings: Settings }) {
  const [name, setName] = useState(settings.profileName);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const repositories = () => getRepositories().settings;

  async function onAvatar(file: File) {
    try {
      setError(null);
      await repositories().update({ avatar: await squareThumbnail(file) });
      rememberAvatar(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo usar la imagen.");
    }
  }

  return (
    <Card>
      <h2 className="font-medium">Perfil</h2>
      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileInput.current?.click()}
          aria-label="Cambiar foto de perfil"
          className="relative size-16 shrink-0 overflow-hidden rounded-full bg-accent/15 text-accent outline-none focus-visible:ring-3 focus-visible:ring-accent/40"
        >
          {settings.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element -- dataURL local, no pasa por el optimizador
            <img src={settings.avatar} alt="" className="size-full object-cover" />
          ) : (
            <UserRound className="mx-auto size-7" aria-hidden />
          )}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-label="Foto de perfil"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onAvatar(file);
            e.target.value = "";
          }}
        />
        <div className="grid min-w-0 flex-1 gap-1.5">
          <label htmlFor="profile-name" className="text-sm font-medium">
            Nombre
          </label>
          <input
            id="profile-name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() !== settings.profileName && repositories().update({ profileName: name.trim() })}
            placeholder="Cómo quieres que te salude"
            className="h-11 w-full min-w-0 rounded-2xl border border-border bg-surface-2 px-4 text-base outline-none focus:border-accent focus:ring-3 focus:ring-accent/20"
          />
        </div>
      </div>
      {settings.avatar && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => {
            rememberAvatar(false);
            void repositories().update({ avatar: undefined });
          }}>
          Quitar foto
        </Button>
      )}
      {error && <p className="mt-2 text-xs text-accent">{error}</p>}
    </Card>
  );
}

type RestoreState = { status: "idle" } | { status: "confirm"; summary: BackupSummary } | { status: "done"; message: string };

function DataCard() {
  const fileInput = useRef<HTMLInputElement>(null);
  const [restore, setRestore] = useState<RestoreState>({ status: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [busy, setBusy] = useState(false);

  async function onExport() {
    const { fileName, json } = await exportBackup(getRepositories());
    downloadText(fileName, json);
  }

  async function onFile(file: File) {
    setError(null);
    try {
      setRestore({ status: "confirm", summary: readBackup(await file.text()) });
    } catch (e) {
      setRestore({ status: "idle" });
      setError(e instanceof Error ? e.message : "No se pudo leer el archivo.");
    }
  }

  async function onRestore(summary: BackupSummary) {
    setBusy(true);
    try {
      await restoreBackup(getRepositories(), summary.data);
      rememberAvatar(Boolean(summary.data.settings.avatar));
      setRestore({ status: "done", message: `Backup restaurado: ${summary.transactions} operaciones y ${summary.assets} activos.` });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo restaurar.");
      setRestore({ status: "idle" });
    } finally {
      setBusy(false);
    }
  }

  async function onWipe() {
    if (!confirmWipe) {
      setConfirmWipe(true);
      return;
    }
    setBusy(true);
    await wipeAllData(getRepositories());
    rememberAvatar(false);
    setBusy(false);
    setConfirmWipe(false);
    setRestore({ status: "done", message: "Se han borrado todos los datos de este navegador." });
  }

  return (
    <Card className="grid gap-4">
      <div>
        <h2 className="font-medium">Copia de seguridad</h2>
        <p className="mt-1 text-sm text-pretty text-text-muted">
          Un archivo JSON con todas tus operaciones, activos y ajustes. Restáuralo en otro navegador o dispositivo.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button variant="secondary" onClick={onExport} className="sm:flex-1">
          <Download aria-hidden />
          Exportar backup
        </Button>
        <Button variant="outline" onClick={() => fileInput.current?.click()} className="sm:flex-1">
          <Upload aria-hidden />
          Restaurar backup
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label="Archivo de backup"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
      </div>

      {restore.status === "confirm" && (
        <div role="alertdialog" aria-label="Confirmar restauración" className="grid gap-3 rounded-2xl border border-accent/40 bg-accent/10 p-4">
          <p className="text-sm text-pretty">
            Backup del {formatDate(restore.summary.exportedAt.slice(0, 10))} con {restore.summary.transactions} operaciones y{" "}
            {restore.summary.assets} activos. <strong className="font-medium">Sustituirá todos los datos actuales.</strong>
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setRestore({ status: "idle" })} disabled={busy}>
              Cancelar
            </Button>
            <Button size="sm" onClick={() => onRestore(restore.summary)} disabled={busy}>
              Restaurar
            </Button>
          </div>
        </div>
      )}
      {restore.status === "done" && (
        <p role="status" className="text-sm text-accent">
          {restore.message}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-pretty text-accent">
          {error}
        </p>
      )}

      <div className="border-t border-border pt-4">
        <Button variant={confirmWipe ? "secondary" : "ghost"} onClick={onWipe} disabled={busy} className="w-full sm:w-auto">
          <Trash2 aria-hidden />
          {confirmWipe ? "Pulsa otra vez para borrarlo todo" : "Borrar todos los datos"}
        </Button>
      </div>
    </Card>
  );
}
