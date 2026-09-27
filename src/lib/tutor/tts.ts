// Text-to-speech with Microsoft Edge's free neural voices, chunked and synthesized
// concurrently. Ported from the Streamlit prototype's tutor/tts.py (which used the
// Python `edge-tts` package) onto the Node equivalent, `msedge-tts`.
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Language } from "./types";

export { VOICES_BY_LANGUAGE } from "./voices";

const _EN_ONES =
  "zero one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen".split(
    " "
  );
const _EN_TENS = "_ _ twenty thirty forty fifty sixty seventy eighty ninety".split(" ");

const _HI = (
  "शून्य एक दो तीन चार पाँच छह सात आठ नौ दस ग्यारह बारह तेरह चौदह पंद्रह सोलह सत्रह अठारह उन्नीस बीस " +
  "इक्कीस बाईस तेईस चौबीस पच्चीस छब्बीस सत्ताईस अट्ठाईस उनतीस तीस इकतीस बत्तीस तैंतीस चौंतीस पैंतीस " +
  "छत्तीस सैंतीस अड़तीस उनतालीस चालीस इकतालीस बयालीस तैंतालीस चौवालीस पैंतालीस छियालीस सैंतालीस " +
  "अड़तालीस उनचास पचास इक्यावन बावन तिरपन चौवन पचपन छप्पन सत्तावन अट्ठावन उनसठ साठ इकसठ बासठ तिरसठ " +
  "चौंसठ पैंसठ छियासठ सड़सठ अड़सठ उनहत्तर सत्तर इकहत्तर बहत्तर तिहत्तर चौहत्तर पचहत्तर छिहत्तर सतहत्तर " +
  "अठहत्तर उनासी अस्सी इक्यासी बयासी तिरासी चौरासी पचासी छियासी सत्तासी अट्ठासी नवासी नब्बे इक्यानवे " +
  "बानवे तिरानवे चौरानवे पंचानवे छियानवे सत्तानवे अट्ठानवे निन्यानवे"
).split(" ");

// A 4-digit number 1000-2999 standing alone (not inside a bigger number, price or decimal) is read as a year.
const YEAR_RE = /(?<![\d.])(?<!\d,)([12]\d{3})(s?)(?!\d|,\d|\.\d)/g;

function en2(n: number): string {
  if (n < 20) return _EN_ONES[n];
  const tens = _EN_TENS[Math.floor(n / 10)];
  const rem = n % 10;
  return tens + (rem ? `-${_EN_ONES[rem]}` : "");
}

function yearEn(y: number, plural: boolean): string {
  let w: string;
  if (y >= 2000 && y <= 2009) {
    w = "two thousand" + (y > 2000 ? ` ${_EN_ONES[y - 2000]}` : "");
  } else {
    const hi = Math.floor(y / 100);
    const lo = y % 100;
    w = lo === 0 ? `${en2(hi)} hundred` : `${en2(hi)} ${lo < 10 ? `oh ${_EN_ONES[lo]}` : en2(lo)}`;
  }
  if (plural) {
    w = w.endsWith("y") ? `${w.slice(0, -1)}ies` : `${w}s`;
  }
  return w;
}

// Second param kept (unused) to mirror the Python signature: _year_hi also ignores
// `plural` — Hindi years aren't spoken as decade-plurals ("the 1990s").
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function yearHi(y: number, _plural: boolean): string {
  const thousands = Math.floor(y / 1000);
  const rest = y % 1000;
  if (y >= 2000 || y < 1100) {
    let w = `${_HI[thousands]} हज़ार` + (rest >= 100 ? ` ${_HI[Math.floor(rest / 100)]} सौ` : "");
    w += rest % 100 ? ` ${_HI[rest % 100]}` : "";
    return w;
  }
  const hi = Math.floor(y / 100);
  const lo = y % 100;
  return `${_HI[hi]} सौ` + (lo ? ` ${_HI[lo]}` : "");
}

function numEn(n: number): string {
  if (n < 100) return en2(n);
  if (n < 1000) {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return `${_EN_ONES[h]} hundred` + (r ? ` ${numEn(r)}` : "");
  }
  for (const [size, name] of [
    [1_000_000_000, "billion"],
    [1_000_000, "million"],
    [1000, "thousand"],
  ] as const) {
    if (n >= size) {
      const q = Math.floor(n / size);
      const r = n % size;
      return `${numEn(q)} ${name}` + (r ? ` ${numEn(r)}` : "");
    }
  }
  return String(n);
}

const NUMBER_RE = /(?<![\w.])\d{1,3}(?:,\d{3})+(?:\.\d+)?|(?<![\w.])\d+(?:\.\d+)?/g;

function numberEn(raw: string): string {
  const [wholeRaw, fracRaw] = raw.replace(/,/g, "").split(".");
  const w = numEn(parseInt(wholeRaw, 10));
  if (fracRaw) {
    return `${w} point ${fracRaw.split("").map((d) => _EN_ONES[parseInt(d, 10)]).join(" ")}`;
  }
  return w;
}

/** Spell years (and, for Hinglish, all numbers) out so the voice reads them properly. */
export function speakYears(text: string, language: Language): string {
  const conv = language === "Hindi" ? yearHi : yearEn;
  text = text.replace(YEAR_RE, (_m, y, s) => conv(parseInt(y, 10), Boolean(s)));
  if (language === "Hinglish") {
    text = text.replace(NUMBER_RE, (m) => numberEn(m));
  }
  return text;
}

const MAX_CHARS = 2500;
const CONCURRENCY = 4;

/** Split on paragraph/sentence boundaries so each chunk stays under `limit`. */
export function splitText(text: string, limit: number = MAX_CHARS): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const para of text.split(/\n\s*\n/)) {
    for (const sent of para.trim().split(/(?<=[.!?।])\s+/)) {
      if (!sent) continue;
      if (cur.length + sent.length + 1 > limit && cur) {
        chunks.push(cur.trim());
        cur = "";
      }
      cur += sent + " ";
    }
    cur += "\n\n";
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const chunk of stream) {
    parts.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(parts);
}

async function synthOne(text: string, voice: string, rate: string): Promise<Buffer> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    const tts = new MsEdgeTTS();
    try {
      await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
      const { audioStream } = await tts.toStream(text, { rate });
      const buf = await streamToBuffer(audioStream);
      if (buf.length) return buf;
    } catch (e) {
      lastErr = e;
    } finally {
      tts.close();
    }
    await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
  }
  throw new Error(`Speech synthesis failed: ${lastErr}`);
}

async function synthAll(
  chunks: string[],
  voice: string,
  rate: string,
  onProgress: (done: number, total: number) => void
): Promise<Buffer[]> {
  const results: Buffer[] = new Array(chunks.length);
  let done = 0;
  let next = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= chunks.length) return;
      results[i] = await synthOne(chunks[i], voice, rate);
      done += 1;
      onProgress(done, chunks.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, chunks.length) }, worker));
  return results;
}

/** Return one MP3 (Buffer) for the whole script. */
export async function synthesize(
  text: string,
  voice: string,
  language: Language,
  onProgress: (done: number, total: number) => void = () => {}
): Promise<Buffer> {
  const spoken = speakYears(text, language);
  const parts = await synthAll(splitText(spoken), voice, "+0%", onProgress);
  return Buffer.concat(parts);
}
