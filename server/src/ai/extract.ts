/**
 * Document ingestion → chunks that never lose their source locator.
 *
 * The locator is the point. A generated question that cannot be traced back to
 * a page is a question a trainer cannot verify, and a question a trainer cannot
 * verify has no business in an assessment that feeds a competency record.
 */
import mammoth from 'mammoth';

export interface RawSegment {
  text: string;
  page: number;
  headingPath: string;
}

export interface Chunk extends RawSegment {
  ordinal: number;
}

const MIN_CHUNK = 260;
const MAX_CHUNK = 1400;

/** Heuristic: short line, no terminal full stop, title-ish → treat as a heading. */
function looksLikeHeading(line: string): boolean {
  const t = line.trim();
  if (t.length < 3 || t.length > 90) return false;
  if (/[.;:,]$/.test(t)) return false;
  const words = t.split(/\s+/);
  if (words.length > 12) return false;
  const capitalised = words.filter((w) => /^[A-Z0-9]/.test(w)).length;
  return capitalised / words.length > 0.55 || /^\d+(\.\d+)*\s/.test(t);
}

export async function extract(buffer: Buffer, mimeType: string, filename: string): Promise<{ segments: RawSegment[]; pages: number }> {
  const lower = filename.toLowerCase();

  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) {
    const { extractText, getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractText(pdf, { mergePages: false });
    const pages = Array.isArray(text) ? text : [String(text)];
    return { segments: pages.flatMap((t, i) => linesToSegments(String(t), i + 1)), pages: pages.length };
  }

  if (lower.endsWith('.docx')) {
    const { value } = await mammoth.extractRawText({ buffer });
    return { segments: linesToSegments(value, 1), pages: 1 };
  }

  if (lower.endsWith('.pptx')) {
    const segs = await extractPptx(buffer);
    return { segments: segs, pages: new Set(segs.map((s) => s.page)).size };
  }

  // txt / md / anything we can read as text
  const text = buffer.toString('utf8');
  return { segments: linesToSegments(text, 1), pages: 1 };
}

async function extractPptx(buffer: Buffer): Promise<RawSegment[]> {
  const unzipper = await import('unzipper');
  const dir = await unzipper.Open.buffer(buffer);
  const slides = dir.files
    .filter((f: any) => /^ppt\/slides\/slide\d+\.xml$/.test(f.path))
    .sort((a: any, b: any) => {
      const n = (p: string) => Number(p.match(/slide(\d+)\.xml/)![1]);
      return n(a.path) - n(b.path);
    });
  const out: RawSegment[] = [];
  for (const [i, slide] of slides.entries()) {
    const xml = (await slide.buffer()).toString('utf8');
    const runs = [...xml.matchAll(/<a:t>([\s\S]*?)<\/a:t>/g)].map((m) =>
      m[1]!.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    );
    if (!runs.length) continue;
    const title = runs[0]!.trim();
    const body = runs.slice(1).join(' ').replace(/\s+/g, ' ').trim();
    if (body.length < 20) continue;
    out.push({ text: `${title}. ${body}`, page: i + 1, headingPath: title });
  }
  return out;
}

function linesToSegments(text: string, page: number): RawSegment[] {
  const lines = text.split(/\r?\n/);
  const out: RawSegment[] = [];
  let heading = '';
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join(' ').replace(/\s+/g, ' ').trim();
    if (body.length >= 40) out.push({ text: body, page, headingPath: heading });
    buf = [];
  };
  for (const line of lines) {
    if (!line.trim()) continue;
    if (looksLikeHeading(line)) {
      flush();
      heading = line.trim();
    } else {
      buf.push(line.trim());
    }
  }
  flush();
  return out;
}

/**
 * Merge segments into chunks of MIN_CHUNK..MAX_CHUNK characters, never merging
 * across a page or heading boundary — because a chunk that spans two pages
 * cannot honestly cite one.
 */
export function chunkSegments(segments: RawSegment[]): Chunk[] {
  const chunks: Chunk[] = [];
  let cur: RawSegment | null = null;
  for (const seg of segments) {
    if (cur && cur.page === seg.page && cur.headingPath === seg.headingPath && cur.text.length + seg.text.length < MAX_CHUNK) {
      cur.text = `${cur.text} ${seg.text}`;
      continue;
    }
    if (cur) chunks.push({ ...cur, ordinal: chunks.length });
    cur = { ...seg };
  }
  if (cur) chunks.push({ ...cur, ordinal: chunks.length });

  // split anything still oversized on sentence boundaries
  const out: Chunk[] = [];
  for (const c of chunks) {
    if (c.text.length <= MAX_CHUNK) { out.push({ ...c, ordinal: out.length }); continue; }
    const sentences = splitSentences(c.text);
    let buf = '';
    for (const s of sentences) {
      if (buf.length + s.length > MAX_CHUNK && buf.length >= MIN_CHUNK) {
        out.push({ ...c, text: buf.trim(), ordinal: out.length });
        buf = '';
      }
      buf += ` ${s}`;
    }
    if (buf.trim().length >= 40) out.push({ ...c, text: buf.trim(), ordinal: out.length });
  }
  return out.filter((c) => c.text.length >= 80);
}

export function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
