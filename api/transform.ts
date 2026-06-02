const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Whop-User-Token",
};

type Source = {
  id?: string;
  title?: string;
  excerpt?: string;
  score?: number;
};

const systemPrompt = `You are the AI engine powering SmartLibrary Content Engine, a premium AI-powered knowledge transformation system.

Mission: Transform uploaded content into clear, actionable intelligence. Deliver value quickly.

RAG rules:
Always use retrieved content as the primary source of truth.
Never give generic answers when relevant content exists.
Cite source titles when helpful.
Strictly avoid claiming inability to access uploaded content when retrieved context is provided.

Output standard:
Use clean plain text only.
No markdown artifacts.
No JSON.
No code blocks unless specifically requested.
No filler.
No vague advice.
Every response must feel like finished work.

Structure every response exactly with these section labels:
Summary:
Key Points:
Insights:
Actionable Output:

Optimize for copy, share, export, WhatsApp, Notes, Word, Docs, Email, social platforms, and community platforms.`;

export default async function handler(req: any, res: any) {
  for (const [key, value] of Object.entries(corsHeaders)) res.setHeader(key, value);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const action = safeString(req.body?.action || "Summarize");
    const question = safeString(req.body?.question || action);
    const sources = Array.isArray(req.body?.sources) ? (req.body.sources as Source[]).slice(0, 6) : [];

    if (!sources.length) {
      return res.status(200).json({ output: fallbackOutput(action, question, sources) });
    }

    const prompt = buildPrompt(action, question, sources);
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({ output: fallbackOutput(action, question, sources) });
    }

    try {
      const { GoogleGenerativeAI } = await import("@google/generative-ai");
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
      const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
      const output = result.response.text().trim();
      return res.status(200).json({ output: normalizeOutput(output) || fallbackOutput(action, question, sources) });
    } catch {
      return res.status(200).json({ output: fallbackOutput(action, question, sources) });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown transform error";
    return res.status(500).json({ error: message });
  }
}

function buildPrompt(action: string, question: string, sources: Source[]) {
  const context = sources
    .map((source, index) => `Source ${index + 1}: ${source.title || "Untitled"}\n${source.excerpt || ""}`)
    .join("\n\n");

  return `User requested action: ${action}
User request: ${question}

Retrieved SmartLibrary content:
${context}

Create a finished, practical, grounded output. Use the retrieved content first. If you infer anything, keep it clearly tied to the source context. Include source titles naturally when helpful.`;
}

function fallbackOutput(action: string, question: string, sources: Source[]) {
  const sourceTitles = sources.map((source, index) => `${index + 1}. ${source.title || "Untitled Source"}`).join("\n");
  const combined = sources.map((source) => source.excerpt || "").join(" ").replace(/\s+/g, " ").trim();
  const sentences = (combined.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 35);
  const keyPoints = extractKeyPhrases(combined, 4);

  return `Summary:
${sentences.slice(0, 2).join(" ") || `This output is grounded in the retrieved SmartLibrary sources for: ${question}.`}

Key Points:
1. ${keyPoints[0] || "The uploaded content contains reusable knowledge that can be transformed into practical outputs."}
2. ${keyPoints[1] || "The strongest answers should come from the user's own library before general AI knowledge."}
3. ${keyPoints[2] || "The content can be reused for summaries, training, lessons, action plans, SOPs, reports, or posts."}

Insights:
${sentences[2] || "The main opportunity is to convert raw information into a format that supports faster decisions, clearer teaching, and easier reuse."}

Actionable Output:
Recommended output for ${action}:
1. Review the key points above.
2. Convert the strongest idea into one reusable asset: a lesson, checklist, SOP, post, email, or action plan.
3. Ask a follow-up question to adapt this for a specific audience, platform, or goal.

Sources Used:
${sourceTitles || "No source titles available"}`;
}

function extractKeyPhrases(text: string, count: number) {
  const stop = new Set(["the", "and", "for", "with", "that", "this", "from", "are", "was", "were", "your", "have", "has", "about", "into", "their", "will", "can", "should"]);
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 3 && !stop.has(word));
  const scores = new Map<string, number>();
  for (const word of words) scores.set(word, (scores.get(word) || 0) + 1);
  return [...scores.entries()].sort((a, b) => b[1] - a[1]).slice(0, count).map(([word]) => `${word.charAt(0).toUpperCase()}${word.slice(1)} is a recurring idea in the retrieved content.`);
}

function normalizeOutput(text: string) {
  return text.replace(/\*\*/g, "").replace(/```/g, "").trim();
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.slice(0, 4000) : "";
}
