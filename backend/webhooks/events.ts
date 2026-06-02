export const webhookEvents = [
  'audio_uploaded',
  'transcript_processed',
  'course_created',
  'lesson_completed',
  'quiz_passed',
  'assignment_submitted',
  'certificate_issued',
] as const;

export type WebhookEvent = (typeof webhookEvents)[number];

export function buildWebhookPayload(event: WebhookEvent, data: Record<string, unknown>) {
  return {
    event,
    timestamp: new Date().toISOString(),
    ...data,
  };
}
