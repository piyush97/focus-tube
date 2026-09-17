interface Env {
  TYPESAFE_API_KEY: string;
  FOCUSTUBE_TOKEN: string;
}

interface Video {
  title: string;
  channel: string;
  surface: string;
}

interface TypeSafeResponse {
  answers?: Record<string, { type: "noul"; noul: number }>;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json"
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function validVideo(value: unknown): value is Video {
  if (!value || typeof value !== "object") return false;
  const video = value as Record<string, unknown>;
  return typeof video.title === "string" && video.title.length > 0 && video.title.length <= 300
    && typeof video.channel === "string" && video.channel.length <= 200
    && typeof video.surface === "string" && video.surface.length <= 40;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (!env.FOCUSTUBE_TOKEN || request.headers.get("Authorization") !== `Bearer ${env.FOCUSTUBE_TOKEN}`) {
      return json({ error: "Unauthorized" }, 401);
    }
    if (request.method === "GET" && url.pathname === "/health") return json({ status: "ok" });
    if (request.method !== "POST" || url.pathname !== "/classify") return json({ error: "Not found" }, 404);
    if (!env.TYPESAFE_API_KEY) return json({ error: "TYPESAFE_API_KEY is not configured" }, 500);

    let body: { videos?: unknown };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    if (!Array.isArray(body.videos) || body.videos.length === 0 || body.videos.length > 20 || !body.videos.every(validVideo)) {
      return json({ error: "videos must contain 1–20 valid video records" }, 400);
    }

    const videos = body.videos as Video[];
    const questions = Object.fromEntries(videos.map((_, index) => [
      `video_${index}`,
      {
        type: "noul",
        instructions: {
          question: `Is videos[${index}] directly useful for focused learning or career upskilling?`,
          include: [
            "programming and coding",
            "software engineering, architecture, tooling, cybersecurity, data, cloud, or AI engineering",
            "coding interviews, system design interviews, technical career preparation",
            "academic studying, tutorials, courses, lectures, and substantive explainers",
            "professional skills with concrete instructional value"
          ],
          exclude: [
            "general entertainment, comedy, celebrity, gossip, music, gaming, sports, lifestyle, or reaction content",
            "tech news, product launches, desk setups, unboxings, or creator vlogs without substantial instruction",
            "sensational motivation, passive inspiration, or vague career content",
            "short-form distraction or content whose educational value is unclear"
          ]
        }
      }
    ]));

    const response = await fetch("https://api.typesafe.ai/v1/systemone", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.TYPESAFE_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ state: { videos }, model: "jev-latest", questions })
    });

    if (!response.ok) {
      console.error("TypeSafe request failed", response.status, await response.text());
      return json({ error: "Classification service unavailable" }, 502);
    }

    const result = await response.json() as TypeSafeResponse;
    const results = videos.map((_, index) => ({
      probability: result.answers?.[`video_${index}`]?.noul ?? 0
    }));
    return json({ results });
  }
};
