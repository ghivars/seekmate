import { describe, expect, it } from "vitest";
import { buildIntro, EXTRA_PHRASES, swapGoal, toggleExtra } from "./intro";

const me = { display_name: "Dewi", major: "Informatika", cohort_year: 2026 };

describe("intro template", () => {
  it("fills the template", () => {
    expect(buildIntro(me, "exam_prep")).toBe(
      "Halo, aku Dewi, Informatika angkatan 2026. Aku mau belajar untuk persiapan ujian di mata kuliah ini.",
    );
  });
  it("leaves out missing profile parts", () => {
    expect(buildIntro({ display_name: "Dewi", major: "", cohort_year: null }, "just_connect")).toBe(
      "Halo, aku Dewi. Aku mau belajar sambil kenalan di mata kuliah ini.",
    );
  });
  it("swaps the goal without losing edits", () => {
    const edited = buildIntro(me, "exam_prep").replace("Halo", "Hai");
    expect(swapGoal(edited, "just_connect")).toContain("Hai, aku Dewi");
    expect(swapGoal(edited, "just_connect")).toContain("sambil kenalan");
    expect(swapGoal("Teks sendiri", "just_connect")).toBe("Teks sendiri");
  });
  it("toggles extra sentences", () => {
    const phrase = EXTRA_PHRASES[0]!;
    const once = toggleExtra("Halo.", phrase);
    expect(once).toBe(`Halo. ${phrase}`);
    expect(toggleExtra(once, phrase)).toBe("Halo.");
  });
});
