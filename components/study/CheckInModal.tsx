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
import { Checkbox } from "@/components/ui/checkbox";
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
  const [duration, setDuration] = useState("60");
  const [custom, setCustom] = useState("90");
  const [sharing, setSharing] = useState(view.session?.openToShare ?? true);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const minutes = Number(duration === "custom" ? custom : duration);
  const valid = Number.isFinite(minutes) && minutes >= 1 && minutes <= 480;
  const unknown = view.status === "unknown";
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
              confirmedEmpty: confirmed,
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
              <p>{sharing ? "Yes — Open to Share" : "No — Occupied"}</p>
            </div>
            <Switch
              id="share-choice"
              checked={sharing}
              onCheckedChange={setSharing}
            />
          </div>
          {unknown && !editing && (
            <label className="confirm-row">
              <Checkbox
                checked={confirmed}
                onCheckedChange={(v) => setConfirmed(v === true)}
              />
              <span>I am here and have checked that the room is empty.</span>
            </label>
          )}
          <p className="small-note">
            Your session expires automatically. Availability then becomes
            Unknown until someone confirms it.
          </p>
          <button
            className="primary-button full"
            disabled={busy || !valid || (unknown && !editing && !confirmed)}
            type="submit"
          >
            {busy ? "Saving…" : editing ? "Save changes" : "Confirm Check In"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
