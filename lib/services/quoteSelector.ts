import { query } from "../db";

type ReviewRow = {
  id: number;
  business_id: number;
  rating: number;
  text: string;
};

const PROFANITY = ["fuck", "shit", "bitch", "asshole"];
const KEYWORDS = ["food", "service", "clean", "friendly", "staff", "delicious", "fresh"];

function containsProfanity(text: string): boolean {
  const lower = text.toLowerCase();
  return PROFANITY.some((w) => lower.includes(w));
}

function keywordScore(text: string): number {
  const lower = text.toLowerCase();
  return KEYWORDS.reduce((acc, w) => acc + (lower.includes(w) ? 1 : 0), 0);
}

function scoreReview(r: ReviewRow): number {
  const trimmed = r.text.trim();
  const len = trimmed.length;

  let score = 0;
  if (r.rating >= 4) score += 50 + r.rating;
  if (len >= 30 && len <= 200) score += 30;
  else if (len > 200 && len <= 280) score += 8;
  score += keywordScore(trimmed) * 10;
  if (containsProfanity(trimmed)) score -= 200;
  return score;
}

export async function selectQuoteCandidates(businessId: number, limit = 5) {
  const reviews = await query<ReviewRow>(
    `SELECT r.id, r.business_id, r.rating, r.text
     FROM reviews r
     WHERE r.business_id = $1
       AND NOT EXISTS (
         SELECT 1
         FROM draft_posts d
         WHERE d.review_id = r.id
       )
     ORDER BY r.reviewed_at DESC, r.id DESC
     LIMIT 300`,
    [businessId]
  );

  const ranked = reviews.rows
    .map((r) => ({
      review: r,
      quoteText: r.text.trim().replace(/\s+/g, " "),
      score: scoreReview(r)
    }))
    .filter((x) => x.review.rating >= 4)
    .filter((x) => x.quoteText.length >= 30)
    .filter((x) => !containsProfanity(x.quoteText))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const inserted: Array<{ draftPostId: number; reviewId: number; quoteText: string; score: number }> = [];

  for (const item of ranked) {
    // Using draft_posts for persistence keeps MVP schema simple and avoids introducing
    // a separate candidate table before approval/publishing flow is wired.
    const res = await query<{ id: number }>(
      `INSERT INTO draft_posts (business_id, review_id, quote_text, caption_text, status)
       VALUES ($1, $2, $3, '', 'draft')
       RETURNING id`,
      [businessId, item.review.id, item.quoteText]
    );

    inserted.push({
      draftPostId: res.rows[0].id,
      reviewId: item.review.id,
      quoteText: item.quoteText,
      score: item.score
    });
  }

  return inserted;
}
