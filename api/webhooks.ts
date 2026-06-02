const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Whop-User-Token, X-SmartLibrary-Signature",
};

const allowedEvents = new Set([
  "audio_uploaded",
  "transcript_processed",
  "course_created",
  "lesson_completed",
  "quiz_passed",
  "assignment_submitted",
  "certificate_issued",
]);

export default async function handler(req: any, res: any) {
  for (const [key, value] of Object.entries(corsHeaders)) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const event = String(req.body?.event || "");
  if (!allowedEvents.has(event)) return res.status(400).json({ error: "Unsupported webhook event" });

  return res.status(200).json({
    received: true,
    event,
    timestamp: new Date().toISOString(),
    automation: nextAutomation(event, req.body || {}),
  });
}

function nextAutomation(event: string, payload: Record<string, unknown>) {
  if (event === "audio_uploaded") return ["transcribe_audio", "generate_course_outline", "notify_instructor"];
  if (event === "transcript_processed") return ["build_modules", "create_lessons", "generate_quiz"];
  if (event === "lesson_completed") return ["update_progress", "award_xp", "evaluate_unlock_rules"];
  if (event === "quiz_passed") return ["unlock_next_lesson", "award_badge", "update_analytics"];
  if (event === "assignment_submitted") return ["notify_instructor", "queue_review", "evaluate_unlock_on_approval"];
  return ["record_event", "update_audit_log"];
}
