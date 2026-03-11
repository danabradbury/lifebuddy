import {
  PutCommand,
  QueryCommand,
  UpdateCommand,
  DeleteCommand,
  GetCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "crypto";

import { config } from "./config";
import { docClient } from "./db";
import {
  type Habit,
  type HabitCheckin,
  HabitCheckinKeys,
  HabitKeys,
} from "./models";
import type { JwtPayload } from "./types";

export async function handleCreateHabit(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  if (!event.body) {
    return badRequest("Missing body");
  }

  const {
    name,
    description,
    frequency = "daily",
    preferredTimeOfDay = "any",
    reminderChannel = "in_app",
  } = JSON.parse(event.body) as Partial<Habit>;

  if (!name) {
    return badRequest("Habit name is required");
  }

  const now = new Date().toISOString();
  const base: Omit<Habit, "description" | "reminderChannel"> = {
    habitId: randomUUID(),
    userId: user.sub,
    name,
    frequency,
    preferredTimeOfDay,
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  const habit: Habit = {
    ...base,
    ...(description !== undefined ? { description } : {}),
    ...(reminderChannel !== undefined ? { reminderChannel } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: config.tables.habits,
      Item: {
        pk: HabitKeys.pk(user.sub),
        sk: HabitKeys.sk(habit.habitId),
        ...habit,
      },
    }),
  );

  return json(201, habit);
}

export async function handleListHabits(
  _event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tables.habits,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": HabitKeys.pk(user.sub),
      },
    }),
  );

  const habits = (res.Items || []) as Habit[];
  return json(200, habits);
}

export async function handleUpdateHabit(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const habitId = event.pathParameters?.id;
  if (!habitId) {
    return badRequest("Missing habit id");
  }
  if (!event.body) {
    return badRequest("Missing body");
  }
  const body = JSON.parse(event.body) as Partial<Habit>;

  const updates: string[] = [];
  const values: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
  };

  if (body.name !== undefined) {
    updates.push("#name = :name");
    values[":name"] = body.name;
  }
  if (body.description !== undefined) {
    updates.push("description = :description");
    values[":description"] = body.description;
  }
  if (body.frequency !== undefined) {
    updates.push("frequency = :frequency");
    values[":frequency"] = body.frequency;
  }
  if (body.preferredTimeOfDay !== undefined) {
    updates.push("preferredTimeOfDay = :preferredTimeOfDay");
    values[":preferredTimeOfDay"] = body.preferredTimeOfDay;
  }
  if (body.reminderChannel !== undefined) {
    updates.push("reminderChannel = :reminderChannel");
    values[":reminderChannel"] = body.reminderChannel;
  }
  if (body.isActive !== undefined) {
    updates.push("isActive = :isActive");
    values[":isActive"] = body.isActive;
  }

  if (!updates.length) {
    return badRequest("No fields to update");
  }

  const res = await docClient.send(
    new UpdateCommand({
      TableName: config.tables.habits,
      Key: {
        pk: HabitKeys.pk(user.sub),
        sk: HabitKeys.sk(habitId),
      },
      UpdateExpression: `SET ${updates.join(", ")}, updatedAt = :updatedAt`,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: {
        "#name": "name",
      },
      ReturnValues: "ALL_NEW",
    }),
  );

  return json(200, res.Attributes);
}

export async function handleDeleteHabit(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const habitId = event.pathParameters?.id;
  if (!habitId) {
    return badRequest("Missing habit id");
  }

  await docClient.send(
    new DeleteCommand({
      TableName: config.tables.habits,
      Key: {
        pk: HabitKeys.pk(user.sub),
        sk: HabitKeys.sk(habitId),
      },
    }),
  );

  return json(204, {});
}

export async function handleCreateCheckin(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const habitId = event.pathParameters?.id;
  if (!habitId) {
    return badRequest("Missing habit id");
  }
  if (!event.body) {
    return badRequest("Missing body");
  }

  const { status, reason, date } = JSON.parse(event.body) as {
    status?: HabitCheckin["status"];
    reason?: string;
    date?: string;
  };

  if (!status) {
    return badRequest("status is required");
  }

  const today = date ?? new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Ensure habit belongs to user
  const habit = await docClient.send(
    new GetCommand({
      TableName: config.tables.habits,
      Key: {
        pk: HabitKeys.pk(user.sub),
        sk: HabitKeys.sk(habitId),
      },
    }),
  );
  if (!habit.Item) {
    return notFound("Habit not found");
  }

  const base: Omit<HabitCheckin, "reason"> = {
    habitId,
    userId: user.sub,
    date: today,
    status,
    createdAt: new Date().toISOString(),
  };

  const checkin: HabitCheckin = {
    ...base,
    ...(reason !== undefined ? { reason } : {}),
  };

  await docClient.send(
    new PutCommand({
      TableName: config.tables.habitCheckins,
      Item: {
        pk: HabitCheckinKeys.pk(habitId),
        sk: HabitCheckinKeys.sk(today),
        ...checkin,
      },
    }),
  );

  return json(201, checkin);
}

export async function handleListCheckinsForToday(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const habitId = event.pathParameters?.id;
  if (!habitId) {
    return badRequest("Missing habit id");
  }

  const today = new Date().toISOString().slice(0, 10);

  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tables.habitCheckins,
      KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
      ExpressionAttributeValues: {
        ":pk": HabitCheckinKeys.pk(habitId),
        ":sk": HabitCheckinKeys.sk(today),
      },
    }),
  );

  const items = (res.Items || []) as HabitCheckin[];
  // Filter by user id to be safe
  const filtered = items.filter((c) => c.userId === user.sub);

  return json(200, filtered);
}

function json(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function badRequest(message: string) {
  return json(400, { message });
}

function notFound(message: string) {
  return json(404, { message });
}
