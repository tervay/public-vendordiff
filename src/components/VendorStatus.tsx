import { formatDate } from "@/lib/format";
import type { getLatestRuns } from "@/lib/queries";

type LatestRun = Awaited<ReturnType<typeof getLatestRuns>>[number];

const statusText = { ok: "Checked", failed: "Check failed", rejected: "Check skipped" } as const;
const statusDot = { ok: "bg-good", failed: "bg-critical", rejected: "bg-amber-500" } as const;

export function VendorStatus({ run }: { run: LatestRun | undefined }) {
  if (!run) return <span className="text-sm text-subtle">Not checked yet</span>;
  return (
    <span className="flex items-center gap-1.5 text-sm text-muted">
      <span className={`size-2 shrink-0 rounded-full ${statusDot[run.status]}`} />
      {statusText[run.status]} {formatDate(run.startedAt)}
    </span>
  );
}
