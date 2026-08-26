export interface TribeMemberSummary {
  id: string;
  display_name: string;
  handle: string | null;
  avatar_emoji: string | null;
  avatar_url: string | null;
}

export function visibleTribeMembers(
  members: TribeMemberSummary[],
  query: string,
  onlineIds: ReadonlySet<string>,
  currentUserId?: string,
) {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return members
    .filter((member) => {
      if (!normalizedQuery) return true;
      return [member.display_name, member.handle ?? ""]
        .join(" ")
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    })
    .slice()
    .sort((left, right) => {
      const leftIsMe = left.id === currentUserId;
      const rightIsMe = right.id === currentUserId;
      if (leftIsMe !== rightIsMe) return leftIsMe ? -1 : 1;

      const leftOnline = onlineIds.has(left.id);
      const rightOnline = onlineIds.has(right.id);
      if (leftOnline !== rightOnline) return leftOnline ? -1 : 1;

      return left.display_name.localeCompare(right.display_name, undefined, {
        sensitivity: "base",
      });
    });
}
