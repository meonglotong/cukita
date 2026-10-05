// Scroll-spy for the "On this page" TOC.
//
// Pure function so it is testable in the node test environment: the
// component measures each heading's viewport-relative top on scroll and
// hands the result in here.
//
// Rule: the active heading is the LOWEST one (in document order) whose top
// has crossed the anchor line. That is the heading the reader is currently
// reading. If none has crossed yet, the first heading is active.

export function pickActiveHeading(
  ids: string[],
  tops: Record<string, number>,
  anchorLine = 80,
): string | null {
  let active: string | null = null;
  for (const id of ids) {
    const top = tops[id];
    if (top !== undefined && top <= anchorLine) active = id;
  }
  return active ?? ids[0] ?? null;
}
