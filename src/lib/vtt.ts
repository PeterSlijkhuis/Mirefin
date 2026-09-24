export interface Cue {
  start: number;
  end: number;
  text: string;
}

function toSeconds(ts: string): number {
  // hh:mm:ss.mmm or mm:ss.mmm (SRT uses a comma)
  const parts = ts.trim().replace(',', '.').split(':').map(Number);
  return parts.reduce((acc, p) => acc * 60 + p, 0);
}

/** Parses WebVTT (and SRT, which has the same cue shape). */
export function parseVtt(input: string): Cue[] {
  const cues: Cue[] = [];
  for (const block of input.replace(/\r/g, '').split(/\n{2,}/)) {
    const lines = block.split('\n');
    const i = lines.findIndex((l) => l.includes('-->'));
    if (i < 0) continue;
    const [a, b] = lines[i].split('-->');
    const text = lines
      .slice(i + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .trim();
    if (text) cues.push({ start: toSeconds(a), end: toSeconds(b.trim().split(/\s+/)[0]), text });
  }
  return cues.sort((x, y) => x.start - y.start);
}

export function activeCues(cues: Cue[], t: number): Cue[] {
  // ponytail: linear scan per tick; fine for subtitle-sized lists, binary search if it ever shows up in profiles.
  return cues.filter((c) => c.start <= t && t < c.end);
}
