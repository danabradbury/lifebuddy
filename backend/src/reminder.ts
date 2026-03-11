import { ScanCommand } from "@aws-sdk/lib-dynamodb";

import { config } from "./config";
import { docClient } from "./db";
import type { Habit } from "./models";

type ReminderEvent = {
  // EventBridge scheduled event shape (not used in MVP)
  id: string;
};

export async function handler(_event: ReminderEvent) {
  // Simple MVP: scan habits and log which ones are active.
  // Later we can filter by preferred time of day and last check-in.
  const res = await docClient.send(
    new ScanCommand({
      TableName: config.tables.habits,
      Limit: 25,
    }),
  );

  const habits = (res.Items || []) as Habit[];

  console.log(
    `Reminder tick: found ${habits.length} habits to consider for notifications`,
  );

  return {
    ok: true,
    considered: habits.length,
  };
}
