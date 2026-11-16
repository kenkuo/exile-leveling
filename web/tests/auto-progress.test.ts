import type { Fragments, RouteData } from "common";
import { createStore } from "jotai";
import { RESET } from "jotai/utils";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getAutoProgressTransition } from "../src/utility/auto-progress";

const message = (areaId: string, timestamp = "00:00:00") =>
  `2026/11/15 ${timestamp} 1 abc [INFO Client 1] Generating level 2 area "${areaId}" with seed 123`;

function travel(
  edgeIndex: number,
  parts: Fragments.AnyFragment[] = [{ type: "enter", areaId: "1_1_town" }],
  subSteps: RouteData.FragmentStep[] = [],
): RouteData.FragmentStep {
  return { type: "fragment_step", edgeIndex, parts, subSteps };
}

const route = (
  steps: RouteData.Step[],
  edges = ["1_1_1", "1_1_town"],
): RouteData.Route => ({ sections: [{ name: "Act 1", steps }], edges });

describe("travel eligibility", () => {
  it("completes the matching travel step, not the initial edge", () => {
    expect(
      getAutoProgressTransition(
        route([travel(0, [{ type: "kill", value: "Hillock" }]), travel(1)]),
        0,
        message("1_1_town"),
      ),
    ).toEqual({ edgeIndex: 1, completionKey: "0,1" });
  });

  it.each([
    { type: "enter", areaId: "1_1_town" },
    { type: "waypoint_use", srcAreaId: "1_1_1", dstAreaId: "1_1_town" },
    { type: "portal_use", dstAreaId: "1_1_town" },
  ] satisfies Fragments.AnyFragment[])(
    "accepts standalone $type travel",
    (part) => {
      expect(
        getAutoProgressTransition(
          route([travel(1, ["\u279e ", part])]),
          0,
          message("1_1_town"),
        )?.completionKey,
      ).toBe("0,0");
    },
  );

  it.each([
    { type: "kill", value: "Hillock" },
    { type: "quest", questId: "a1q1", rewardOffers: [] },
    { type: "quest_text", value: "Glyph" },
    { type: "waypoint_get" },
    { type: "trial" },
    { type: "crafting", crafting_recipes: [] },
    { type: "logout", areaId: "1_1_town" },
    { type: "generic", value: "Boat" },
  ] satisfies Fragments.AnyFragment[])(
    "does not infer $type completion or complete mixed steps",
    (part) => {
      for (const parts of [
        [part],
        [{ type: "enter", areaId: "1_1_town" }, part],
      ]) {
        expect(
          getAutoProgressTransition(
            route([travel(1, parts as Fragments.AnyFragment[])]),
            0,
            message("1_1_town"),
          ),
        ).toEqual({ edgeIndex: 1, completionKey: null });
      }
    },
  );

  it("rejects additional action text, multiple destinations, and substeps", () => {
    for (const step of [
      travel(1, ["Take the boat ", { type: "enter", areaId: "1_1_town" }]),
      travel(1, [
        { type: "enter", areaId: "1_1_town" },
        { type: "enter", areaId: "1_1_town" },
      ]),
      travel(1, undefined, [travel(1, [{ type: "trial" }])]),
    ]) {
      expect(
        getAutoProgressTransition(route([step]), 0, message("1_1_town"))
          ?.completionKey,
      ).toBeNull();
    }
  });

  it("uses displayed indices across sections and inserted gem steps", () => {
    const gem: RouteData.GemStep = {
      type: "gem_step",
      requiredGem: { id: 0, note: "", count: 1 },
      count: 1,
      rewardType: "quest",
    };
    expect(
      getAutoProgressTransition(
        {
          edges: ["1_1_1", "1_1_town"],
          sections: [
            { name: "First", steps: [travel(0)] },
            { name: "Second", steps: [gem, travel(1)] },
          ],
        },
        0,
        message("1_1_town"),
      ),
    ).toEqual({ edgeIndex: 1, completionKey: "1,1" });
    expect(
      getAutoProgressTransition(route([gem]), 0, message("1_1_town")),
    ).toEqual({ edgeIndex: 1, completionKey: null });
  });

  it("only matches the next edge and ignores malformed and unrelated messages", () => {
    for (const line of [
      message("1_1_1"),
      message("1_1_2"),
      'Generating level 2 area ""',
      'Generating level x area "1_1_town"',
      'Generating level 2 area "1_1_town',
      "Character (Witch) is now level 2",
    ]) {
      expect(getAutoProgressTransition(route([travel(1)]), 0, line)).toBeNull();
    }
    expect(
      getAutoProgressTransition(route([travel(1)]), 1, message("1_1_town")),
    ).toBeNull();
  });
});

