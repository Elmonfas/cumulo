import type { Metadata } from "next";
import { OperationsCalendar } from "@/components/calendar/operations-calendar";

export const metadata: Metadata = { title: "Calendario" };

export default function CalendarPage() {
  return <OperationsCalendar />;
}
