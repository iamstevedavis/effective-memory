export type ParsedCsvRow = {
  rating: string;
  text: string;
  reviewed_at: string;
  author_name?: string;
  source_review_id?: string;
  source_url?: string;
};

function parseCsvRecords(text: string): string[][] {
  const records: string[][] = []; let cells: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '\"') {
      if (quoted && text[i + 1] === '\"') { cell += '\"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && (c === "," || c === "\n" || c === "\r")) {
      cells.push(cell); cell = "";
      if (c !== ",") { records.push(cells); cells = []; if (c === "\r" && text[i + 1] === "\n") i++; }
    } else cell += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (cell || cells.length) records.push([...cells, cell]);
  return records;
}

export function parseCsv(text: string): ParsedCsvRow[] {
  const lines = parseCsvRecords(text.replace(/^\uFEFF/, ""));
  if (!lines.length) return [];
  if (lines.length > 1001) throw new Error("CSV exceeds 1000 rows");
  const headers = lines[0].map(h => h.trim().toLowerCase());
  const idx = {
    rating: headers.indexOf("rating"),
    text: headers.indexOf("text"),
    reviewed_at: headers.indexOf("reviewed_at"),
    author_name: headers.indexOf("author_name"),
    source_review_id: headers.indexOf("source_review_id"), source_url: headers.indexOf("source_url")
  };

  if (idx.rating < 0 || idx.text < 0 || idx.reviewed_at < 0) {
    throw new Error("CSV must include: rating, text, reviewed_at");
  }

  const rows: ParsedCsvRow[] = [];
  for (const cols of lines.slice(1)) {
    rows.push({
      rating: (cols[idx.rating] ?? "").trim(),
      text: cols[idx.text] ?? "",
      reviewed_at: (cols[idx.reviewed_at] ?? "").trim(),
      author_name: idx.author_name >= 0 ? (cols[idx.author_name] ?? "").trim() : undefined,
      source_review_id: cols[idx.source_review_id]?.trim(), source_url: cols[idx.source_url]?.trim()
    });
  }

  return rows;
}
