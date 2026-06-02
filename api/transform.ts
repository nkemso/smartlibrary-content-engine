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

Mission: Transform uploaded courses, files, videos, transcripts, manuals, and knowledge assets into clear, actionable intelligence.

Product behavior:
Course creators upload course assets, files, videos, audio, manuals, links, and transcripts. Convert them into modules, lessons, exercises, assignments, quizzes, interactive checkpoints, tier-gated content plans, drip schedules, and gamified learning paths.

RAG rules:
Always use retrieved content as the primary source of truth.
Never give generic answers when relevant content exists.
Cite source titles when helpful.
Never claim inability to access uploaded content when retrieved context is provided.

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
    const action = safeString(req.body?.action || "Structure Course");
    const question = safeString(req.body?.question || action);
    const sources = Array.isArray(req.body?.sources) ? (req.body.sources as Source[]).slice(0, 8) : [];

    if (!sources.length) {
      return res.status(200).json({ output: fallbackOutput(action, question, sources), provider: "fallback" });
    }

    const prompt = buildPrompt(action, question, sources);
    const provider = (process.env.SMARTLIBRARY_AI_PROVIDER || "auto").toLowerCase();

    if ((provider === "auto" || provider === "groq") && process.env.GROQ_API_KEY) {
      const output = await callOpenAICompatible({
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey: process.env.GROQ_API_KEY,
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        prompt,
        extraHeaders: {},
      });
      if (output) return res.status(200).json({ output, provider: "groq" });
    }

    if ((provider === "auto" || provider === "openrouter") && process.env.OPENROUTER_API_KEY) {
      const output = await callOpenAICompatible({
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey: process.env.OPENROUTER_API_KEY,
        model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3.1-8b-instruct:free",
        prompt,
        extraHeaders: {
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "https://smartlibrary-content-engine.vercel.app",
          "X-Title": "SmartLibrary Content Engine",
        },
      });
      if (output) return res.status(200).json({ output, provider: "openrouter" });
    }

    if ((provider === "auto" || provider === "openai") && process.env.OPENAI_API_KEY) {
      const output = await callOpenAICompatible({
        url: "https://api.openai.com/v1/chat/completions",
        apiKey: process.env.OPENAI_API_KEY,
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        prompt,
        extraHeaders: {},
      });
      if (output) return res.status(200).json({ output, provider: "openai" });
    }

    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if ((provider === "auto" || provider === "gemini") && geminiKey) {
      try {
        const { GoogleGenerativeAI } = await import("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(geminiKey);
        const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-1.5-flash" });
        const result = await model.generateContent(`${systemPrompt}\n\n${prompt}`);
        const output = normalizeOutput(result.response.text().trim());
        if (output) return res.status(200).json({ output, provider: "gemini" });
      } catch {
        // fall through
      }
    }

    return res.status(200).json({ output: fallbackOutput(action, question, sources), provider: "fallback" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown transform error";
    return res.status(500).json({ error: message });
  }
}

async function callOpenAICompatible({
  url,
  apiKey,
  model,
  prompt,
  extraHeaders,
}: {
  url: string;
  apiKey: string;
  model: string;
  prompt: string;
  extraHeaders: Record<string, string>;
}) {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.35,
        max_tokens: 1800,
      }),
    });

    if (!response.ok) return "";
    const data = await response.json();
    return normalizeOutput(data?.choices?.[0]?.message?.content || "");
  } catch {
    return "";
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

Create a finished, practical, grounded output. If this is course material, structure it into modules, lessons, exercises, assignments, quizzes, drip logic, tier access, and interactive/gamified checkpoints where relevant. Use retrieved content first. Include source titles naturally when helpful.`;
}

function fallbackOutput(action: string, question: string, sources: Source[]) {
  const sourceTitles = sources.map((source, index) => `${index + 1}. ${source.title || "Untitled Source"}`).join("\n");
  const combined = sources.map((source) => source.excerpt || "").join(" ").replace(/\s+/g, " ").trim();
  const sentences = (combined.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 35);
  const keyPoints = extractKeyPhrases(combined, 4);

  if (/course|module|lesson|quiz|assignment|interactive|structure/i.test(`${action} ${question}`)) {
    return `Summary:
This course structure is grounded in the retrieved SmartLibrary sources. It turns uploaded assets into a sequenced learning product with modules, lessons, practice, assessment, drip logic, and gamified completion.

Key Points:
1. ${keyPoints[0] || "The uploaded material should become a guided learning pathway, not a static content dump."}
2. ${keyPoints[1] || "Each module should include lessons, exercises, assignments, and a completion checkpoint."}
3. ${keyPoints[2] || "Tier access and drip rules should control when learners unlock premium content."}

Insights:
Creators get more value when raw files and videos become structured learning journeys. Learners are more likely to finish when every lesson includes a clear objective, a micro-action, a quiz or assignment, and visible progress.

Actionable Output:
Course Blueprint:
1. Module 1: Foundation
   Lesson: Introduce the topic and learning outcome.
   Exercise: Identify the learner's starting point.
   Quiz: 5 baseline questions.

2. Module 2: Core Teaching
   Lesson: Teach the most important ideas from the uploaded source.
   Exercise: Apply the idea to a realistic example.
   Assignment: Submit a short implementation note.

3. Module 3: Practice and Feedback
   Lesson: Walk through common use cases, mistakes, and decisions.
   Interactive Activity: Scenario-based choice with immediate feedback.
   Unlock Rule: Complete assignment or pass quiz.

4. Module 4: Completion and Reuse
   Lesson: Summarize the system and next steps.
   Final Assignment: Create a real-world output from the course.
   Gamification: Award XP, badge, streak credit, and unlock the next tier.

Sources Used:
${sourceTitles || "No source titles available"}`;
  }

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
