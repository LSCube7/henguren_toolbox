export function StatusAlert({ message, tone = "info" }: { message?: string; tone?: "info" | "error" }) {
  if (!message) return null;
  return (
    <div className={`md-card md-card--flat ${tone === "error" ? "badge--error" : ""}`} role={tone === "error" ? "alert" : "status"}>
      {message}
    </div>
  );
}
