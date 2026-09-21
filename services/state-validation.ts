import type { StudyState } from "../types/domain";
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}
function timestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function text(value: unknown): value is string {
  return typeof value === "string";
}
export function isStudyState(value: unknown): value is StudyState {
  if (
    !record(value) ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 0
  )
    return false;
  const { sessions, memberships, observations } = value;
  if (
    !Array.isArray(sessions) ||
    !Array.isArray(memberships) ||
    !Array.isArray(observations)
  )
    return false;
  if ([sessions, memberships, observations].some((rows) => rows.length > 10000))
    return false;
  return (
    sessions.every(
      (s) =>
        record(s) &&
        text(s.id) &&
        text(s.roomId) &&
        text(s.holderId) &&
        timestamp(s.startedAt) &&
        timestamp(s.expectedEnd) &&
        s.expectedEnd > s.startedAt &&
        typeof s.openToShare === "boolean" &&
        (s.occupantCount === undefined ||
          (Number.isInteger(s.occupantCount) && Number(s.occupantCount) >= 0)),
    ) &&
    memberships.every(
      (m) =>
        record(m) &&
        text(m.sessionId) &&
        text(m.userId) &&
        timestamp(m.joinedAt),
    ) &&
    observations.every(
      (o) =>
        record(o) &&
        text(o.roomId) &&
        ["free", "unknown"].includes(String(o.status)) &&
        timestamp(o.updatedAt),
    )
  );
}
