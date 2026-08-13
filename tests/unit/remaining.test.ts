import { describe, expect, it } from "vitest";
import { formatRemaining } from "../../src/ui/formatRemaining";

describe("formatRemaining", () => {
  it("2日3時間4分の差分を正確に分解する", () => {
    const now = Date.parse("2026-08-13T10:00:00.000Z");
    const targetAt = "2026-08-15T13:04:00.000Z";
    expect(formatRemaining(targetAt, now)).toEqual({
      days: 2,
      hours: 3,
      minutes: 4,
      overdue: false,
    });
  });

  it("目標ちょうどで overdue になる", () => {
    const now = Date.parse("2026-08-13T10:00:00.000Z");
    expect(formatRemaining("2026-08-13T10:00:00.000Z", now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      overdue: true,
    });
  });

  it("目標超過で overdue になる", () => {
    const now = Date.parse("2026-08-13T10:00:01.000Z");
    expect(formatRemaining("2026-08-13T10:00:00.000Z", now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      overdue: true,
    });
  });

  it("1分未満は 0分として切り捨てる", () => {
    const now = Date.parse("2026-08-13T10:00:00.000Z");
    expect(formatRemaining("2026-08-13T10:00:59.000Z", now)).toEqual({
      days: 0,
      hours: 0,
      minutes: 0,
      overdue: false,
    });
  });
});
