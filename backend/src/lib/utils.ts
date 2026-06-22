export function extractHashtags(text: string): string[] {
  const matches = text.match(/#[\w\u00C0-\u024F]+/g);
  if (!matches) return [];
  return [...new Set(matches.map((tag) => tag.slice(1).toLowerCase()))];
}

export function buildSearchText(caption?: string | null, username?: string): string {
  const parts: string[] = [];
  if (caption) parts.push(caption);
  if (username) parts.push(username);
  const hashtags = caption ? extractHashtags(caption) : [];
  parts.push(...hashtags.map((h) => `#${h}`));
  return parts.join(' ').toLowerCase();
}

export function getDateRangeFilter(filter: string, customStart?: string, customEnd?: string): { gte?: Date; lte?: Date } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

  switch (filter) {
    case 'today':
      return { gte: startOfDay(now) };
    case '7days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 7);
      return { gte: d };
    }
    case '30days': {
      const d = new Date(now);
      d.setDate(d.getDate() - 30);
      return { gte: d };
    }
    case 'year':
      return { gte: new Date(now.getFullYear(), 0, 1) };
    case 'custom':
      return {
        gte: customStart ? new Date(customStart) : undefined,
        lte: customEnd ? new Date(customEnd) : undefined,
      };
    default:
      return {};
  }
}

export function calculateReplyDepth(parentDepth: number | undefined): number {
  const depth = (parentDepth ?? -1) + 1;
  if (depth > 4) throw new Error('Maximum reply depth of 5 levels exceeded');
  return depth;
}
