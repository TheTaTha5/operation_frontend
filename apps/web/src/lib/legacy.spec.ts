import { describe, expect, it } from "vitest";

import { groupBySection, legacyUrl, legacyViews } from "./legacy";

describe("legacyUrl", () => {
  it("links to the legacy app root without a view", () => {
    expect(legacyUrl()).toBe("/allotment_v2/allotment_v2.html");
  });

  it("deep-links one screen through ?view=", () => {
    expect(legacyUrl("rate-types")).toBe("/allotment_v2/allotment_v2.html?view=rate-types");
  });
});

describe("legacyViews", () => {
  it("has unique view keys the legacy deep link accepts", () => {
    const keys = legacyViews.map((v) => v.view);
    expect(new Set(keys).size).toBe(keys.length);
    // _laRestoreView rejects anything else
    for (const k of keys) expect(k).toMatch(/^[a-z0-9-]+$/);
  });

  it("groups by section in sidebar order", () => {
    const sections = groupBySection(legacyViews).map(([s]) => s);
    expect(sections[0]).toBe("Overview");
    expect(new Set(sections).size).toBe(sections.length);
  });
});
