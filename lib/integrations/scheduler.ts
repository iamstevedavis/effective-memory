export type SchedulePayload = {
  draftPostId: number;
  businessId: number;
  quoteText: string;
  captionText: string;
  imagePath: string | null;
  scheduledFor: string;
};

export interface SchedulerAdapter {
  schedulePost(payload: SchedulePayload): Promise<{ externalId?: string; status: "scheduled" }>;
}

export class StubSchedulerAdapter implements SchedulerAdapter {
  async schedulePost(payload: SchedulePayload): Promise<{ externalId?: string; status: "scheduled" }> {
    // Structured logging for MVP observability without external integration.
    console.log(
      JSON.stringify({
        event: "scheduler.stub.schedule_post",
        payload
      })
    );

    return { status: "scheduled", externalId: `stub-${payload.draftPostId}` };
  }
}

export function getSchedulerAdapter(): SchedulerAdapter {
  return new StubSchedulerAdapter();
}
