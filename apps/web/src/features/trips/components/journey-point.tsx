/** One place on a trip's timeline (start, stop or end). */
export function JourneyPoint({
  label,
  detail,
  tone,
}: {
  label: string;
  detail: string;
  tone: "muted" | "primary";
}) {
  return (
    <li className="relative">
      <span
        aria-hidden
        className={`absolute top-1.5 -left-[1.85rem] size-3 rounded-full ring-4 ring-card ${tone === "primary" ? "bg-primary" : "bg-muted-foreground"}`}
      />
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted-foreground tabular-nums">{detail}</p>
    </li>
  );
}
