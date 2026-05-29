import { describe, expect, it } from "vitest";
import { cosine, registerIndex, search } from "./store";
import { l2Normalize } from "./embedder";
import type { EmbeddingIndex } from "./types";

describe("cosine", () => {
  it("returns 1 for identical normalized vectors", () => {
    const v = l2Normalize([0.5, 0.5, 0.5, 0.5]);
    expect(cosine(v, v)).toBeCloseTo(1, 5);
  });
  it("returns 0 for orthogonal vectors", () => {
    const a = l2Normalize([1, 0, 0, 0]);
    const b = l2Normalize([0, 1, 0, 0]);
    expect(cosine(a, b)).toBeCloseTo(0, 5);
  });
  it("returns -1 for opposite vectors", () => {
    const a = l2Normalize([1, 1, 0, 0]);
    const b = l2Normalize([-1, -1, 0, 0]);
    expect(cosine(a, b)).toBeCloseTo(-1, 5);
  });
  it("throws on dim mismatch", () => {
    expect(() => cosine([1, 0], [1, 0, 0])).toThrow();
  });
});

describe("l2Normalize", () => {
  it("returns a unit-length vector", () => {
    const v = l2Normalize([3, 4]); // length 5
    expect(v[0]).toBeCloseTo(0.6, 5);
    expect(v[1]).toBeCloseTo(0.8, 5);
    const norm = Math.sqrt(v[0] ** 2 + v[1] ** 2);
    expect(norm).toBeCloseTo(1, 5);
  });
  it("handles zero vector without crashing", () => {
    const v = l2Normalize([0, 0, 0]);
    expect(v).toEqual([0, 0, 0]);
  });
});

describe("search", () => {
  interface TestPayload {
    level: "debutant" | "intermediaire" | "avance";
    pattern: string;
  }

  const idx: EmbeddingIndex<TestPayload> = {
    model: "test",
    dims: 4,
    created_at: "",
    count: 3,
    records: [
      {
        id: "ex_squat",
        label: "Squat",
        vector: l2Normalize([1, 0, 0, 0]),
        payload: { level: "intermediaire", pattern: "squat" },
      },
      {
        id: "ex_pistol",
        label: "Pistol Squat",
        vector: l2Normalize([0.9, 0.1, 0, 0]),
        payload: { level: "avance", pattern: "squat" },
      },
      {
        id: "ex_bench",
        label: "Bench Press",
        vector: l2Normalize([0, 1, 0, 0]),
        payload: { level: "intermediaire", pattern: "push_horizontal" },
      },
    ],
  };

  it("returns top-K by cosine descending", () => {
    registerIndex("test_idx", idx);
    const q = l2Normalize([1, 0, 0, 0]);
    const hits = search<TestPayload>("test_idx", q, { topK: 2 });
    expect(hits).toHaveLength(2);
    expect(hits[0].id).toBe("ex_squat");
    expect(hits[1].id).toBe("ex_pistol");
    expect(hits[0].score).toBeGreaterThan(hits[1].score);
  });

  it("applies payload filter", () => {
    registerIndex("test_idx", idx);
    const q = l2Normalize([1, 0, 0, 0]);
    const hits = search<TestPayload>("test_idx", q, {
      topK: 5,
      filter: (p) => p.level !== "avance",
    });
    expect(hits).toHaveLength(2); // pistol filtered out
    expect(hits.find((h) => h.id === "ex_pistol")).toBeUndefined();
  });

  it("returns empty array for missing index", () => {
    const q = l2Normalize([1, 0, 0, 0]);
    const hits = search<TestPayload>("ghost_idx", q, { topK: 5 });
    expect(hits).toEqual([]);
  });

  it("respects minScore threshold", () => {
    registerIndex("test_idx", idx);
    const q = l2Normalize([0, 0, 1, 0]); // orthogonal to everything
    const hits = search<TestPayload>("test_idx", q, {
      topK: 5,
      minScore: 0.5,
    });
    expect(hits).toEqual([]);
  });
});

describe("level/equipment mapping", () => {
  it("maps training_history to coach level", async () => {
    const { levelFromProfile, equipmentFromProfile } = await import("./context");
    expect(levelFromProfile({ training_history: "beginner" })).toBe("debutant");
    expect(levelFromProfile({ training_history: "intermediate" })).toBe("intermediaire");
    expect(levelFromProfile({ training_history: "advanced" })).toBe("avance");
    expect(levelFromProfile(undefined)).toBe("intermediaire");
  });

  it("returns undefined for gym (no filter)", async () => {
    const { equipmentFromProfile } = await import("./context");
    expect(equipmentFromProfile({ training_environment: "gym" })).toBeUndefined();
    expect(equipmentFromProfile({ training_environment: "mixed" })).toBeUndefined();
  });

  it("returns bodyweight equipment whitelist for home_bodyweight", async () => {
    const { equipmentFromProfile } = await import("./context");
    const eq = equipmentFromProfile({ training_environment: "home_bodyweight" });
    expect(eq).toContain("aucun");
    expect(eq).toContain("barre_traction");
    expect(eq).not.toContain("barre"); // no barbell in bodyweight env
    expect(eq).not.toContain("machine_chest_press");
  });

  it("custom available_equipment overrides env default", async () => {
    const { equipmentFromProfile } = await import("./context");
    const eq = equipmentFromProfile({
      training_environment: "home_bodyweight",
      available_equipment: ["aucun", "kettlebells"],
    });
    expect(eq).toEqual(["aucun", "kettlebells"]);
  });
});
