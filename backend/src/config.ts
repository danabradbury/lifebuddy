const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
};

export const config = {
  jwtSecret: required("JWT_SECRET"),
  tables: {
    users: required("TABLE_USERS"),
    habits: required("TABLE_HABITS"),
    habitCheckins: required("TABLE_HABIT_CHECKINS"),
    tasks: required("TABLE_TASKS"),
    taskCompletions: required("TABLE_TASK_COMPLETIONS"),
    goals: required("TABLE_GOALS"),
  },
};
