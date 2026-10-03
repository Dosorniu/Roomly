import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = {
  title: "Privacy policy · Roomly",
  description:
    "What Roomly collects, why, and the choices you have. Student prototype.",
};

export default function PrivacyPage() {
  return (
    <main className="workspace">
      <article className="legal">
        <Link href="/" className="back-link">
          <ArrowLeft size={17} /> Back
        </Link>
        <h1>Privacy policy</h1>
        <p className="legal-updated">
          Last updated 4 October 2026 · Roomly, CBS International Business School
        </p>
        <p>
          Roomly helps students find and share study rooms on campus. This
          policy explains what we collect, why, and the choices you have. We
          keep it short because we keep the data small.
        </p>

        <h2>What we collect</h2>
        <ul>
          <li>
            <strong>Your email address</strong> — only to verify that you are a
            CBS student and to send a one-time sign-in code. We never ask for a
            password.
          </li>
          <li>
            <strong>Room activity</strong> — when you check in, join, leave or
            book a slot, we store which room and the time, linked to your
            account.
          </li>
          <li>
            <strong>Preferences</strong> — your chosen theme and watched rooms
            are stored in your browser, not on our servers.
          </li>
        </ul>

        <h2>Who can see your name</h2>
        <p>
          <strong>Without signing in</strong>, anyone sees only a room&rsquo;s{" "}
          <strong>status</strong> and <strong>how many people</strong> are in it —
          never names or email addresses.
        </p>
        <p>
          <strong>Signed-in CBS students</strong> also see who booked each upcoming
          slot and who is currently in a room that is open to sharing, shown as a
          short display name such as &ldquo;A.&nbsp;Koch&rdquo; so you can tell who
          you would be sharing a room with. Rooms that are not open to sharing still
          show only an occupant count. Your <strong>email address is never shown to
          anyone</strong>, and names appear only to verified campus accounts — never
          in the public view.
        </p>

        <h2>How we use it</h2>
        <ul>
          <li>To show live and upcoming room availability.</li>
          <li>
            To enforce one active session per person and prevent double-booking.
          </li>
          <li>To send availability alerts you asked for, inside the app.</li>
        </ul>

        <h2>What we never do</h2>
        <ul>
          <li>No advertising, no selling data, no tracking across other sites.</li>
          <li>
            No sharing your email or activity with third parties outside the
            university&rsquo;s own systems.
          </li>
        </ul>

        <h2>Keeping and deleting data</h2>
        <p>
          Expired sessions and old notifications are removed automatically. You
          can ask us to delete your account and activity at any time, and a
          campus administrator can revoke your access. Email verification is
          handled by our authentication provider; sign-in codes are single-use
          and expire after 15 minutes.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about your data? Write to{" "}
          <strong>privacy@roomly.cbs-mail.de</strong>. You can also reach the CBS
          data protection officer through the university&rsquo;s main channels.
        </p>

        <p className="small-note">
          This is a student prototype. Figures and records shown in the app are
          demonstration data.
        </p>
      </article>
    </main>
  );
}
