import { materialSymbolCodepoints, type MaterialSymbolName } from "@/generated/material-symbols";

export function MaterialIcon({ name, className = "" }: { name: MaterialSymbolName; className?: string }) {
  return (
    <span className={`material-symbols-rounded ${className}`.trim()} aria-hidden="true">
      {materialSymbolCodepoints[name]}
    </span>
  );
}
