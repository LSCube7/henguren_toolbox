"use client";

import { M3eDialog, type M3eDialogElement } from "@m3e/react/dialog";
import { focusWhenReady } from "@m3e/web/core";
import { useEffect, useRef, type ComponentProps, type KeyboardEvent } from "react";

type DialogProps = Omit<ComponentProps<typeof M3eDialog>, "ref">;
const formControls = "input:not([type=hidden]),select,textarea,m3e-select,m3e-switch";
const focusableControls = `${formControls},button,a[href],[tabindex],m3e-button,m3e-icon-button,m3e-filter-chip`;

function controls(dialog: HTMLElement) {
  return Array.from(dialog.querySelectorAll<HTMLElement>(focusableControls)).filter((element) =>
    element.tabIndex >= 0 && !element.matches(":disabled,[disabled]") && element.getClientRects().length > 0);
}

/** Preserve native form focus across M3E's nested slots; keep its Dialog lifecycle. */
export function Dialog({ open, onKeyDown, ...props }: DialogProps) {
  const dialogRef = useRef<M3eDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    dialog.noFocusTrap = Boolean(props.noFocusTrap);
    let active = true;
    void dialog.show().then(async () => {
      if (!active || props.dismissible || !dialog.querySelector(formControls)) return;
      // Native <dialog> makes the rest of the document inert. Handle only the
      // boundaries its internal trap cannot find through nested form slots.
      dialog.noFocusTrap = true;
      await dialog.updateComplete;
      const first = controls(dialog)[0];
      if (active && first) await focusWhenReady(first, 1000);
    });
    return () => { active = false; };
  }, [open, props.dismissible, props.noFocusTrap]);

  function handleKeyDown(event: KeyboardEvent<M3eDialogElement>) {
    onKeyDown?.(event);
    const dialog = dialogRef.current;
    if (event.defaultPrevented || event.key !== "Tab" || !dialog || props.dismissible || !dialog.querySelector(formControls)) return;
    const items = controls(dialog);
    const first = items[0];
    const last = items.at(-1);
    const current = document.activeElement;
    if (first && last && ((event.shiftKey && current === first) || (!event.shiftKey && current === last))) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
    }
  }

  return <M3eDialog {...props} ref={dialogRef} open={open} onKeyDown={handleKeyDown} />;
}
