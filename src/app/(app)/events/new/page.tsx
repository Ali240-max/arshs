"use client";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EventForm } from "@/components/forms/event-form";

export default function NewEventPage() {
  const router = useRouter();
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="New event" description="Pick the type first. It decides what the event page tracks: vendors, a budget, or a collection target." />
      <Card className="p-6">
        <EventForm onDone={(id) => router.push(`/events/${id}`)} onCancel={() => router.push("/events")} />
      </Card>
    </div>
  );
}
