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
import {
  handleCreateTask,
  handleCreateTaskCompletion,
  handleDeleteTask,
  handleGetTask,
  handleListTaskCompletions,
  handleListTasks,
  handleUpdateTask,
} from "./tasks";
import {
  handleCreateGoal,
  handleDeleteGoal,
  handleGetGoal,
  handleListGoals,
  handleUpdateGoal,
} from "./goals";
import { handleCreateHousehold, handleListHouseholds } from "./households";
import { handleHouseholdFocus } from "./households-focus";

export async function handler(
  event: APIGatewayProxyEventV2,
): Promise<APIGatewayProxyResultV2> {
  try {
    const path = event.rawPath || event.requestContext.http.path;
    const method = event.requestContext.http.method;

    if (path.endsWith("/health")) {
      return json(200, { ok: true, service: "lifebuddy-backend" });
    }

    if (path.endsWith("/auth/signup") && method === "POST") {
      return await handleSignup(event);
    }

    if (path.endsWith("/auth/login") && method === "POST") {
      return await handleLogin(event);
    }

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

    // /tasks and /tasks/{id} and /tasks/{id}/completions
    if (path.endsWith("/tasks") && method === "GET") {
      return await handleListTasks(event, user);
    }
    if (path.endsWith("/tasks") && method === "POST") {
      return await handleCreateTask(event, user);
    }
    const taskMatch = path.match(/\/tasks\/([^/]+)(?:\/(completions))?$/);
    if (taskMatch) {
      const [, taskId, subresource] = taskMatch;
      event.pathParameters = { ...(event.pathParameters ?? {}), id: taskId };
      if (!subresource) {
        if (method === "GET") {
          return await handleGetTask(event, user);
        }
        if (method === "PATCH") {
          return await handleUpdateTask(event, user);
        }
        if (method === "DELETE") {
          return await handleDeleteTask(event, user);
        }
      } else if (subresource === "completions") {
        if (method === "POST") {
          return await handleCreateTaskCompletion(event, user);
        }
        if (method === "GET") {
          return await handleListTaskCompletions(event, user);
        }
      }
    }

    // /goals and /goals/{id}
    if (path.endsWith("/goals") && method === "GET") {
      return await handleListGoals(event, user);
    }
    if (path.endsWith("/goals") && method === "POST") {
      return await handleCreateGoal(event, user);
    }
    const goalMatch = path.match(/\/goals\/([^/]+)$/);
    if (goalMatch) {
      const [, goalId] = goalMatch;
      event.pathParameters = { ...(event.pathParameters ?? {}), id: goalId };
      if (method === "GET") {
        return await handleGetGoal(event, user);
      }
      if (method === "PATCH") {
        return await handleUpdateGoal(event, user);
      }
      if (method === "DELETE") {
        return await handleDeleteGoal(event, user);
      }
    }

    // /households
    if (path.endsWith("/households") && method === "GET") {
      return await handleListHouseholds(event, user);
    }
    if (path.endsWith("/households") && method === "POST") {
      return await handleCreateHousehold(event, user);
    }

    if (path.endsWith("/households/focus") && method === "GET") {
      return await handleHouseholdFocus(event, user);
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
