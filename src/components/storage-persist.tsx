"use client";

import { useEffect } from "react";
import { getRepositories, subscribeToDataChanges } from "@/data/repositories";
import { requestPersistentStorage } from "@/lib/storage";

/** En cuanto hay alguna operación, pide al navegador que no borre los datos. No pinta nada. */
export function StoragePersist() {
  useEffect(() => {
    let done = false;
    const check = async () => {
      if (done) return;
      const transactions = await getRepositories().transactions.list();
      if (transactions.length === 0) return;
      done = true;
      await requestPersistentStorage();
    };
    void check();
    return subscribeToDataChanges(() => void check());
  }, []);
  return null;
}
