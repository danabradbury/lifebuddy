import { PutCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

import { config } from "./config";
import { docClient } from "./db";
import { type User, UserKeys } from "./models";
import type { JwtPayload } from "./types";

export async function handleSignup(event: APIGatewayProxyEventV2) {
  console.log("handleSignup", event);
  if (!event.body) {
    return badRequest("Missing body");
  }
  const { email, password } = JSON.parse(event.body) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return badRequest("Email and password are required");
  }

  const existing = await docClient.send(
    new GetCommand({
      TableName: config.tables.users,
      Key: {
        pk: UserKeys.pk(email),
        sk: UserKeys.sk(),
      },
    }),
  );

  if (existing.Item) {
    return conflict("User already exists");
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user: User = {
    userId: randomUUID(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  await docClient.send(
    new PutCommand({
      TableName: config.tables.users,
      Item: {
        pk: UserKeys.pk(email),
        sk: UserKeys.sk(),
        ...user,
      },
      ConditionExpression: "attribute_not_exists(pk)",
    }),
  );

  const token = signToken(user);

  return json(201, {
    token,
    user: {
      userId: user.userId,
      email: user.email,
    },
  });
}

export async function handleLogin(event: APIGatewayProxyEventV2) {
  console.log("handleLogin", event);
  if (!event.body) {
    return badRequest("Missing body");
  }
  const { email, password } = JSON.parse(event.body) as {
    email?: string;
    password?: string;
  };

  if (!email || !password) {
    return badRequest("Email and password are required");
  }

  const result = await docClient.send(
    new GetCommand({
      TableName: config.tables.users,
      Key: {
        pk: UserKeys.pk(email),
        sk: UserKeys.sk(),
      },
    }),
  );

  if (!result.Item) {
    return unauthorized("Invalid email or password");
  }

  const user = result.Item as User;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return unauthorized("Invalid email or password");
  }

  const token = signToken(user);

  return json(200, {
    token,
    user: {
      userId: user.userId,
      email: user.email,
    },
  });
}

export function requireAuth(event: APIGatewayProxyEventV2): JwtPayload {
  console.log("requireAuth: ");
  const header = event.headers.authorization || event.headers.Authorization;
  if (!header) {
    throw unauthorizedError("Missing Authorization header");
  }

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) {
    throw unauthorizedError("Invalid Authorization header");
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as JwtPayload;
    return decoded;
  } catch {
    throw unauthorizedError("Invalid token");
  }
}

function signToken(user: User): string {
  const payload: JwtPayload = {
    sub: user.userId,
    email: user.email,
  };
  return jwt.sign(payload, config.jwtSecret, { expiresIn: "30d" });
}

// Simple HTTP helpers (duplicated here to avoid circular deps)

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

function unauthorized(message: string) {
  return json(401, { message });
}

function conflict(message: string) {
  return json(409, { message });
}

export class HttpError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function unauthorizedError(message: string) {
  return new HttpError(401, message);
}
