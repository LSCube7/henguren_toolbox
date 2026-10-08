import type { KeyboardEvent } from "react";

/** M3E groups supply shape/state; radio groups also need arrow-key selection. */
export function moveButtonGroupSelection(event: KeyboardEvent<HTMLElement>) {
  if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) return;
  const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('m3e-button[role="radio"]:not([disabled])'));
  const current = buttons.indexOf(event.target as HTMLElement);
  if (current < 0) return;
  event.preventDefault();
  const backward = event.key === "ArrowLeft" || event.key === "ArrowUp";
  const index = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
    (current + (backward ? -1 : 1) + buttons.length) % buttons.length;
  buttons[index].focus();
  buttons[index].click();
}
