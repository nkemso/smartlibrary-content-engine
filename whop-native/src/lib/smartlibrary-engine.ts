export type LibraryItem = {
  id: string;
  title: string;
  type: "text" | "link" | "note" | "transcript" | "manual" | "course";
  content: string;
  source?: string;
  createdAt: string;
  wordCount: number;
};

export type RetrievedSource = {
  id: string;
  title: string;
  excerpt: string;
  score: number;
};

export type TransformAction =
  | "Summarize"
  | "Explain Simply"
  | "Extract Key Ideas"
  | "Generate Outline"
  | "Create Content"
  | "Create Lesson"
  | "Suggest Applications"
  | "Generate Action Plan"
  | "Analyze"
  | "Compare"
  | "Brainstorm"
  | "Research"
  | "Expand"
  | "Rewrite";

export const transformActions: TransformAction[] = [
  "Summarize",
  "Explain Simply",
  "Extract Key Ideas",
  "Generate Outline",
  "Create Lesson",
  "Generate Action Plan",
  "Create Content",
  "Analyze",
  "Suggest Applications",
  "Extract Key Ideas",
  "Brainstorm",
  "Rewrite",
];

const stopWords = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "are",
  "was",
  "were",
  "you",
  "your",
  "they",
  "their",
  "have",
  "has",
  "but",
  "not",
  "can",
  "will",
  "would",
  "should",
  "about",
  "into",
  "over",
  "under",
  "then",
  "than",
  "what",
  "when",
  "where",
  "how",
  "why",
]);

export function makeId(prefix = "src") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function cleanText(input: string) {
  return input
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

export function countWords(text: string) {
  return cleanText(text).split(/\s+/).filter(Boolean).length;
}

export function inferTitle(text: string, fallback = "Untitled Source") {
  const cleaned = cleanText(text);
  if (!cleaned) return fallback;
  const firstLine = cleaned.split(/[\n.?!]/)[0]?.trim() || fallback;
  return firstLine.length > 72 ? `${firstLine.slice(0, 69)}...` : firstLine;
}

export function tokenize(text: string) {
  return cleanText(text)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !stopWords.has(token));
}

function chunkText(text: string, maxWords = 95) {
  const words = cleanText(text).split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let index = 0; index < words.length; index += maxWords) {
    chunks.push(words.slice(index, index + maxWords).join(" "));
  }
  return chunks.length ? chunks : [cleanText(text)];
}

export function retrieveRelevantSources(library: LibraryItem[], query: string, limit = 4): RetrievedSource[] {
  const queryTokens = tokenize(query);
  const scored: RetrievedSource[] = [];

  for (const item of library) {
    const itemTokens = tokenize(`${item.title} ${item.content}`);
    const itemTokenSet = new Set(itemTokens);
    let baseScore = 0;

    for (const token of queryTokens) {
      if (itemTokenSet.has(token)) baseScore += 3;
    }

    if (queryTokens.length === 0) baseScore += 1;

    for (const chunk of chunkText(item.content)) {
      const chunkTokens = new Set(tokenize(chunk));
      let score = baseScore;
      for (const token of queryTokens) {
        if (chunkTokens.has(token)) score += 6;
      }
      if (score > 0) {
        scored.push({
          id: item.id,
          title: item.title,
          excerpt: chunk.length > 520 ? `${chunk.slice(0, 517)}...` : chunk,
          score,
        });
      }
    }
  }

  return scored.sort((a, b) => b.score - a.score).slice(0, limit);
}

