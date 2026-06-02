const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Whop-User-Token",
};

export default async function handler(req: any, res: any) {
  for (const [key, value] of Object.entries(corsHeaders)) res.setHeader(key, value);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const url = typeof req.body?.url === "string" ? req.body.url.trim() : "";
    if (!/^https?:\/\//i.test(url)) return res.status(400).json({ error: "A valid http or https URL is required" });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "user-agent": "SmartLibraryContentEngine/1.0 (+https://smartlibrary-content-engine.vercel.app)",
        accept: "text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return res.status(502).json({ error: `Unable to fetch URL. Status ${response.status}` });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    const title = extractTitle(raw) || new URL(url).hostname;
    const text = contentType.includes("html") ? htmlToText(raw) : normalize(raw);

    return res.status(200).json({
      title,
      text: text.slice(0, 80000),
      source: url,
      wordCount: text.split(/\s+/).filter(Boolean).length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown ingest error";
    return res.status(500).json({ error: message });
  }
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match ? normalize(decodeEntities(match[1] || "")).slice(0, 120) : "";
}

function htmlToText(html: string) {
  return normalize(
    decodeEntities(
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<\/(p|div|section|article|li|h1|h2|h3|h4|blockquote)>/gi, "\n")
        .replace(/<[^>]+>/g, " "),
    ),
  );
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalize(text: string) {
  return text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}
