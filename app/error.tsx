"use client";
import Link from "next/link";
export default function ErrorPage({
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="empty-state" role="alert">
      <h1>Something went wrong</h1>
      <p>Please try again. Reloading does not change your room session.</p>
      <button className="primary-button" onClick={reset}>
        Try again
      </button>
      <Link href="/">Browse rooms</Link>
    </main>
  );
}
