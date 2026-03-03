type CaptionStyles = {
  friendly: string;
  premium: string;
  playful: string;
};

function countHashtags(text: string): number {
  return (text.match(/(^|\s)#\w+/g) ?? []).length;
}

function sanitizeCaption(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  const clipped = cleaned.length > 200 ? `${cleaned.slice(0, 197).trim()}...` : cleaned;

  const words = clipped.split(" ");
  let seenTags = 0;
  const limited = words.filter((w) => {
    if (w.startsWith("#")) {
      seenTags += 1;
      return seenTags <= 5;
    }
    return true;
  });

  return limited.join(" ").trim();
}

export async function generateCaptionVariants(params: {
  businessName: string;
  quoteText: string;
}): Promise<CaptionStyles> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set");
  }

  const prompt = `You are writing social captions for a local business.
Business: ${params.businessName}
Quote: "${params.quoteText}"

Return ONLY JSON with keys friendly, premium, playful.
Rules:
- include business name subtly (not spammy)
- each caption <= 200 chars
- max 5 hashtags per caption
- no markdown, no extra keys`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      input: prompt,
      max_output_tokens: 400
    })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI request failed: ${res.status} ${text.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    output_text?: string;
  };

  const raw = data.output_text ?? "";
  let parsed: Partial<CaptionStyles> = {};
  try {
    parsed = JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("Failed to parse OpenAI caption JSON");
    parsed = JSON.parse(match[0]);
  }

  const friendly = sanitizeCaption(String(parsed.friendly ?? "").trim());
  const premium = sanitizeCaption(String(parsed.premium ?? "").trim());
  const playful = sanitizeCaption(String(parsed.playful ?? "").trim());

  const variants = { friendly, premium, playful };

  for (const [style, text] of Object.entries(variants)) {
    if (!text) throw new Error(`Caption missing for style: ${style}`);
    if (text.length > 200) throw new Error(`Caption too long for style: ${style}`);
    if (countHashtags(text) > 5) throw new Error(`Too many hashtags for style: ${style}`);
  }

  return variants;
}
