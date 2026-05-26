import { describe, expect, it } from "vitest";
import {
  generateSessionCode,
  computeSessionMetrics,
  findTopLift,
  appendSetLog,
  validateSetLogPayload,
} from "./session-utils";
import type { ExerciseSlot } from "@/types/session";

describe("generateSessionCode", () => {
  it("builds PUSH-V01 for first push session", () => {
    expect(generateSessionCode("Push · Pecs / Triceps", 0)).toBe("PUSH-V01");
  });
  it("increments version on prior sessions", () => {
    expect(generateSessionCode("Push · Pecs / Triceps", 46)).toBe("PUSH-V47");
  });
  it("strips diacritics", () => {
    expect(generateSessionCode("Récupération mobilité", 0)).toBe("RECUP-V01");
  });
  it("fallback for short/empty names", () => {
    expect(generateSessionCode("X", 0)).toBe("SESS-V01");
  });
});

describe("computeSessionMetrics", () => {
  const baseSession = {
    started_at: "2026-05-26T18:00:00Z",
    finished_at: "2026-05-26T19:00:00Z", // 1h
    exercises: [
      {
        block_code: "A1",
        exercise_id: "developpe_couche_barre",
        exercise_name: "Développé couché barre",
        load_type: "barbell" as const,
        target_sets: 3,
        target_reps_range: "8-12",
        target_rpe: 8,
        rest_seconds: 120,
        sets_logged: [
          { set_index: 1, weight_kg: 80, reps_done: 10, rpe_felt: 8, completed_at: "2026-05-26T18:10:00Z" },
          { set_index: 2, weight_kg: 80, reps_done: 9, rpe_felt: 9, completed_at: "2026-05-26T18:15:00Z" },
          { set_index: 3, weight_kg: 80, reps_done: 8, rpe_felt: 9, completed_at: "2026-05-26T18:20:00Z" },
        ],
      },
    ] satisfies ExerciseSlot[],
  };

  it("computes volume_kg correctly", () => {
    const m = computeSessionMetrics(baseSession, 80);
    expect(m.volume_kg).toBe(80 * (10 + 9 + 8)); // 2160
  });

  it("computes tonnage avg per set", () => {
    const m = computeSessionMetrics(baseSession, 80);
    expect(m.tonnage_avg_per_set_kg).toBe(720);
  });

  it("computes completion_pct", () => {
    const m = computeSessionMetrics(baseSession, 80);
    expect(m.completion_pct).toBe(100); // 3/3
  });

  it("computes vs_previous_volume_pct", () => {
    const m = computeSessionMetrics(baseSession, 80, 0, 1.5, 2000);
    expect(m.vs_previous_volume_pct).toBe(8); // (2160-2000)/2000 = 8%
  });

  it("includes loaded_kg in volume", () => {
    const session = {
      ...baseSession,
      exercises: [
        {
          ...baseSession.exercises[0],
          exercise_id: "dips_lestes",
          sets_logged: [
            { set_index: 1, weight_kg: 0, loaded_kg: 30, reps_done: 9, rpe_felt: 9, completed_at: "2026-05-26T18:10:00Z" },
          ],
        },
      ],
    };
    const m = computeSessionMetrics(session, 80);
    expect(m.volume_kg).toBe(30 * 9); // 270
  });
});

describe("findTopLift", () => {
  it("returns the highest e1RM lift", () => {
    const exercises: ExerciseSlot[] = [
      {
        block_code: "A1",
        exercise_id: "squat",
        exercise_name: "Squat barre",
        load_type: "barbell",
        target_sets: 3,
        target_reps_range: "5",
        target_rpe: 8,
        rest_seconds: 180,
        sets_logged: [
          { set_index: 1, weight_kg: 120, reps_done: 5, rpe_felt: 8, completed_at: "" },
        ],
      },
      {
        block_code: "B1",
        exercise_id: "bench",
        exercise_name: "Développé couché",
        load_type: "barbell",
        target_sets: 3,
        target_reps_range: "8",
        target_rpe: 8,
        rest_seconds: 120,
        sets_logged: [
          { set_index: 1, weight_kg: 90, reps_done: 8, rpe_felt: 9, completed_at: "" },
        ],
      },
    ];
    const top = findTopLift(exercises);
    expect(top?.exercise_name).toBe("Squat barre"); // 120 × (1 + 5/30) = 140, vs bench 90 × (1+8/30) ≈ 114
    expect(top?.weight_kg).toBe(120);
  });

  it("returns undefined if no sets logged", () => {
    expect(findTopLift([])).toBeUndefined();
  });
});

describe("appendSetLog", () => {
  const base: ExerciseSlot[] = [
    {
      block_code: "A1",
      exercise_id: "squat",
      exercise_name: "Squat",
      load_type: "barbell",
      target_sets: 3,
      target_reps_range: "5",
      target_rpe: 8,
      rest_seconds: 180,
      sets_logged: [],
    },
  ];

  it("appends a set to the matching exercise", () => {
    const result = appendSetLog(base, "squat", {
      set_index: 1,
      weight_kg: 100,
      reps_done: 5,
      rpe_felt: 7,
    });
    expect(result[0].sets_logged).toHaveLength(1);
    expect(result[0].sets_logged[0].weight_kg).toBe(100);
  });

  it("does not mutate input", () => {
    appendSetLog(base, "squat", { set_index: 1, weight_kg: 100, reps_done: 5, rpe_felt: 7 });
    expect(base[0].sets_logged).toHaveLength(0);
  });

  it("throws if exercise not found", () => {
    expect(() =>
      appendSetLog(base, "ghost", { set_index: 1, weight_kg: 100, reps_done: 5, rpe_felt: 7 }),
    ).toThrow("Exercise not found");
  });
});

describe("validateSetLogPayload", () => {
  const valid = {
    exercise_id: "squat",
    set_index: 1,
    weight_kg: 100,
    reps_done: 5,
    rpe_felt: 8,
  };
  it("accepts valid payload", () => {
    expect(validateSetLogPayload(valid)).toBeNull();
  });
  it("rejects missing exercise_id", () => {
    expect(validateSetLogPayload({ ...valid, exercise_id: "" })).toBe("exercise_id_missing");
  });
  it("rejects out-of-range weight", () => {
    expect(validateSetLogPayload({ ...valid, weight_kg: 700 })).toBe("weight_kg_invalid");
  });
  it("rejects out-of-range rpe", () => {
    expect(validateSetLogPayload({ ...valid, rpe_felt: 11 })).toBe("rpe_felt_invalid");
  });
  it("rejects non-object payload", () => {
    expect(validateSetLogPayload(null)).toBe("payload_not_object");
  });
});
