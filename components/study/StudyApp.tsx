"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { rooms, floors, users, buildings } from "@/data/catalog";
import { repository } from "@/services/repository";
import { viewRoom, type Command } from "@/services/domain";
import { roomPath } from "@/services/routes";
import type { Status } from "@/types/domain";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { DiscoverRooms } from "./DiscoverRooms";
import { Header } from "./Header";
import { AppearanceSettings } from "./AppearanceSettings";
import { useAppTheme } from "./AppTheme";
import { RoomDetails } from "./RoomDetails";
import {
  sessionStore,
  switchDemoUser,
  toggleDemoWatch,
} from "@/services/session-store";
import { getSupabase, sharedMode } from "@/services/supabase-client";
import { SupabaseRepository } from "@/services/supabase-repository";
import { SignIn } from "./SignIn";
import { registerRoomTools } from "@/services/webmcp";

export function StudyApp({ roomId }: { roomId?: string }) {
  const { theme } = useAppTheme();
  const state = useSyncExternalStore(
    repository.subscribe,
    repository.getSnapshot,
    repository.getSnapshot,
  );
  const {
    ready,
    now,
    userId,
    accessGranted,
    watches,
    notices,
    error,
  } = useSyncExternalStore(
    sessionStore.subscribe,
    sessionStore.getSnapshot,
    sessionStore.getServerSnapshot,
  );

  const [floor, setFloor] = useState("all");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<Status | "all">("free");
  const [capacity, setCapacity] = useState("all");
  const [type, setType] = useState("all");
  const [authOpen, setAuthOpen] = useState(false);
  const [panel, setPanel] = useState<
    "help" | "notifications" | "appearance" | null
  >(null);

  useEffect(() => repository.start(), []);
  useEffect(() => registerRoomTools(repository), []);
  useEffect(() => {
    if (sharedMode && accessGranted) setAuthOpen(false);
  }, [accessGranted]);

  const views = rooms
    .filter((r) => r.enabled)
    .map((r) => viewRoom(state, r, now));

  const canInteract = !sharedMode || accessGranted;

  const switchUser = (id: string) => {
    switchDemoUser(id);
    toast(`Demo session: ${users.find((u) => u.id === id)?.displayName}`);
  };

  const requireAuth = () => {
    if (canInteract) return true;
    setAuthOpen(true);
    return false;
  };

  const submit = async (command: Command) => {
    if (!requireAuth()) return false;
    try {
      await repository.dispatch(command);
      toast.success(
        {
          checkIn: "You’re checked in.",
          join: "You’ve joined the room.",
          leave: "You’ve left the room.",
          update: "Session updated.",
        }[command.type],
      );
      return true;
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to update the room.",
      );
      return false;
    }
  };

  const watching = (id: string) => watches.includes(id);

  const toggleWatch = async (id: string) => {
    if (!requireAuth()) return;
    try {
      if (repository instanceof SupabaseRepository)
        await repository.watch(id, !watching(id));
      else toggleDemoWatch(id);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Unable to update notification.",
      );
    }
  };

  const currentRoom = views.find(
    (v) =>
      v.session &&
      state.memberships.some(
        (m) => m.sessionId === v.session!.id && m.userId === userId,
      ),
  );

  const selected = roomId
    ? views.find((v) => v.room.id === roomId)
    : undefined;

  const filtered = views.filter((v) => {
    const f = floors.find((f) => f.id === v.room.floorId)!;
    const b = buildings.find((b) => b.id === f.buildingId)!;
    const text =
      `${v.room.name} ${v.room.number} ${v.room.type} ${f.name} ${b.name}`.toLowerCase();
    return (
      (floor === "all" || v.room.floorId === floor) &&
      (status === "all" || v.status === status) &&
      (capacity === "all" || v.room.capacity >= Number(capacity)) &&
      (type === "all" || v.room.type === type) &&
      text.includes(query.trim().toLowerCase())
    );
  });

  const reset = () => {
    setQuery("");
    setFloor("all");
    setStatus("all");
    setCapacity("all");
    setType("all");
  };

  return (
    <div className="app-shell">
      <Toaster position="bottom-right" theme={theme} />
      <Header
        userId={userId}
        accessGranted={accessGranted}
        onUser={switchUser}
        onPanel={setPanel}
        hasNotices={notices.length > 0}
        shared={sharedMode}
        onSignIn={() => setAuthOpen(true)}
        onSignOut={async () => {
          await getSupabase().auth.signOut();
        }}
      />

      <main className="workspace">
        {!ready ? (
          <div className="loading-state" role="status">
            Loading study spaces…
          </div>
        ) : error ? (
          <section className="empty-state" role="alert">
            <h1>Unable to load rooms</h1>
            <p>{error}</p>
            <button
              className="primary-button"
              onClick={() => window.location.reload()}
            >
              Try again
            </button>
            {sharedMode && userId && (
              <button
                className="secondary-button"
                onClick={() => getSupabase().auth.signOut()}
              >
                Sign out
              </button>
            )}
          </section>
        ) : roomId ? (
          selected ? (
            <RoomDetails
              key={`${selected.room.id}-${userId}-${accessGranted}`}
              now={now}
              shared={sharedMode}
              canInteract={canInteract}
              onRequireAuth={() => setAuthOpen(true)}
              view={selected}
              state={state}
              userId={userId}
              onSubmit={submit}
              watching={watching(selected.room.id)}
              onWatch={() => toggleWatch(selected.room.id)}
            />
          ) : (
            <div className="empty-state">
              <h1>Room not found</h1>
              <p>This room may have moved or is no longer listed.</p>
              <Link href="/" className="primary-button">
                Browse rooms
              </Link>
            </div>
          )
        ) : (
          <>
            {currentRoom && (
              <Link
                href={roomPath(currentRoom.room)}
                className="active-session"
              >
                <span>
                  <strong>
                    Your session: {currentRoom.room.name} ·{" "}
                    {currentRoom.room.number}
                  </strong>
                  <span>
                    {currentRoom.session!.expectedEnd - now < 300000
                      ? "Ending soon — extend or leave."
                      : "You are currently checked in."}
                  </span>
                </span>
                <span>Manage session →</span>
              </Link>
            )}
            <DiscoverRooms
              views={filtered}
              query={query}
              onQuery={setQuery}
              status={status}
              onStatus={setStatus}
              floor={floor}
              onFloor={setFloor}
              capacity={capacity}
              onCapacity={setCapacity}
              type={type}
              onType={setType}
              onReset={reset}
            />
          </>
        )}

        <footer>
          <span>Roomly · Room Finder</span>
          <span>Student prototype · Demonstration data</span>
        </footer>
      </main>

      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) setPanel(null);
        }}
      >
        <DialogContent
          className={`study-modal ${panel === "appearance" ? "appearance-modal" : ""}`}
        >
          <DialogHeader>
            <DialogTitle>
              {panel === "appearance"
                ? "Appearance"
                : panel === "help"
                  ? "A study space, without the guesswork."
                  : "Availability notifications"}
            </DialogTitle>
            <DialogDescription>
              {panel === "appearance"
                ? "Make this space feel like yours."
                : panel === "help"
                  ? "A student-built prototype for finding and sharing campus study spaces."
                  : sharedMode
                    ? "Your availability alerts, synchronized with your account."
                    : "In-app alerts for your current demo student while this app is open."}
            </DialogDescription>
          </DialogHeader>

          {panel === "appearance" ? (
            <AppearanceSettings />
          ) : panel === "help" ? (
            <div className="help-content">
              <p>
                <strong>1. Find a room.</strong> Search by name, number,
                building or floor. Filter by availability, capacity or room
                type.
              </p>
              <p>
                <strong>2. Check in when you arrive.</strong> Choose how long
                you plan to stay and whether others may join.
              </p>
              <p>
                <strong>3. Leave when you’re done.</strong> The next participant
                becomes holder if others remain. The last person leaving marks
                the room Free.
              </p>
              <p>
                <strong>Unknown means unconfirmed.</strong> Sessions expire at
                their end time. Free reports become Unknown after 30 minutes.
              </p>
              <div className="demo-explainer">
                <strong>
                  {sharedMode
                    ? "Public browsing, verified room actions"
                    : "Try it with three demo students"}
                </strong>
                <p>
                  {sharedMode
                    ? "Anyone can browse room availability. Check-ins, joining and alerts require passwordless email verification and campus access. Student identities are never shown in public room data."
                    : "Switch Student A, B and C in the top bar. Changes persist locally across tabs. Other devices do not share these demo sessions."}
                </p>
              </div>
            </div>
          ) : sharedMode && !accessGranted ? (
            <div className="notification-list">
              <p>
                Sign in and confirm campus access to watch rooms and receive
                in-app availability alerts.
              </p>
              <button
                className="primary-button"
                onClick={() => {
                  setPanel(null);
                  setAuthOpen(true);
                }}
              >
                Sign in
              </button>
            </div>
          ) : (
            <div className="notification-list">
              {notices
                .filter((n) => rooms.some((r) => r.id === n.roomId))
                .map((n) => (
                  <Link
                    key={n.id}
                    href={roomPath(rooms.find((r) => r.id === n.roomId)!)}
                    onClick={() => setPanel(null)}
                    className="notification-item"
                  >
                    {n.text}
                  </Link>
                ))}
              <h3>Watching</h3>
              {rooms
                .filter((r) => watching(r.id))
                .map((r) => (
                  <div className="watch-row" key={r.id}>
                    <span>
                      {r.name} · {r.number}
                    </span>
                    <button
                      aria-label={`Stop watching ${r.name}`}
                      onClick={() => toggleWatch(r.id)}
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              {!rooms.some((r) => watching(r.id)) && (
                <p>
                  No rooms watched yet. Open an occupied or unconfirmed room and
                  choose “Notify me when free”.
                </p>
              )}
              <p className="small-note">
                {sharedMode
                  ? "Alerts are saved to your account for 30 days. These are in-app alerts, not push notifications."
                  : "Alerts describe demo activity in this browser. No push notifications or email."}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={authOpen} onOpenChange={setAuthOpen}>
        <DialogContent className="study-modal">
          <DialogHeader>
            <DialogTitle>
              {userId && !accessGranted
                ? "Confirm campus access"
                : "Sign in to Roomly"}
            </DialogTitle>
            <DialogDescription>
              Browse rooms without an account. Sign in only when you want to
              check in, join a room or create an availability alert.
            </DialogDescription>
          </DialogHeader>
          <SignIn
            hasSession={Boolean(userId)}
            onComplete={async () => {
              if (repository instanceof SupabaseRepository)
                await repository.refresh();
              setAuthOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
