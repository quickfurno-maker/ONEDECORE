export function vendorStatusLabel(status: string): string {
  if (status === "pending_review") return "Under Review";
  if (status === "changes_requested") return "Changes Requested";
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  return "Draft";
}
