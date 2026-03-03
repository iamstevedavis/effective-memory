export type ParsedCsvRow = {
  rating: string;
  text: string;
  reviewed_at: string;
  author_name?: string;
};

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      out.push(cur);
      cur = "";
      continue;
    }

    cur += ch;
  }

  out.push(cur);
  return out;
}

export function parseCsv(text: string): ParsedCsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = {
    rating: headers.indexOf("rating"),
    text: headers.indexOf("text"),
    reviewed_at: headers.indexOf("reviewed_at"),
    author_name: headers.indexOf("author_name")
  };

  if (idx.rating < 0 || idx.text < 0 || idx.reviewed_at < 0) {
    throw new Error("CSV must include: rating, text, reviewed_at");
  }

  const rows: ParsedCsvRow[] = [];
  for (const rawLine of lines.slice(1)) {
    const cols = parseCsvLine(rawLine);
    rows.push({
      rating: (cols[idx.rating] ?? "").trim(),
      text: (cols[idx.text] ?? "").trim(),
      reviewed_at: (cols[idx.reviewed_at] ?? "").trim(),
      author_name: idx.author_name >= 0 ? (cols[idx.author_name] ?? "").trim() : undefined
    });
  }

  return rows;
}
