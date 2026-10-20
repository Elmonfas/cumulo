"use client";

import { useEffect } from "react";
import { getRepositories, subscribeToDataChanges } from "@/data/repositories";
import { readPushPrefs, syncPush } from "@/lib/push";

/**
 * Mantiene al día lo que sabe el servidor de push: al abrir la app, al volver a
 * ella y cuando cambian las alertas. No pinta nada.
 */
export function PushSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (readPushPrefs().enabled) void syncPush(getRepositories()).catch(() => undefined);
      }, 1500);
    };
    const onVisible = () => document.visibilityState === "visible" && sync();
    sync();
    // Los precios se guardan cada 30 s: solo se resincroniza si cambian las alertas.
    let signature = "";
    const onData = async () => {
      if (!readPushPrefs().alerts) return;
      const alerts = await getRepositories().alerts.list();
      const next = JSON.stringify(alerts.map((a) => [a.id, a.direction, a.price, a.triggeredAt ?? ""]));
      if (signature && next !== signature) sync();
      signature = next;
    };
    void onData();
    const unsubscribe = subscribeToDataChanges(() => void onData());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}
