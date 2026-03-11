import type {
  APIGatewayProxyEventV2,
  APIGatewayProxyResultV2,
} from "aws-lambda";

import { handleLogin, handleSignup, requireAuth, HttpError } from "./auth";
import {
  handleCreateHabit,
  handleCreateCheckin,
  handleDeleteHabit,
  handleListCheckinsForToday,
  handleListHabits,
  handleUpdateHabit,
} from "./habits";
import { config } from "./config";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    console.log("does this even log?");
    console.log("event: ", JSON.stringify(event, null, 2));
    // lets log out the jwt secret
    console.log("jwt secret: ", config.jwtSecret);
    const path = event.rawPath || event.requestContext.http.path;
    const method = event.requestContext.http.method;

    console.log("path: ", path);
    console.log("method: ", method);

    if (path.endsWith("/health")) {
      return json(200, { ok: true, service: "lifebuddy-backend" });
    }

    if (path.endsWith("/auth/signup") && method === "POST") {
      return await handleSignup(event);
    }

    if (path.endsWith("/auth/login") && method === "POST") {
      return await handleLogin(event);
    }
    console.log(
      "The path was not signup or login, call require login: path: ",
      path,
    );

    // Routes below require auth
    const user = requireAuth(event);

    if (path.endsWith("/habits") && method === "GET") {
      return await handleListHabits(event, user);
    }

    if (path.endsWith("/habits") && method === "POST") {
      return await handleCreateHabit(event, user);
    }

    // /habits/{id} and /habits/{id}/checkins
    // Allow an optional stage prefix (e.g. "/dev/habits/...") by not anchoring at the start.
    const habitIdMatch = path.match(/\/habits\/([^/]+)(?:\/(checkins))?$/);
    if (habitIdMatch) {
      const [, habitId, subresource] = habitIdMatch;
      event.pathParameters = { ...(event.pathParameters ?? {}), id: habitId };

      if (!subresource) {
        if (method === "PATCH") {
          return await handleUpdateHabit(event, user);
        }
        if (method === "DELETE") {
          return await handleDeleteHabit(event, user);
        }
      } else if (subresource === "checkins") {
        if (method === "POST") {
          return await handleCreateCheckin(event, user);
        }
        if (method === "GET") {
          return await handleListCheckinsForToday(event, user);
        }
      }
    }

    return json(404, { message: "Not Found" });
  } catch (err) {
    console.error("handler error", err);
    if (err instanceof HttpError) {
      return json(err.statusCode, { message: err.message });
    }
    return json(500, { message: "Internal Server Error" });
  }
}

function json(statusCode: number, body: unknown): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}
