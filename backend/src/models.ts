export type HabitFrequency = "daily" | "weekly" | "custom";

export type TimeOfDay = "morning" | "afternoon" | "evening" | "any";

export type HabitCheckinStatus = "done" | "snoozed" | "skipped";

export interface User {
  userId: string;
  email: string;
  passwordHash: string;
  createdAt: string;
}

export interface Habit {
  habitId: string;
  userId: string;
  name: string;
  description?: string;
  frequency: HabitFrequency;
  preferredTimeOfDay: TimeOfDay;
  reminderChannel?: "none" | "in_app" | "email";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HabitCheckin {
  habitId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  status: HabitCheckinStatus;
  reason?: string;
  createdAt: string;
}

// DynamoDB key helpers

export const UserKeys = {
  pk: (email: string) => `USER#${email}`,
  sk: () => "PROFILE",
};

export const HabitKeys = {
  pk: (userId: string) => `USER#${userId}`,
  sk: (habitId: string) => `HABIT#${habitId}`,
};

export const HabitCheckinKeys = {
  pk: (habitId: string) => `HABIT#${habitId}`,
  sk: (date: string) => `DATE#${date}`,
};
