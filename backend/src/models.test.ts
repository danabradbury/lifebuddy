import { describe, expect, it } from "@jest/globals";
import { HabitKeys, HabitCheckinKeys, UserKeys } from "./models";

describe("DynamoDB key helpers", () => {
  it("builds user keys from email", () => {
    const email = "test@example.com";
    const pk = UserKeys.pk(email);
    const sk = UserKeys.sk();

    expect(pk).toBe(`USER#${email}`);
    expect(sk).toBe("PROFILE");
  });

  it("builds habit keys from user id and habit id", () => {
    const userId = "user-123";
    const habitId = "habit-456";

    const pk = HabitKeys.pk(userId);
    const sk = HabitKeys.sk(habitId);

    expect(pk).toBe(`USER#${userId}`);
    expect(sk).toBe(`HABIT#${habitId}`);
  });

  it("builds habit checkin keys from habit id and date", () => {
    const habitId = "habit-456";
    const date = "2026-03-05";

    const pk = HabitCheckinKeys.pk(habitId);
    const sk = HabitCheckinKeys.sk(date);

    expect(pk).toBe(`HABIT#${habitId}`);
    expect(sk).toBe(`DATE#${date}`);
  });
});
