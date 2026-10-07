"use client";

import { usePathname } from "next/navigation";
import "@m3e/web/snackbar";
import { M3eButton } from "@m3e/react/button";
import { M3eIconButton } from "@m3e/react/icon-button";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/AppI18nProvider";
import { MaterialIcon } from "./MaterialIcon";
import { stripLocalePrefix } from "@/lib/localized-routing";

export type SnackbarTone = "info" | "error";

type SnackbarNotice = {
  id: number;
  message: string;
  tone: SnackbarTone;
};

type SnackbarContextValue = {
  clearSnackbar: () => void;
  showSnackbar: (message: string, tone?: SnackbarTone) => void;
};

const SnackbarContext = createContext<SnackbarContextValue | null>(null);
const SnackbarActiveContext = createContext(false);
const snackbarAutoDismissDuration = 5000;
const snackbarExitDuration = 200;

function legacyCopy(text: string) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();
  const copied = document.execCommand("copy");
  textArea.remove();
  if (!copied) throw new Error("clipboard_copy_failed");
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  legacyCopy(text);
}

function SnackbarSurface({ notice, onDismiss }: { notice: SnackbarNotice; onDismiss: (id: number) => void }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const shellless = stripLocalePrefix(pathname) === "/onboarding";
  const [closing, setClosing] = useState(false);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const dismissTimerRef = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    dismissTimerRef.current = window.setTimeout(() => onDismiss(notice.id), snackbarExitDuration);
  }, [closing, notice.id, onDismiss]);

  useEffect(() => {
    if (notice.tone === "error" || closing) return;
    const timer = window.setTimeout(dismiss, snackbarAutoDismissDuration - snackbarExitDuration);
    return () => window.clearTimeout(timer);
  }, [closing, dismiss, notice.tone]);

  useEffect(
    () => () => {
      if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    },
    []
  );

  async function copyError() {
    try {
      await copyText(notice.message);
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  }

  return (
    <m3e-snackbar
      open={!closing} duration={0}
      className={`app-notice${shellless ? " app-notice--shellless" : ""}`}
      data-closing={closing}
      data-tone={notice.tone}
      role={notice.tone === "error" ? "alert" : "status"}
      aria-live={notice.tone === "error" ? "assertive" : "polite"}
      aria-atomic="true"
    >
      <span className="app-snackbar__message">{notice.message}</span>
      {notice.tone === "error" ? (
        <div className="app-snackbar__actions">
          <M3eButton variant="text" onClick={() => void copyError()}>
            {t(copyState === "copied" ? "common.copied" : copyState === "failed" ? "common.copyFailed" : "common.copy")}
          </M3eButton>
          <M3eIconButton aria-label={t("common.close")} onClick={dismiss}>
            <MaterialIcon name="close" />
          </M3eIconButton>
        </div>
      ) : null}
    </m3e-snackbar>
  );
}

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const nextIdRef = useRef(0);
  const [notice, setNotice] = useState<SnackbarNotice | null>(null);

  const clearSnackbar = useCallback(() => setNotice(null), []);
  const dismissSnackbar = useCallback((id: number) => {
    setNotice((current) => (current?.id === id ? null : current));
  }, []);
  const showSnackbar = useCallback((message: string, tone: SnackbarTone = "info") => {
    nextIdRef.current += 1;
    setNotice({ id: nextIdRef.current, message, tone });
  }, []);
  const contextValue = useMemo(() => ({ clearSnackbar, showSnackbar }), [clearSnackbar, showSnackbar]);

  return (
    <SnackbarContext.Provider value={contextValue}>
      <SnackbarActiveContext.Provider value={Boolean(notice)}>
        {children}
        {notice ? <SnackbarSurface key={notice.id} notice={notice} onDismiss={dismissSnackbar} /> : null}
      </SnackbarActiveContext.Provider>
    </SnackbarContext.Provider>
  );
}

/** Coordinate presentations with M3E's single visible snackbar. */
export function useSnackbarActive() {
  return useContext(SnackbarActiveContext);
}

export function useSnackbar() {
  const value = useContext(SnackbarContext);
  if (!value) throw new Error("useSnackbar must be used within SnackbarProvider.");
  return value;
}
