const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Whop-User-Token",
};

export default async function handler(req: any, res: any) {
  for (const [key, value] of Object.entries(corsHeaders)) res.setHeader(key, value);
  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      name: "SmartLibrary SaaS Learning Platform",
      roles: ["owner", "admin", "instructor", "moderator", "student"],
      capabilities: [
        "course_builder",
        "modules_lessons_resources",
        "smart_drip",
        "learning_paths",
        "audio_to_course",
        "ai_tutor",
        "quizzes",
        "assignments",
        "certificates",
        "community",
        "analytics",
        "webhooks",
      ],
    });
  }

  if (req.method === "POST") {
    const assetType = String(req.body?.assetType || "course");
    const tier = String(req.body?.tier || "Premium");
    const drip = String(req.body?.drip || "Available immediately");
    return res.status(200).json({
      course: {
        title: `${assetType.charAt(0).toUpperCase()}${assetType.slice(1)} Learning Path`,
        tier,
        drip,
        modules: [
          { title: "Foundation", lessons: ["Orientation", "Core promise", "Baseline quiz"] },
          { title: "Core Training", lessons: ["Main concept", "Guided example", "Practice exercise"] },
          { title: "Implementation", lessons: ["Assignment", "Feedback", "Unlock next step"] },
          { title: "Completion", lessons: ["Final quiz", "Certificate", "Next path recommendation"] },
        ],
      },
    });
  }

  return res.status(405).json({ error: "Method not allowed" });
}
