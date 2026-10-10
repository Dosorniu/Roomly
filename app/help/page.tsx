import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/study/PageHeader";
import {
  ArrowLeft,
  Search,
  DoorOpen,
  CalendarClock,
  Users,
  Bell,
  ShieldCheck,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Guide · Roomly",
  description:
    "How to find, check into, share and book study rooms on campus. Student prototype.",
};

const sections = [
  {
    icon: Search,
    title: "Find a room",
    body: "Search by name, number, building or floor, and filter by availability, capacity or room type. Each card shows the live status — free, in use, open to sharing, or unconfirmed — and how many people are inside.",
  },
  {
    icon: DoorOpen,
    title: "Check in when you arrive",
    body: "Already in a room? Open it and tap Check in. Choose how long you plan to stay and whether others may join. Checking in is not a reservation — it tells other students the room is in use right now. Your session ends automatically when your time is up, or tap Leave to free it sooner.",
  },
  {
    icon: CalendarClock,
    title: "Book a slot for later",
    body: "On a room page, open Availability. Pick a duration (30 minutes to 2 hours), move between weeks with the arrows, then tap a free start time and confirm. Bookings are possible Monday to Friday, 08:00–20:00. A booking holds the whole room — no one else can check in or book it for that time — unless you switch on “Can others join you?”: then others can check in and sit with you, but no one else can book it. Tap your own slot to cancel.",
  },
  {
    icon: Users,
    title: "Sharing a room",
    body: "When a room holder marks a room open to sharing, other students can join up to the room’s capacity. You see how many people are already there — never who they are.",
  },
  {
    icon: Bell,
    title: "Notifications",
    body: "On an occupied or unconfirmed room, choose “Notify me when free”. When the room frees up you get an in-app alert — these are saved to your account, not push notifications or email. Manage the rooms you watch from the notifications panel.",
  },
  {
    icon: ShieldCheck,
    title: "Your privacy",
    body: "Roomly is anonymous. Everyone sees only a room’s status and headcount; booked slots show as “Booked”. Your name and email are never shown to anyone. See the privacy policy for details.",
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHeader />
      <main className="workspace">
        <article className="legal">
          <Link href="/" className="back-link">
            <ArrowLeft size={17} /> Back
          </Link>
          <h1>How Roomly works</h1>
          <p className="legal-updated">A quick guide to every feature.</p>

          <div className="guide-list">
            {sections.map(({ icon: Icon, title, body }) => (
              <div className="guide-item" key={title}>
                <div className="guide-icon">
                  <Icon size={20} />
                </div>
                <div>
                  <h2>{title}</h2>
                  <p>{body}</p>
                </div>
              </div>
            ))}
          </div>

          <p className="small-note">
            This is a student prototype. Figures and records shown in the app
            are demonstration data.
          </p>
        </article>
      </main>
    </>
  );
}
