"use client";

import { useEffect, useRef, useState } from "react";
import { M3eButton } from "@m3e/react/button";
import { desktopGuideSteps, mobileGuideSteps, placeGuideBubble } from "@/lib/guide";
import { useI18n } from "../i18n/AppI18nProvider";

type TourLayout = {
  animate: boolean;
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
  const isLastStep = index === steps.length - 1;
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
    // Let M3E motion position the guide, without a competing browser scroll curve.
    target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "instant" });
    let frame = 0;
    let enteringStep = true;
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
        const next: TourLayout = {
          animate: enteringStep,
          target: { top: rect.top - 4, left: rect.left - 4, width: rect.width + 8, height: rect.height + 8 },
          bubble: {
            ...placeGuideBubble(rect, bounds, { width: viewport?.width ?? window.innerWidth, height: viewport?.height ?? window.innerHeight, left: viewport?.offsetLeft, top: viewport?.offsetTop }),
            maxWidth: Math.max(1, (viewport?.width ?? window.innerWidth) - 32),
            maxHeight: Math.max(1, (viewport?.height ?? window.innerHeight) - 32)
          }
        };
        enteringStep = false;
        setLayout((current) => {
          // ResizeObserver's initial notification must not cancel a step transition.
          if (current && current.target.top === next.target.top && current.target.left === next.target.left
            && current.target.width === next.target.width && current.target.height === next.target.height
            && current.bubble.top === next.bubble.top && current.bubble.left === next.bubble.left
            && current.bubble.maxWidth === next.bubble.maxWidth && current.bubble.maxHeight === next.bubble.maxHeight) return current;
          return next;
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
    <dialog className="feature-tour" ref={dialogRef} data-motion={layout?.animate ? "step" : "follow"}
      aria-labelledby="feature-tour-title" aria-describedby="feature-tour-description"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      {layout ? <div className="feature-tour__spotlight" aria-hidden="true" style={layout.target} /> : null}
      <div className="feature-tour__bubble" ref={bubbleRef} style={layout ? layout.bubble : { visibility: "hidden" }}>
        <div className="feature-tour__content" key={step}>
          <p className="helper-text">{t("guide.progress", { current: index + 1, total: steps.length })}</p>
          <h2 className="card-title" id="feature-tour-title" tabIndex={-1} ref={headingRef}>{t(`guide.${step}.title`)}</h2>
          <p id="feature-tour-description">{t(`guide.${step}.description`)}</p>
          <div className="feature-tour__actions">
            {!isLastStep ? <M3eButton variant="text" onClick={onClose}>{t("guide.end")}</M3eButton> : null}
            {index > 0 ? <M3eButton variant="text" onClick={() => setIndex((current) => current - 1)}>{t("onboarding.previous")}</M3eButton> : null}
            <M3eButton variant="filled" onClick={() => isLastStep ? onClose() : setIndex((current) => current + 1)}>
              {t(isLastStep ? "guide.finish" : "onboarding.next")}
            </M3eButton>
          </div>
        </div>
      </div>
    </dialog>
  );
}
