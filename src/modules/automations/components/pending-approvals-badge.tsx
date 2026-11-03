"use client";

import { useEffect, useState } from "react";

/** The number of approvals waiting for the member, next to the Approvals link. Hidden when there are none or the member cannot decide any. */
export function PendingApprovalsBadge({refreshKey}: {refreshKey: string}) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/approvals?view=pending", {credentials: "same-origin", cache: "no-store"})
      .then(response => response.ok ? response.json() : null)
      .then((body: {data?: {approvals: Array<{canDecide: boolean}>}} | null) => { if (active) setCount(body?.data?.approvals.filter(row => row.canDecide).length ?? 0); }, () => undefined);
    return () => { active = false; };
  }, [refreshKey]);
  if (!count) return null;
  return <span className="ml-auto rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground tabular-nums group-data-[collapsible=icon]:hidden" aria-label={`${count} pending`}>{count >= 50 ? "50+" : count}</span>;
}
