import type { Metadata } from "next";
import { StudyApp } from "@/components/study/StudyApp";

export const metadata: Metadata = {
  title: "My bookings · Roomly",
  description:
    "Your upcoming room reservations on campus — view and cancel the slots you have booked.",
};

export default function BookingsPage() {
  return <StudyApp bookings />;
}
