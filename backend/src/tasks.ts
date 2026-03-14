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
  type Task,
  type TaskCompletion,
  TaskCompletionKeys,
  TaskKeys,
} from "./models";
import type { JwtPayload } from "./types";

export async function handleListTasks(
  _event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tables.tasks,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": TaskKeys.pk(user.sub),
      },
    }),
  );
  const tasks = (res.Items || []) as Task[];
  return json(200, tasks);
}

export async function handleCreateTask(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  if (!event.body) {
    return badRequest("Missing body");
  }
  const body = JSON.parse(event.body) as Partial<Task>;
  const {
    title,
    description,
    dueDate,
    durationMinutes,
    recurrence,
    status = "pending",
  } = body;
  if (!title) {
    return badRequest("Task title is required");
  }
  const now = new Date().toISOString();
  const task: Task = {
    taskId: randomUUID(),
    userId: user.sub,
    title,
    status,
    createdAt: now,
    updatedAt: now,
    ...(description !== undefined ? { description } : {}),
    ...(dueDate !== undefined ? { dueDate } : {}),
    ...(durationMinutes !== undefined ? { durationMinutes } : {}),
    ...(recurrence !== undefined ? { recurrence } : {}),
  };
  await docClient.send(
    new PutCommand({
      TableName: config.tables.tasks,
      Item: {
        pk: TaskKeys.pk(user.sub),
        sk: TaskKeys.sk(task.taskId),
        ...task,
      },
    }),
  );
  return json(201, task);
}

export async function handleGetTask(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const taskId = event.pathParameters?.id;
  if (!taskId) {
    return badRequest("Missing task id");
  }
  const res = await docClient.send(
    new GetCommand({
      TableName: config.tables.tasks,
      Key: {
        pk: TaskKeys.pk(user.sub),
        sk: TaskKeys.sk(taskId),
      },
    }),
  );
  if (!res.Item) {
    return notFound("Task not found");
  }
  return json(200, res.Item as Task);
}

export async function handleUpdateTask(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const taskId = event.pathParameters?.id;
  if (!taskId) {
    return badRequest("Missing task id");
  }
  if (!event.body) {
    return badRequest("Missing body");
  }
  const body = JSON.parse(event.body) as Partial<Task>;
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
  if (body.dueDate !== undefined) {
    updates.push("dueDate = :dueDate");
    values[":dueDate"] = body.dueDate;
  }
  if (body.durationMinutes !== undefined) {
    updates.push("durationMinutes = :durationMinutes");
    values[":durationMinutes"] = body.durationMinutes;
  }
  if (body.recurrence !== undefined) {
    updates.push("recurrence = :recurrence");
    values[":recurrence"] = body.recurrence;
  }
  if (body.status !== undefined) {
    updates.push("#status = :status");
    values[":status"] = body.status;
  }
  if (updates.length === 0) {
    return badRequest("No fields to update");
  }
  const res = await docClient.send(
    new UpdateCommand({
      TableName: config.tables.tasks,
      Key: {
        pk: TaskKeys.pk(user.sub),
        sk: TaskKeys.sk(taskId),
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

export async function handleDeleteTask(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const taskId = event.pathParameters?.id;
  if (!taskId) {
    return badRequest("Missing task id");
  }
  await docClient.send(
    new DeleteCommand({
      TableName: config.tables.tasks,
      Key: {
        pk: TaskKeys.pk(user.sub),
        sk: TaskKeys.sk(taskId),
      },
    }),
  );
  return json(204, {});
}

export async function handleCreateTaskCompletion(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const taskId = event.pathParameters?.id;
  if (!taskId) {
    return badRequest("Missing task id");
  }
  const taskRes = await docClient.send(
    new GetCommand({
      TableName: config.tables.tasks,
      Key: {
        pk: TaskKeys.pk(user.sub),
        sk: TaskKeys.sk(taskId),
      },
    }),
  );
  if (!taskRes.Item) {
    return notFound("Task not found");
  }
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const completion: TaskCompletion = {
    taskId,
    userId: user.sub,
    completedAt: now.toISOString(),
    date,
  };
  await docClient.send(
    new PutCommand({
      TableName: config.tables.taskCompletions,
      Item: {
        pk: TaskCompletionKeys.pk(taskId),
        sk: TaskCompletionKeys.sk(date),
        ...completion,
      },
    }),
  );
  await docClient.send(
    new UpdateCommand({
      TableName: config.tables.tasks,
      Key: {
        pk: TaskKeys.pk(user.sub),
        sk: TaskKeys.sk(taskId),
      },
      UpdateExpression: "SET #status = :status, updatedAt = :updatedAt",
      ExpressionAttributeValues: {
        ":status": "done",
        ":updatedAt": now.toISOString(),
      },
      ExpressionAttributeNames: { "#status": "status" },
    }),
  );
  return json(201, completion);
}

export async function handleListTaskCompletions(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const taskId = event.pathParameters?.id;
  if (!taskId) {
    return badRequest("Missing task id");
  }
  const taskRes = await docClient.send(
    new GetCommand({
      TableName: config.tables.tasks,
      Key: {
        pk: TaskKeys.pk(user.sub),
        sk: TaskKeys.sk(taskId),
      },
    }),
  );
  if (!taskRes.Item) {
    return notFound("Task not found");
  }
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tables.taskCompletions,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": TaskCompletionKeys.pk(taskId),
      },
    }),
  );
  const items = (res.Items || []) as TaskCompletion[];
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
