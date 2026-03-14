import { GetCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

import { config } from "./config";
import { docClient } from "./db";
import {
  type Habit,
  type HabitCheckin,
  type Task,
  HabitCheckinKeys,
  HabitKeys,
  TaskKeys,
} from "./models";
import type { JwtPayload } from "./types";

type HabitStatus = "pending" | "done" | "snoozed" | "skipped";

type HouseholdFocusEntry = {
  userId: string;
  email: string;
  habitsDueToday: { habitId: string; name: string; status: HabitStatus }[];
  tasksDueTodayOrOverdue: { taskId: string; title: string; dueDate?: string }[];
};

export async function handleHouseholdFocus(
  _event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const today = new Date().toISOString().slice(0, 10);

  // Phase 1: only the current user. Later we'll expand to all household members.
  const usersToInclude: JwtPayload[] = [user];

  const entries: HouseholdFocusEntry[] = [];

  for (const u of usersToInclude) {
    // Habits
    const habitsRes = await docClient.send(
      new QueryCommand({
        TableName: config.tables.habits,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": HabitKeys.pk(u.sub),
        },
      }),
    );
    const habits = (habitsRes.Items || []) as Habit[];

    const habitsDueToday: HouseholdFocusEntry["habitsDueToday"] = [];

    for (const habit of habits) {
      // For now, we consider all habits as "due today" and consult today's check-ins for status.
      const checkinsRes = await docClient.send(
        new QueryCommand({
          TableName: config.tables.habitCheckins,
          KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
          ExpressionAttributeValues: {
            ":pk": HabitCheckinKeys.pk(habit.habitId),
            ":sk": HabitCheckinKeys.sk(today),
          },
        }),
      );
      const checkins = (checkinsRes.Items || []) as HabitCheckin[];
      const todays = checkins.filter((c) => c.userId === u.sub);
      let status: HabitStatus = "pending";
      if (todays.length > 0) {
        status = todays[todays.length - 1]!.status as HabitStatus;
      }

      habitsDueToday.push({
        habitId: habit.habitId,
        name: habit.name,
        status,
      });
    }

    // Tasks
    const tasksRes = await docClient.send(
      new QueryCommand({
        TableName: config.tables.tasks,
        KeyConditionExpression: "pk = :pk",
        ExpressionAttributeValues: {
          ":pk": TaskKeys.pk(u.sub),
        },
      }),
    );
    const tasks = (tasksRes.Items || []) as Task[];

    const tasksDueTodayOrOverdue: HouseholdFocusEntry["tasksDueTodayOrOverdue"] =
      tasks
        .filter(
          (t) => t.status === "pending" && t.dueDate && t.dueDate <= today,
        )
        .map((t) => {
          const base = {
            taskId: t.taskId,
            title: t.title,
          };
          return t.dueDate !== undefined
            ? { ...base, dueDate: t.dueDate }
            : base;
        });

    entries.push({
      userId: u.sub,
      email: u.email,
      habitsDueToday,
      tasksDueTodayOrOverdue,
    });
  }

  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(entries),
  };
}

