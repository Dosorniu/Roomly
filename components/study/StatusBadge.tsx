import type { Status } from "@/types/domain";
export const statusLabels: Record<Status, string> = {
  free: "Free",
  share: "Open to Share",
  occupied: "Occupied",
};
export function StatusBadge({
  status,
  label,
}: {
  status: Status;
  label?: string;
}) {
  return (
    <span className={`status ${status}`}>{label ?? statusLabels[status]}</span>
  );
}
