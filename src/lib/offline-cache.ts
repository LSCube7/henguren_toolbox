"use client";

import { useEffect, useState } from "react";
import type { VocabListMeta } from "./vocab-data";

export type VocabCacheState = "unsupported" | "cached" | "missing" | "error";

const cachePrefix = "henguren-v3-offline";
// Keep this value in sync with VERSION in public/sw.js.
const cacheVersion = "v2";
const dataCacheName = `${cachePrefix}-${cacheVersion}-data`;

function vocabUrl(name: string) {
  return `/api/data/vocab/${encodeURIComponent(name)}`;
}

export function isOnline() {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

export function useOnlineStatus() {
  const [online, setOnline] = useState(() => isOnline());

  useEffect(() => {
    function update() {
      setOnline(isOnline());
    }

    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  return online;
}

export async function readVocabCacheStates(metas: VocabListMeta[]) {
  const states: Record<string, VocabCacheState> = {};
  if (typeof caches === "undefined") {
    metas.forEach((meta) => {
      states[meta.name] = "unsupported";
    });
    return states;
  }

  try {
    const cache = await caches.open(dataCacheName);
    await Promise.all(
      metas.map(async (meta) => {
        states[meta.name] = (await cache.match(vocabUrl(meta.name))) ? "cached" : "missing";
      })
    );
  } catch {
    metas.forEach((meta) => {
      states[meta.name] = "error";
    });
  }
  return states;
}

export async function cacheVocabLists(metas: VocabListMeta[]) {
  if (metas.length === 0) return { cached: 0, failed: 0 };
  if (typeof caches === "undefined") return { cached: 0, failed: metas.length };

  const cache = await caches.open(dataCacheName);
  let cached = 0;
  let failed = 0;

  await Promise.all(
    metas.map(async (meta) => {
      try {
        const request = new Request(vocabUrl(meta.name), { credentials: "same-origin" });
        const response = await fetch(request);
        if (!response.ok) throw new Error(`Failed to cache ${meta.name}`);
        await cache.put(request, response.clone());
        cached += 1;
      } catch {
        failed += 1;
      }
    })
  );

  return { cached, failed };
}

export async function clearOfflineCaches() {
  if (typeof caches === "undefined") return { deleted: 0 };

  const keys = await caches.keys();
  const projectKeys = keys.filter((key) => key.startsWith(`${cachePrefix}-`));
  const deletedCaches = await Promise.all(projectKeys.map((key) => caches.delete(key)));

  return { deleted: deletedCaches.filter(Boolean).length };
}
