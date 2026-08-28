export interface PostTextSegment {
  text: string;
  handle: string | null;
}

const HANDLE = /@[A-Za-z0-9_](?:[A-Za-z0-9_.-]{0,28}[A-Za-z0-9_])?/g;

/** Split post copy without turning email addresses into profile links. */
export function splitPostMentions(content: string): PostTextSegment[] {
  const segments: PostTextSegment[] = [];
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = HANDLE.exec(content)) !== null) {
    const previous = match.index > 0 ? content[match.index - 1] : "";
    if (previous && /[A-Za-z0-9_@]/.test(previous)) continue;

    if (match.index > cursor) {
      segments.push({ text: content.slice(cursor, match.index), handle: null });
    }
    segments.push({ text: match[0], handle: match[0].slice(1) });
    cursor = match.index + match[0].length;
  }

  if (cursor < content.length) {
    segments.push({ text: content.slice(cursor), handle: null });
  }

  return segments.length ? segments : [{ text: content, handle: null }];
}
