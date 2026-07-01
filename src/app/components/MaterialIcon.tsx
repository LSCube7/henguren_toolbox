export function MaterialIcon({ name, className = "" }: { name: string; className?: string }) {
  return (
    <span className={`material-symbols-rounded ${className}`.trim()} aria-hidden="true">
      {name}
    </span>
  );
}
