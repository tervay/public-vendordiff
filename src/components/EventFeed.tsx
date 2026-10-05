"use client";

import { useState } from "react";
import type { EventType } from "@/db/schema";
import { eventLabels } from "@/lib/format";
import type { FeedEvent } from "@/lib/queries";
import { chipClass, EventList, feedFilters } from "./events";

export function EventFeed({ events, showVendor }: { events: FeedEvent[]; showVendor: boolean }) {
  const [type, setType] = useState<EventType | null>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {feedFilters.map((filter) => (
          <button key={filter ?? "all"} type="button" onClick={() => setType(filter)} className={chipClass(filter === type)}>
            {filter ? eventLabels[filter] : "All"}
          </button>
        ))}
      </div>
      <EventList events={type ? events.filter((e) => e.type === type) : events} showVendor={showVendor} />
    </div>
  );
}
