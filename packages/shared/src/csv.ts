import { NormalizedActivity } from "./types.js";

export function formatAccountantCsv(activities: NormalizedActivity[]): string {
  const headers = [
    "Event ID",
    "Timestamp (UTC)",
    "Chain",
    "Event Type",
    "From",
    "To",
    "Asset",
    "Amount Formatted",
    "Amount Raw",
    "Status",
    "Transaction Hash / ID",
    "Explorer URL",
  ];

  const rows = activities.map((a) => [
    `"${a.id}"`,
    `"${new Date(a.timestamp * 1000).toISOString()}"`,
    `"${a.chainKey}"`,
    `"${a.eventType}"`,
    `"${a.from}"`,
    `"${a.to}"`,
    `"${a.asset}"`,
    `"${a.amountFormatted}"`,
    `"${a.amountRaw}"`,
    `"${a.status}"`,
    `"${a.txId}"`,
    `"${a.explorerUrl}"`,
  ]);

  return [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
}