export function createLocalOutput(action: TransformAction, query: string, sources: RetrievedSource[], library: LibraryItem[]) {
  const hasSources = sources.length > 0;
  const sourceList = sources.map((source, index) => `${index + 1}. ${source.title}`).join("\n");
  const libraryCount = library.length;
  const queryLabel = query.trim() || action;

  if (!hasSources) {
    return `Summary:\nYour SmartLibrary workspace is ready, but no uploaded source closely matches this request yet. Add a document, note, transcript, manual, article, or link to generate grounded intelligence.\n\nKey Points:\n1. Your library currently contains ${libraryCount} source${libraryCount === 1 ? "" : "s"}.\n2. SmartLibrary searches your content before generating answers.\n3. Uploading one strong source is enough to produce a useful first summary, lesson, outline, or action plan.\n\nInsights:\nThe fastest path to value is to add the most important piece of content first: a lesson transcript, article, manual, client note, sermon, training PDF text, or strategy document.\n\nActionable Output:\nNext step: paste or import your first content source, then choose Summarize, Create Lesson, Generate Action Plan, or Ask a Question.`;
  }

  const primary = sources[0] as RetrievedSource;
  const combined = sources.map((source) => source.excerpt).join(" ");
  const sentences = (combined.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 35);
  const topSentences = sentences.slice(0, 4);
  const keyIdeas = extractKeyIdeas(combined, 5);

  if (action === "Create Lesson") {
    return `Summary:\nThis lesson is grounded in ${primary.title}. It turns the source material into a clear learning experience that can be used for coaching, training, courses, or community education.\n\nKey Points:\n1. Core topic: ${queryLabel}.\n2. Primary source: ${primary.title}.\n3. Main learning focus: ${keyIdeas[0] || "understanding and applying the uploaded content"}.\n\nInsights:\nThe material is most useful when converted from raw information into a guided sequence: concept, explanation, example, practice, and application. This helps learners move from passive reading to usable understanding.\n\nActionable Output:\nLesson Title: ${queryLabel}\n\nLearning Objective:\nBy the end of this lesson, the learner should be able to explain the main idea, identify practical implications, and apply the concept in a real situation.\n\nLesson Flow:\n1. Opening Context: Introduce why this topic matters.\n2. Core Explanation: ${topSentences[0] || primary.excerpt}\n3. Key Ideas: ${keyIdeas.slice(0, 3).join("; ")}.\n4. Practical Exercise: Ask learners to identify one situation where this idea applies.\n5. Reflection Question: What should change in your thinking, workflow, or decision-making because of this lesson?\n\nSources Used:\n${sourceList}`;
  }

  if (action === "Generate Action Plan") {
    return `Summary:\nThe retrieved content points to a practical execution path for: ${queryLabel}.\n\nKey Points:\n1. Start with the highest-impact idea from ${primary.title}.\n2. Convert the insight into a measurable next step.\n3. Review progress and refine based on results.\n\nInsights:\nThe opportunity is not just to understand the material, but to turn it into repeatable action. The strongest pattern from the source is: ${keyIdeas[0] || "extract, prioritize, execute, and review"}.\n\nActionable Output:\nAction Plan:\n1. Clarify the goal: Define the outcome you want from this material.\n2. Extract the essentials: Use these ideas: ${keyIdeas.slice(0, 3).join("; ")}.\n3. Choose one immediate action: Apply the most relevant idea within 24 hours.\n4. Create a reusable asset: Turn the content into a checklist, SOP, lesson, post, or training note.\n5. Review results: Capture what worked, what was unclear, and what should be improved.\n\nSources Used:\n${sourceList}`;
  }

  if (action === "Generate Outline") {
    return `Summary:\nHere is a structured outline based on the most relevant uploaded material for: ${queryLabel}.\n\nKey Points:\n1. The outline is grounded in ${primary.title}.\n2. It organizes the material from context to application.\n3. It can become a lesson, article, workshop, report, or course module.\n\nInsights:\nThe content is strongest when presented as a progression: problem, concept, explanation, implications, and next steps.\n\nActionable Output:\nOutline:\n1. Introduction\n   Purpose and why this topic matters.\n2. Background\n   ${topSentences[0] || primary.excerpt}\n3. Main Ideas\n   a. ${keyIdeas[0] || "Core idea from the source"}\n   b. ${keyIdeas[1] || "Supporting idea"}\n   c. ${keyIdeas[2] || "Practical implication"}\n4. Applications\n   How this applies to learners, teams, customers, members, or decision-makers.\n5. Risks or Watchouts\n   What could be misunderstood, ignored, or poorly implemented.\n6. Next Steps\n   Convert the outline into a lesson, SOP, content post, or implementation plan.\n\nSources Used:\n${sourceList}`;
  }

  return `Summary:\n${topSentences.slice(0, 2).join(" ") || primary.excerpt}\n\nKey Points:\n1. ${keyIdeas[0] || "The uploaded content contains reusable knowledge that can be transformed into practical outputs."}\n2. ${keyIdeas[1] || "The most relevant source should guide the answer instead of generic AI assumptions."}\n3. ${keyIdeas[2] || "The material can be reused as training, strategy, lessons, summaries, or action steps."}\n\nInsights:\n${topSentences[2] || "The important value is in converting raw information into a decision-ready or teaching-ready format."} ${topSentences[3] || "This makes the content easier to reuse across community, coaching, education, business, or research workflows."}\n\nActionable Output:\nRecommended next actions:\n1. Save this result as a reusable note.\n2. Turn the key points into a checklist, post, lesson, or SOP.\n3. Ask a follow-up question to refine the output for a specific audience or goal.\n4. Use another transform action if you need a lesson, outline, action plan, or social content.\n\nSources Used:\n${sourceList}`;
}

function extractKeyIdeas(text: string, count = 5) {
  const frequencies = new Map<string, number>();
  for (const token of tokenize(text)) {
    frequencies.set(token, (frequencies.get(token) || 0) + 1);
  }

  const topTerms = [...frequencies.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, count)
    .map(([term]) => humanizeTerm(term));

  return topTerms.length ? topTerms : ["clear understanding", "practical application", "reusable output"];
}

function humanizeTerm(term: string) {
  return term.charAt(0).toUpperCase() + term.slice(1);
}

export function buildSuggestedPrompt(item: LibraryItem) {
  if (item.wordCount < 150) return "Summarize this and suggest how I can use it.";
  if (item.type === "course" || item.type === "transcript") return "Create a lesson and study guide from this content.";
  if (item.type === "manual") return "Turn this into an SOP and checklist.";
  return "Summarize this, extract key ideas, and give me an action plan.";
}
