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
import { type Goal, GoalKeys } from "./models";
import type { JwtPayload } from "./types";

export async function handleListGoals(
  _event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tables.goals,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": GoalKeys.pk(user.sub),
      },
    }),
  );
  const goals = (res.Items || []) as Goal[];
  return json(200, goals);
}

export async function handleCreateGoal(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  if (!event.body) {
    return badRequest("Missing body");
  }
  const body = JSON.parse(event.body) as Partial<Goal>;
  const {
    title,
    description,
    targetDate,
    status = "active",
    linkedTaskIds = [],
    linkedHabitIds = [],
  } = body;
  if (!title) {
    return badRequest("Goal title is required");
  }
  const now = new Date().toISOString();
  const goal: Goal = {
    goalId: randomUUID(),
    userId: user.sub,
    title,
    status,
    linkedTaskIds: linkedTaskIds ?? [],
    linkedHabitIds: linkedHabitIds ?? [],
    createdAt: now,
    updatedAt: now,
    ...(description !== undefined ? { description } : {}),
    ...(targetDate !== undefined ? { targetDate } : {}),
  };
  await docClient.send(
    new PutCommand({
      TableName: config.tables.goals,
      Item: {
        pk: GoalKeys.pk(user.sub),
        sk: GoalKeys.sk(goal.goalId),
        ...goal,
      },
    }),
  );
  return json(201, goal);
}

export async function handleGetGoal(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const goalId = event.pathParameters?.id;
  if (!goalId) {
    return badRequest("Missing goal id");
  }
  const res = await docClient.send(
    new GetCommand({
      TableName: config.tables.goals,
      Key: {
        pk: GoalKeys.pk(user.sub),
        sk: GoalKeys.sk(goalId),
      },
    }),
  );
  if (!res.Item) {
    return notFound("Goal not found");
  }
  return json(200, res.Item as Goal);
}

export async function handleUpdateGoal(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const goalId = event.pathParameters?.id;
  if (!goalId) {
    return badRequest("Missing goal id");
  }
  if (!event.body) {
    return badRequest("Missing body");
  }
  const body = JSON.parse(event.body) as Partial<Goal>;
  const updates: string[] = [];
  const values: Record<string, unknown> = {
    ":updatedAt": new Date().toISOString(),
  };
  if (body.title !== undefined) {
    updates.push("#title = :title");
    values[":title"] = body.title;
  }
  if (body.description !== undefined) {
    updates.push("description = :description");
    values[":description"] = body.description;
  }
  if (body.targetDate !== undefined) {
    updates.push("targetDate = :targetDate");
    values[":targetDate"] = body.targetDate;
  }
  if (body.status !== undefined) {
    updates.push("#status = :status");
    values[":status"] = body.status;
  }
  if (body.linkedTaskIds !== undefined) {
    updates.push("linkedTaskIds = :linkedTaskIds");
    values[":linkedTaskIds"] = body.linkedTaskIds;
  }
  if (body.linkedHabitIds !== undefined) {
    updates.push("linkedHabitIds = :linkedHabitIds");
    values[":linkedHabitIds"] = body.linkedHabitIds;
  }
  if (updates.length === 0) {
    return badRequest("No fields to update");
  }
  const res = await docClient.send(
    new UpdateCommand({
      TableName: config.tables.goals,
      Key: {
        pk: GoalKeys.pk(user.sub),
        sk: GoalKeys.sk(goalId),
      },
      UpdateExpression: `SET ${updates.join(", ")}, updatedAt = :updatedAt`,
      ExpressionAttributeValues: values,
      ExpressionAttributeNames: {
        "#title": "title",
        "#status": "status",
      },
      ReturnValues: "ALL_NEW",
    }),
  );
  return json(200, res.Attributes);
}

export async function handleDeleteGoal(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const goalId = event.pathParameters?.id;
  if (!goalId) {
    return badRequest("Missing goal id");
  }
  await docClient.send(
    new DeleteCommand({
      TableName: config.tables.goals,
      Key: {
        pk: GoalKeys.pk(user.sub),
        sk: GoalKeys.sk(goalId),
      },
    }),
  );
  return json(204, {});
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
