import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "crypto";

import { config } from "./config";
import { docClient } from "./db";
import {
  type Household,
  type HouseholdMember,
  HouseholdKeys,
  HouseholdMemberKeys,
} from "./models";
import type { JwtPayload } from "./types";

export async function handleListHouseholds(
  _event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const res = await docClient.send(
    new QueryCommand({
      TableName: config.tables.householdMembers,
      KeyConditionExpression: "pk = :pk",
      ExpressionAttributeValues: {
        ":pk": HouseholdMemberKeys.pk(user.sub),
      },
    }),
  );

  const memberships = (res.Items || []) as HouseholdMember[];

  return json(200, memberships);
}

export async function handleCreateHousehold(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  if (!event.body) {
    return badRequest("Missing body");
  }
  const body = JSON.parse(event.body) as { name?: string };
  const { name } = body;
  if (!name || !name.trim()) {
    return badRequest("Household name is required");
  }

  const now = new Date().toISOString();
  const household: Household = {
    householdId: randomUUID(),
    name: name.trim(),
    createdAt: now,
    updatedAt: now,
  };

  const member: HouseholdMember = {
    householdId: household.householdId,
    userId: user.sub,
    role: "owner",
    joinedAt: now,
    householdName: household.name,
  };

  await docClient.send(
    new PutCommand({
      TableName: config.tables.households,
      Item: {
        pk: HouseholdKeys.pk(household.householdId),
        sk: HouseholdKeys.sk(),
        ...household,
      },
    }),
  );

  await docClient.send(
    new PutCommand({
      TableName: config.tables.householdMembers,
      Item: {
        pk: HouseholdMemberKeys.pk(user.sub),
        sk: HouseholdMemberKeys.sk(household.householdId),
        ...member,
      },
    }),
  );

  return json(201, {
    household,
    membership: member,
  });
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

