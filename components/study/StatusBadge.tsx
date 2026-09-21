import type { Status } from "@/types/domain";
export const statusLabels: Record<Status, string> = {
  free: "Free",
  share: "Open to Share",
  occupied: "Occupied",
  unknown: "Unknown",
};
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`status ${status}`}>{statusLabels[status]}</span>;
}
