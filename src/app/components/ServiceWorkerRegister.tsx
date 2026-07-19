"use client";

import { useEffect, useState } from "react";

const cachePrefix = "henguren-v3-offline";

async function clearProjectCaches() {
  if (typeof caches === "undefined") return;
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(`${cachePrefix}-`)).map((key) => caches.delete(key)));
}

async function disableDevelopmentServiceWorker() {
  const registration = await navigator.serviceWorker.getRegistration();
  await registration?.unregister();
  await clearProjectCaches();
}

export function ServiceWorkerRegister() {
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null);
  const [applyingUpdate, setApplyingUpdate] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void disableDevelopmentServiceWorker().catch((error) => {
        console.warn("Service worker cleanup failed", error);
      });
      return;
    }

    let refreshing = false;
    let currentController = navigator.serviceWorker.controller;
    let registration: ServiceWorkerRegistration | undefined;
    let handleUpdateFound: (() => void) | undefined;

    function handleControllerChange() {
      if (!currentController) {
        currentController = navigator.serviceWorker.controller;
        return;
      }
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    }

    function requestUpdate() {
      if (document.visibilityState !== "visible") return;
      if (registration?.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(registration.waiting);
      }
      void registration?.update().catch((error) => {
        console.warn("Service worker update check failed", error);
      });
    }

    function watchInstallingWorker(worker: ServiceWorker | null) {
      if (!worker) return;
      worker.addEventListener("statechange", () => {
        if (worker.state === "installed" && navigator.serviceWorker.controller) {
          setWaitingWorker(worker);
        }
      });
    }

    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);
    window.addEventListener("focus", requestUpdate);
    document.addEventListener("visibilitychange", requestUpdate);

    navigator.serviceWorker.register("/sw.js").then((nextRegistration) => {
      registration = nextRegistration;
      if (nextRegistration.waiting && navigator.serviceWorker.controller) {
        setWaitingWorker(nextRegistration.waiting);
      }
      watchInstallingWorker(nextRegistration.installing);
      handleUpdateFound = () => watchInstallingWorker(nextRegistration.installing);
      nextRegistration.addEventListener("updatefound", handleUpdateFound);
      requestUpdate();
    }).catch((error) => {
      console.warn("Service worker registration failed", error);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
      window.removeEventListener("focus", requestUpdate);
      document.removeEventListener("visibilitychange", requestUpdate);
      if (registration && handleUpdateFound) {
        registration.removeEventListener("updatefound", handleUpdateFound);
      }
    };
  }, []);

  function applyUpdate() {
    if (!waitingWorker) return;
    setApplyingUpdate(true);
    try {
      waitingWorker.postMessage({ type: "SKIP_WAITING" });
    } catch (error) {
      setApplyingUpdate(false);
      console.warn("Service worker activation failed", error);
    }
  }

  if (!waitingWorker) return null;

  return (
    <div className="service-worker-snackbar" role="status" aria-live="polite" aria-atomic="true">
      <span>新版本已准备好，刷新页面即可更新。</span>
      <md-text-button disabled={applyingUpdate} onClick={applyUpdate}>
        {applyingUpdate ? "正在更新…" : "刷新更新"}
      </md-text-button>
    </div>
  );
}
