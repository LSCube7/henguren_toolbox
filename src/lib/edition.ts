"use client";

import { useSyncExternalStore } from "react";

export type Edition = "junior" | "senior";

export const editionStorageKey = "henguren-v3-edition";
export const editionChangeEvent = "henguren-edition-change";
export const defaultEdition: Edition = "junior";

export function readEdition(): Edition {
  if (typeof window === "undefined") return defaultEdition;
  return localStorage.getItem(editionStorageKey) === "senior" ? "senior" : "junior";
}

export function writeEdition(edition: Edition) {
  localStorage.setItem(editionStorageKey, edition);
  window.dispatchEvent(new CustomEvent(editionChangeEvent, { detail: edition }));
}

function subscribeEdition(onStoreChange: () => void) {
  window.addEventListener(editionChangeEvent, onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    window.removeEventListener(editionChangeEvent, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

export function useEdition() {
  return useSyncExternalStore(subscribeEdition, readEdition, () => defaultEdition);
}
