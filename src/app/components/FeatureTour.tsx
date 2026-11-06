"use client";

import { useEffect, useRef, useState } from "react";
import { desktopGuideSteps, mobileGuideSteps, placeGuideBubble } from "@/lib/guide";
import { useI18n } from "../i18n/AppI18nProvider";

type TourLayout = {
  target: { top: number; left: number; width: number; height: number };
  bubble: { top: number; left: number; maxWidth: number; maxHeight: number };
};

export function FeatureTour({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const focusedStepRef = useRef<string | null>(null);
  const [index, setIndex] = useState(0);
  const [mobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 899px)").matches);
  const [layout, setLayout] = useState<TourLayout | null>(null);
  const steps = mobile ? mobileGuideSteps : desktopGuideSteps;
  const step = steps[index];
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    const breakpoint = window.matchMedia("(max-width: 899px)");
    const close = () => closeRef.current();
    breakpoint.addEventListener("change", close);
    window.addEventListener("popstate", close);
    return () => {
      breakpoint.removeEventListener("change", close);
      window.removeEventListener("popstate", close);
      dialog.close();
      const fallback = document.querySelector<HTMLElement>('[data-tour="edition"] m3e-button[tabindex="0"]');
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected && previousFocus !== document.body) previousFocus.focus({ preventScroll: true });
      else fallback?.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    const target = document.querySelector<HTMLElement>(`[data-tour="${step}"]`);
    const bubble = bubbleRef.current;
    if (!target || !bubble || target.getClientRects().length === 0) {
      closeRef.current();
      return;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: reducedMotion ? "instant" : "smooth" });
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        if (!target.isConnected || !rect.width || !rect.height) {
          closeRef.current();
          return;
        }
        const bounds = bubble.getBoundingClientRect();
        const viewport = window.visualViewport;
        setLayout({
          target: { top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 },
          bubble: {
            ...placeGuideBubble(rect, bounds, { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight, left: viewport?.offsetLeft, top: viewport?.offsetTop }),
            maxWidth: Math.max(1, (viewport?.width ?? window.innerWidth) - 32),
            maxHeight: Math.max(1, (viewport?.height ?? window.innerHeight) - 32)
          }
        });
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(target);
    observer.observe(bubble);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, [step]);

  useEffect(() => {
    if (layout && focusedStepRef.current !== step) {
      headingRef.current?.focus({ preventScroll: true });
      focusedStepRef.current = step;
    }
  }, [layout, step]);

  return (
    <dialog className="feature-tour" ref={dialogRef} aria-labelledby="feature-tour-title" aria-describedby="feature-tour-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {layout ? <div className="feature-tour__spotlight" aria-hidden="true" style={layout.target} /> : null}
      <div className="feature-tour__bubble" ref={bubbleRef} style={layout ? layout.bubble : { visibility: "hidden" }}>
        <p className="helper-text">{t("guide.progress", { current: index + 1, total: steps.length })}</p>
        <h2 className="card-title" id="feature-tour-title" tabIndex={-1} ref={headingRef}>{t(`guide.${step}.title`)}</h2>
        <p id="feature-tour-description">{t(`guide.${step}.description`)}</p>
        <div className="feature-tour__actions">
          <button className="guide-button guide-button--text" onClick={onClose}>{t("guide.end")}</button>
          {index > 0 ? <button className="guide-button guide-button--text" onClick={() => setIndex((current) => current - 1)}>{t("onboarding.previous")}</button> : null}
          <button className="guide-button" onClick={() => index === steps.length - 1 ? onClose() : setIndex((current) => current + 1)}>
            {t(index === steps.length - 1 ? "guide.finish" : "onboarding.next")}
          </button>
        </div>
      </div>
    </dialog>
  );
}
