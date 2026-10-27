import type { Person } from "./api";

export function needsApproval(member?: Pick<Person, "approval_status"> | null) {
  return !!member?.approval_status && member.approval_status !== "approved";
}

export function approvalLabel(status: Person["approval_status"]) {
  return {
    required: "Application required",
    pending: "Pending (Approval)",
    denied: "Application denied",
    approved: "Approved",
  }[status];
}
