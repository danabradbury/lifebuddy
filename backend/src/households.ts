import { GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { randomUUID } from "crypto";

import { config } from "./config";
import { docClient } from "./db";
import {
  type Household,
  type HouseholdMember,
  HouseholdKeys,
  HouseholdMemberKeys,
  UserKeys,
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

/** Add a member to a household by email. Caller must already be a member of the household. */
export async function handleAddHouseholdMember(
  event: APIGatewayProxyEventV2,
  user: JwtPayload,
) {
  const householdId = event.pathParameters?.householdId;
  if (!householdId) {
    return badRequest("Household ID is required");
  }
  if (!event.body) {
    return badRequest("Missing body");
  }
  const body = JSON.parse(event.body) as { email?: string };
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email) {
    return badRequest("Email is required");
  }

  // Resolve user by email
  const userRes = await docClient.send(
    new GetCommand({
      TableName: config.tables.users,
      Key: {
        pk: UserKeys.pk(email),
        sk: UserKeys.sk(),
      },
    }),
  );
  const targetUser = userRes.Item as { userId: string } | undefined;
  if (!targetUser?.userId) {
    return json(404, { message: "User not found with that email" });
  }
  const targetUserId = targetUser.userId;

  if (targetUserId === user.sub) {
    return json(400, { message: "You are already a member" });
  }

  // Ensure caller is a member of this household
  const myMemberships = await docClient.send(
    new QueryCommand({
      TableName: config.tables.householdMembers,
      KeyConditionExpression: "pk = :pk AND sk = :sk",
      ExpressionAttributeValues: {
        ":pk": HouseholdMemberKeys.pk(user.sub),
        ":sk": HouseholdMemberKeys.sk(householdId),
      },
    }),
  );
  const myMembership = (myMemberships.Items || [])[0] as HouseholdMember | undefined;
  if (!myMembership) {
    return json(403, { message: "You are not a member of this household" });
  }

  // Check if target is already a member
  const existing = await docClient.send(
    new GetCommand({
      TableName: config.tables.householdMembers,
      Key: {
        pk: HouseholdMemberKeys.pk(targetUserId),
        sk: HouseholdMemberKeys.sk(householdId),
      },
    }),
  );
  if (existing.Item) {
    return json(409, { message: "That user is already a member of this household" });
  }

  const now = new Date().toISOString();
  const member: HouseholdMember = {
    householdId,
    userId: targetUserId,
    role: "member",
    joinedAt: now,
    householdName: myMembership.householdName,
  };

  await docClient.send(
    new PutCommand({
      TableName: config.tables.householdMembers,
      Item: {
        pk: HouseholdMemberKeys.pk(targetUserId),
        sk: HouseholdMemberKeys.sk(householdId),
        ...member,
      },
    }),
  );

  return json(201, { membership: member });
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