describe("auto-progress state", () => {
  let activeEdgeAtom: typeof import("../src/state/route").activeEdgeAtom;
  let nextEdgeAtom: typeof import("../src/state/route").nextEdgeAtom;
  let routeSelector: typeof import("../src/state/route").routeSelector;
  let routeFilesSelector: typeof import("../src/state/route-files").routeFilesSelector;
  let routeProgressFamily: typeof import("../src/state/route-progress").routeProgressFamily;
  let store: ReturnType<typeof createStore>;
  const storage = new Map<string, string>();
  const files = [
    {
      name: "Act 1",
      contents: [
        "#section Act 1",
        "Find and kill {kill|Hillock}",
        "\u279e {enter|1_1_town}",
        "Hand in {quest|a1q1}",
        "\u279e {enter|1_1_2}",
        "\u279e {enter|1_1_town}",
      ].join("\n"),
    },
  ];

  beforeAll(async () => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    ({ activeEdgeAtom, nextEdgeAtom, routeSelector } =
      await import("../src/state/route"));
    ({ routeFilesSelector } = await import("../src/state/route-files"));
    ({ routeProgressFamily } = await import("../src/state/route-progress"));
  });

  beforeEach(async () => {
    storage.clear();
    store = createStore();
    store.set(routeProgressFamily.clear);
    store.set(activeEdgeAtom, RESET);
    store.set(routeFilesSelector, files);
    await store.get(routeSelector);
  });

  it("checks only travel, persists it, and preserves manual unchecking", async () => {
    await store.set(activeEdgeAtom, message("1_1_town"));
    expect(store.get(activeEdgeAtom)).toEqual([1]);
    expect(store.get(routeProgressFamily("0,0"))).toBe(false);
    expect(store.get(routeProgressFamily("0,1"))).toBe(true);
    expect(store.get(routeProgressFamily("0,2"))).toBe(false);
    expect(JSON.parse(storage.get("route-progress")!)).toEqual({
      version: 0,
      value: ["0,1"],
    });

    store.set(routeProgressFamily("0,1"), false);
    await store.set(activeEdgeAtom, message("1_1_town"));
    expect(store.get(routeProgressFamily("0,1"))).toBe(false);
    expect(store.get(activeEdgeAtom)).toEqual([1]);
  });

  it("processes rapid events in order and distinguishes repeated route areas", async () => {
    await Promise.all([
      store.set(activeEdgeAtom, message("1_1_town")),
      store.set(activeEdgeAtom, message("1_1_town")),
      store.set(activeEdgeAtom, message("1_1_2", "00:00:01")),
      store.set(activeEdgeAtom, message("1_1_town", "00:00:02")),
    ]);
    expect(store.get(activeEdgeAtom)).toEqual([3]);
    expect(JSON.parse(storage.get("route-progress")!).value).toEqual([
      "0,1",
      "0,3",
      "0,4",
    ]);
    expect(store.get(routeProgressFamily("0,2"))).toBe(false);
  });

  it("does not reapply a consumed message after a manual indicator edit", async () => {
    const line = message("1_1_town");
    await store.set(activeEdgeAtom, line);
    store.set(routeProgressFamily("0,1"), false);
    store.set(nextEdgeAtom(0));
    await store.set(activeEdgeAtom, line);
    expect(store.get(activeEdgeAtom)).toEqual([0]);
    expect(store.get(routeProgressFamily("0,1"))).toBe(false);
    await store.set(activeEdgeAtom, message("1_1_town", "00:00:03"));
    expect(store.get(routeProgressFamily("0,1"))).toBe(true);
  });

  it.each(["reset", "manual", "route"] as const)(
    "discards pending messages when %s changes",
    async (change) => {
      const task = store.set(activeEdgeAtom, message("1_1_town"));
      if (change === "reset") store.set(activeEdgeAtom, RESET);
      if (change === "manual") store.set(nextEdgeAtom(2));
      if (change === "route") {
        store.set(routeFilesSelector, [
          { name: "Other", contents: "#section Other\n{enter|1_1_town}" },
        ]);
      }
      await task;
      expect(store.get(activeEdgeAtom)).toEqual([change === "manual" ? 2 : 0]);
      expect(store.get(routeProgressFamily("0,1"))).toBe(false);
    },
  );

  it("allows fresh live progress after resetting completion and the indicator", async () => {
    await store.set(activeEdgeAtom, message("1_1_town"));
    store.set(routeProgressFamily.clear);
    store.set(activeEdgeAtom, RESET);
    await store.set(activeEdgeAtom, message("1_1_town", "00:00:04"));
    expect(store.get(activeEdgeAtom)).toEqual([1]);
    expect(store.get(routeProgressFamily("0,1"))).toBe(true);
  });
});
