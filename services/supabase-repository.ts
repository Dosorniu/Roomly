import type { RoomRepository } from "./repository";
import type { StudyState } from "../types/domain";
import type { Command } from "./domain";
import { rooms } from "../data/catalog";
import { getSupabase } from "./supabase-client";
import { sessionStore } from "./session-store";
import { isStudyState } from "./state-validation";
import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

const empty: StudyState = {
  sessions: [],
  memberships: [],
  observations: [],
  revision: 0,
};

export class SupabaseRepository implements RoomRepository {
  private state = empty;
  private listeners = new Set<() => void>();
  private generation = 0;
  private queue: Promise<void> = Promise.resolve();
  private refreshing = false;
  private refreshAgain = false;
  private active = false;

  getSnapshot = () => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  private applyPublicSnapshot(data: unknown, userId: string) {
    const payload = data as { state?: unknown; now?: unknown } | null;
    if (
      !payload ||
      !isStudyState(payload.state) ||
      typeof payload.now !== "number" ||
      !Number.isFinite(payload.now)
    )
      throw Error("Invalid public server response.");

    this.state = payload.state;
    sessionStore.set({
      ready: true,
      now: payload.now,
      userId,
      accessGranted: false,
      watches: [],
      notices: [],
      error: null,
    });
    this.notify();
  }

  private async loadPublic(
    client: SupabaseClient,
    generation: number,
    userId = "",
  ) {
    const { data, error } = await client.rpc("roomly_public_snapshot");
    if (generation !== this.generation) return;
    if (error) throw error;
    this.applyPublicSnapshot(data, userId);
  }

  refresh = () => {
    if (!this.active) return Promise.resolve();
    if (this.refreshing) {
      this.refreshAgain = true;
      return this.queue;
    }
    this.refreshing = true;
    const generation = this.generation;

    const run = async () => {
      if (generation !== this.generation) return;
      try {
        const client = getSupabase();
        const { data: auth, error: authError } = await client.auth.getSession();
        if (generation !== this.generation) return;
        if (authError) throw authError;

        if (!auth.session) {
          await this.loadPublic(client, generation);
          return;
        }

        const userId = auth.session.user.id;
        const { data: access, error: accessError } = await client.rpc(
          "roomly_access_status",
        );
        if (generation !== this.generation) return;
        if (accessError) throw accessError;

        if (access !== true) {
          await this.loadPublic(client, generation, userId);
          return;
        }

        const { data, error } = await client.rpc("roomly_snapshot");
        if (generation !== this.generation) return;
        if (error) throw error;
        if (
          !isStudyState(data?.state) ||
          typeof data.userId !== "string" ||
          !Number.isFinite(data.now) ||
          !Array.isArray(data.watches) ||
          !data.watches.every((id: unknown) => typeof id === "string") ||
          !Array.isArray(data.notices) ||
          !data.notices.every(
            (n: { id?: unknown; roomId?: unknown }) =>
              n && typeof n.id === "string" && typeof n.roomId === "string",
          )
        )
          throw Error("Invalid server response.");

        this.state = data.state as StudyState;
        sessionStore.set({
          ready: true,
          now: data.now,
          userId: data.userId,
          accessGranted: true,
          watches: data.watches,
          error: null,
          notices: data.notices.map((n: { id: string; roomId: string }) => ({
            ...n,
            text: `${rooms.find((r) => r.id === n.roomId)?.name || "Room"} is now free.`,
          })),
        });
        this.notify();
      } catch (error) {
        if (generation !== this.generation) return;
        // Never continue to present stale data as live after an auth/network error.
        this.state = empty;
        this.notify();
        sessionStore.set({
          ready: true,
          accessGranted: false,
          error:
            error instanceof Error
              ? error.message
              : (error as { message?: string })?.message ||
                "Unable to connect to Roomly.",
        });
      }
    };

    this.queue = this.queue.then(run, run).finally(() => {
      this.refreshing = false;
      if (this.refreshAgain && this.active) {
        this.refreshAgain = false;
        void this.refresh();
      }
    });
    return this.queue;
  };

  dispatch = async (command: Command) => {
    if (!sessionStore.getSnapshot().accessGranted)
      throw new Error("Sign in and confirm campus access to use this room.");

    const client = getSupabase();
    // The database derives the actor from the verified JWT, never command.userId.
    const { error } = await client.rpc("roomly_command", {
      action: command.type,
      room_id: command.roomId,
      minutes: "minutes" in command ? command.minutes : null,
      share: "openToShare" in command ? command.openToShare : null,
      confirmed_empty:
        command.type === "checkIn" && command.confirmedEmpty === true,
    });
    await this.refresh();
    if (error) throw new Error(error.message);
  };

  watch = async (roomId: string, watching: boolean) => {
    if (!sessionStore.getSnapshot().accessGranted)
      throw new Error("Sign in and confirm campus access to watch rooms.");

    const { error } = await getSupabase().rpc("roomly_watch", {
      room_id: roomId,
      watching,
    });
    if (error) throw new Error(error.message);
    await this.refresh();
  };

  start = () => {
    this.active = true;
    this.generation++;
    sessionStore.set({
      ready: false,
      userId: "",
      accessGranted: false,
      error: null,
      notices: [],
      watches: [],
    });

    try {
      const client = getSupabase();
      let channel: RealtimeChannel | undefined = client
        .channel("roomly-status")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "roomly_revision" },
          () => {
            void this.refresh();
          },
        )
        .subscribe();
      let subscribedUser = "";

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((_event, session) => {
        const nextUser = session?.user.id || "";
        if (nextUser !== subscribedUser) {
          this.generation++;
          subscribedUser = nextUser;
          this.state = empty;
          this.notify();
          sessionStore.set({
            userId: nextUser,
            accessGranted: false,
            watches: [],
            notices: [],
            ready: false,
            error: null,
          });
        }
        void this.refresh();
      });

      const timer = setInterval(() => {
        void this.refresh();
      }, 5000);
      const focus = () => {
        void this.refresh();
      };
      window.addEventListener("focus", focus);
      void this.refresh();

      return () => {
        this.active = false;
        this.refreshAgain = false;
        this.generation++;
        clearInterval(timer);
        subscription.unsubscribe();
        if (channel) {
          void client.removeChannel(channel);
          channel = undefined;
        }
        window.removeEventListener("focus", focus);
      };
    } catch (error) {
      sessionStore.set({
        ready: true,
        accessGranted: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to initialize Supabase.",
      });
      return () => {
        this.active = false;
        this.generation++;
      };
    }
  };
}
