export type HabitFrequency = "daily" | "weekly" | "monthly" | "custom";

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
  /** 0–6 (Sun–Sat) for weekly; required when frequency is weekly */
  dayOfWeek?: number;
  /** 1–31 for monthly; required when frequency is monthly */
  dayOfMonth?: number;
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

export type TaskStatus = "pending" | "done" | "cancelled";

export interface Task {
  taskId: string;
  userId: string;
  title: string;
  description?: string;
  dueDate?: string; // YYYY-MM-DD
  durationMinutes?: number;
  /** Recurrence: e.g. { unit: "months", value: 6 } for every 6 months */
  recurrence?: { unit: "days" | "months"; value: number };
  status: TaskStatus;
  createdAt: string;
  updatedAt: string;
}

export interface TaskCompletion {
  taskId: string;
  userId: string;
  completedAt: string; // ISO
  date: string; // YYYY-MM-DD for easy query
}

export interface Goal {
  goalId: string;
  userId: string;
  title: string;
  description?: string;
  targetDate?: string; // YYYY-MM-DD
  status: "active" | "completed" | "paused";
  linkedTaskIds: string[];
  linkedHabitIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Household {
  householdId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdMember {
  householdId: string;
  userId: string;
  role: "owner" | "member";
  joinedAt: string;
  householdName: string;
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

export const TaskKeys = {
  pk: (userId: string) => `USER#${userId}`,
  sk: (taskId: string) => `TASK#${taskId}`,
};

export const TaskCompletionKeys = {
  pk: (taskId: string) => `TASK#${taskId}`,
  sk: (date: string) => `DATE#${date}`,
};

export const GoalKeys = {
  pk: (userId: string) => `USER#${userId}`,
  sk: (goalId: string) => `GOAL#${goalId}`,
};

export const HouseholdKeys = {
  pk: (householdId: string) => `HOUSEHOLD#${householdId}`,
  sk: () => "META",
};

export const HouseholdMemberKeys = {
  pk: (userId: string) => `USER#${userId}`,
  sk: (householdId: string) => `HOUSEHOLD#${householdId}`,
};
