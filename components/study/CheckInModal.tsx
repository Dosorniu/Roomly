"use client";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { RoomView } from "@/types/domain";
import type { Command } from "@/services/domain";
export function CheckInModal({
  view,
  userId,
  editing,
  onClose,
  onSubmit,
}: {
  view: RoomView;
  userId: string;
  editing: boolean;
  onClose: () => void;
  onSubmit: (command: Command) => Promise<boolean>;
}) {
  // When updating, start from the time actually left in the session.
  const [initial] = useState(() => {
    if (!editing || !view.session) return { duration: "60", custom: "90" };
    const left = Math.min(
      480,
      Math.max(1, Math.round((view.session.expectedEnd - Date.now()) / 60000)),
    );
    return ["30", "60", "120"].includes(String(left))
      ? { duration: String(left), custom: "90" }
      : { duration: "custom", custom: String(left) };
  });
  const [duration, setDuration] = useState(initial.duration);
  const [custom, setCustom] = useState(initial.custom);
  // Someone else's booking with "Others can join" is running: you may use the
  // room, but your session has to stay open to others.
  const sharedBooking =
    !!view.reservation && !view.reservation.mine && !!view.reservation.share;
  const [choice, setSharing] = useState(view.session?.openToShare ?? true);
  const sharing = sharedBooking || choice;
  const [busy, setBusy] = useState(false);
  const minutes = Number(duration === "custom" ? custom : duration);
  const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 480;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="study-modal">
        <DialogHeader>
          <span className="eyebrow">
            {view.room.name} · {view.room.number}
          </span>
          <DialogTitle>
            {editing ? "Update your session" : "Make yourself at home."}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? "Change your estimated time or sharing preference."
              : "Check in when you are physically in the room. This is not a reservation."}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!valid || busy) return;
            setBusy(true);
            const ok = await onSubmit({
              type: editing ? "update" : "checkIn",
              roomId: view.room.id,
              userId,
              minutes,
              openToShare: sharing,
            });
            setBusy(false);
            if (ok) onClose();
          }}
        >
          <label className="field-label">
            {editing ? "Time remaining from now" : "How long will you stay?"}
          </label>
          <Select value={duration} onValueChange={setDuration}>
            <SelectTrigger
              className="wide-select"
              aria-label="Session duration"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 minutes</SelectItem>
              <SelectItem value="60">1 hour</SelectItem>
              <SelectItem value="120">2 hours</SelectItem>
              <SelectItem value="custom">Custom duration</SelectItem>
            </SelectContent>
          </Select>
          {duration === "custom" && (
            <label className="field-label">
              Minutes (1–480)
              <input
                className="form-input"
                type="number"
                min="1"
                max="480"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                required
              />
            </label>
          )}
          <div className="switch-row">
            <div>
              <label htmlFor="share-choice">Can others join you?</label>
              <p>
                {sharedBooking
                  ? "Yes — this room is booked as shared"
                  : sharing
                    ? "Yes — Open to Share"
                    : "No — Occupied"}
              </p>
            </div>
            <Switch
              id="share-choice"
              checked={sharing}
              disabled={sharedBooking}
              onCheckedChange={setSharing}
            />
          </div>
          <p className="small-note">
            Your session ends automatically at the time you choose, and the room
            shows as Free again.
          </p>
          <button
            className="primary-button full"
            disabled={busy || !valid}
            type="submit"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Confirm Check In"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
