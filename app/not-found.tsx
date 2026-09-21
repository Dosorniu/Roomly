import Link from "next/link";
export default function NotFound() {
  return (
    <main className="empty-state">
      <h1>Room not found</h1>
      <p>This address does not match an available study space.</p>
      <Link href="/" className="primary-button">
        Browse rooms
      </Link>
    </main>
  );
}
