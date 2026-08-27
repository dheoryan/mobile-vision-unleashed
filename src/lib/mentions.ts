export function mentionRangeAtCaret(text: string, caret: number) {
  const upTo = text.slice(0, caret);
  const match = /(?:^|\s)@([\w.-]{0,30})$/.exec(upTo);
  return match
    ? { query: match[1], start: upTo.length - (match[1].length + 1) }
    : null;
}

/** Replace the active @token and return the new content and caret position. */
export function applyMention(
  text: string,
  caret: number,
  start: number,
  handle: string,
): { text: string; caret: number } {
  const before = text.slice(0, start);
  const after = text.slice(caret).replace(/^\s+/, "");
  const insert = `@${handle.replace(/^@/, "")} `;
  return { text: `${before}${insert}${after}`, caret: before.length + insert.length };
}

/** Resolve only complete, known @handle tokens to profile ids. */
export function collectMentionIds(text: string, knownHandles: Map<string, string>): string[] {
  const ids = new Set<string>();
  const expression = /(?:^|\s)@([\w.-]{1,30})/g;
  let match: RegExpExecArray | null;
  while ((match = expression.exec(text)) !== null) {
    let handle = match[1].toLowerCase();
    while (handle && !knownHandles.has(handle) && /[.-]$/.test(handle)) {
      handle = handle.slice(0, -1);
    }
    const id = knownHandles.get(handle);
    if (id) ids.add(id);
  }
  return Array.from(ids);
}
