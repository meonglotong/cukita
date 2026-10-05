import { describe, expect, it } from "vitest";
import { pickActiveHeading } from "./toc-scrollspy";

describe("pickActiveHeading", () => {
  const ids = ["intro", "code", "callouts"];

  it("falls back to the first heading when none has crossed the anchor line", () => {
    expect(pickActiveHeading(ids, { intro: 300, code: 600, callouts: 900 })).toBe("intro");
  });

  it("highlights the lowest heading that has crossed the anchor line", () => {
    // intro and code are above the line (scrolled past), callouts below
    expect(pickActiveHeading(ids, { intro: -50, code: 60, callouts: 500 })).toBe("code");
  });

  it("stays on an earlier heading when a later one has not reached the line", () => {
    expect(pickActiveHeading(ids, { intro: -200, code: 150, callouts: 400 })).toBe("intro");
  });

  it("highlights the last heading once it has crossed", () => {
    expect(pickActiveHeading(ids, { intro: -500, code: -200, callouts: 40 })).toBe("callouts");
  });

  it("ignores headings that were not measured (missing from tops)", () => {
    expect(pickActiveHeading(ids, { intro: -10, callouts: 500 })).toBe("intro");
  });

  it("returns null for an empty TOC", () => {
    expect(pickActiveHeading([], {})).toBeNull();
  });

  it("honors a custom anchor line", () => {
    expect(pickActiveHeading(ids, { intro: -10, code: 90 }, 80)).toBe("intro");
    expect(pickActiveHeading(ids, { intro: -10, code: 90 }, 100)).toBe("code");
  });
});
