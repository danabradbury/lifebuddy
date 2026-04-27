import React, { useCallback, useEffect, useMemo, useState } from "react";
import "./style.css";

type HabitFrequency = "daily" | "weekly" | "monthly";

type Habit = {
  habitId: string;
  name: string;
  description?: string;
  frequency?: HabitFrequency;
  preferredTimeOfDay: "morning" | "afternoon" | "evening" | "any";
  dayOfWeek?: number;
  dayOfMonth?: number;
  isActive: boolean;
};

type HabitStatus = "pending" | "done" | "snoozed" | "skipped";

type HabitWithStatus = Habit & { status: HabitStatus };

type Task = {
  taskId: string;
  title: string;
  description?: string;
  dueDate?: string;
  durationMinutes?: number;
  status: "pending" | "done" | "cancelled";
};

type Goal = {
  goalId: string;
  title: string;
  description?: string;
  targetDate?: string;
  status: string;
  linkedTaskIds: string[];
  linkedHabitIds: string[];
};

type AuthState = {
  token: string;
  email: string;
} | null;

type TabId = "focus" | "habits" | "tasks" | "goals" | "household";

type HouseholdMembership = {
  householdId: string;
  householdName: string;
  role: string;
  joinedAt: string;
};

type HouseholdFocusEntry = {
  userId: string;
  email: string;
  habitsDueToday: { habitId: string; name: string; status: HabitStatus }[];
  tasksDueTodayOrOverdue: { taskId: string; title: string; dueDate?: string }[];
};

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;

function isHabitDueToday(habit: HabitWithStatus, dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  const freq = habit.frequency ?? "daily";
  if (freq === "daily") return true;
  if (freq === "weekly" && habit.dayOfWeek !== undefined) {
    return d.getDay() === habit.dayOfWeek;
  }
  if (freq === "monthly" && habit.dayOfMonth !== undefined) {
    return d.getDate() === habit.dayOfMonth;
  }
  return true;
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [tab, setTab] = useState<TabId>("focus");
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = API_BASE ?? "";
  const today = todayStr();
  const isKiosk =
    typeof window !== "undefined" &&
    window.location.pathname.toLowerCase().endsWith("/kiosk");
  const [householdFocus, setHouseholdFocus] = useState<HouseholdFocusEntry[]>(
    [],
  );
  const [selectedHouseholdUser, setSelectedHouseholdUser] = useState<
    string | "all"
  >("all");
  const [households, setHouseholds] = useState<HouseholdMembership[]>([]);
  const [addMemberEmail, setAddMemberEmail] = useState<Record<string, string>>(
    {},
  );
  const [addMemberLoading, setAddMemberLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const stored = window.localStorage.getItem("lifebuddy-auth");
    if (stored) {
      const parsed = JSON.parse(stored) as AuthState;
      setAuth(parsed);
    }
  }, []);

  const loadHabits = useCallback(async () => {
    if (!auth) return;
    const res = await fetch(`${apiBase}/habits`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error("Failed to load habits");
    const data = (await res.json()) as Habit[];
    const withStatus: HabitWithStatus[] = [];
    for (const habit of data) {
      try {
        const checkinsRes = await fetch(
          `${apiBase}/habits/${habit.habitId}/checkins`,
          { headers: { Authorization: `Bearer ${auth.token}` } },
        );
        let status: HabitStatus = "pending";
        if (checkinsRes.ok) {
          const checkins = (await checkinsRes.json()) as {
            status: HabitStatus;
          }[];
          if (checkins.length > 0)
            status = checkins[checkins.length - 1]!.status;
        }
        withStatus.push({ ...habit, status });
      } catch {
        withStatus.push({ ...habit, status: "pending" });
      }
    }
    setHabits(withStatus);
  }, [auth, apiBase]);

  const loadTasks = useCallback(async () => {
    if (!auth) return;
    const res = await fetch(`${apiBase}/tasks`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error("Failed to load tasks");
    const data = (await res.json()) as Task[];
    setTasks(data);
  }, [auth, apiBase]);

  const loadGoals = useCallback(async () => {
    if (!auth) return;
    const res = await fetch(`${apiBase}/goals`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error("Failed to load goals");
    const data = (await res.json()) as Goal[];
    setGoals(data);
  }, [auth, apiBase]);

  const loadHouseholdFocus = useCallback(async () => {
    if (!auth) return;
    const res = await fetch(`${apiBase}/households/focus`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error("Failed to load household focus");
    const data = (await res.json()) as HouseholdFocusEntry[];
    setHouseholdFocus(data);
  }, [auth, apiBase]);

  const loadHouseholds = useCallback(async () => {
    if (!auth) return;
    const res = await fetch(`${apiBase}/households`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    if (!res.ok) throw new Error("Failed to load households");
    const data = (await res.json()) as HouseholdMembership[];
    setHouseholds(data);
  }, [auth, apiBase]);

  useEffect(() => {
    if (!auth) return;
    setLoading(true);
    setError(null);
    Promise.all([loadHabits(), loadTasks(), loadGoals()])
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, [auth, loadHabits, loadTasks, loadGoals]);

  useEffect(() => {
    if (!auth || !isKiosk) return;
    void loadHouseholdFocus();
    const id = window.setInterval(() => {
      void loadHouseholdFocus();
    }, 60000);
    return () => window.clearInterval(id);
  }, [auth, isKiosk, loadHouseholdFocus]);

  useEffect(() => {
    if (!auth || tab !== "household") return;
    void loadHouseholds();
  }, [auth, tab, loadHouseholds]);

  const groupedHabits = useMemo(() => {
    const groups: Record<string, HabitWithStatus[]> = {
      morning: [],
      afternoon: [],
      evening: [],
      any: [],
    };
    for (const h of habits) {
      groups[h.preferredTimeOfDay ?? "any"].push(h);
    }
    return groups;
  }, [habits]);

  const habitsDueToday = useMemo(
    () => habits.filter((h) => isHabitDueToday(h, today)),
    [habits, today],
  );
  const pendingHabitsDueToday = useMemo(
    () => habitsDueToday.filter((h) => h.status === "pending"),
    [habitsDueToday],
  );
  const pendingTasks = useMemo(
    () => tasks.filter((t) => t.status === "pending"),
    [tasks],
  );
  const tasksOverdue = useMemo(
    () => pendingTasks.filter((t) => t.dueDate && t.dueDate < today),
    [pendingTasks, today],
  );
  const tasksDueToday = useMemo(
    () => pendingTasks.filter((t) => t.dueDate === today),
    [pendingTasks, today],
  );
  const nextUpHabits = useMemo(
    () => pendingHabitsDueToday.slice(0, 3),
    [pendingHabitsDueToday],
  );
  const nextUpTasks = useMemo(
    () => [...tasksOverdue, ...tasksDueToday].slice(0, 3),
    [tasksOverdue, tasksDueToday],
  );

  async function handleAuth(path: "login" | "signup") {
    if (!apiBase) {
      setError("API base not configured");
      return;
    }
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/auth/${path}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Auth failed");
      const next: AuthState = {
        token: body.token,
        email: body.user.email,
      };
      setAuth(next);
      window.localStorage.setItem("lifebuddy-auth", JSON.stringify(next));
      setPassword("");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function updateHabitStatus(
    habit: HabitWithStatus,
    status: Exclude<HabitStatus, "pending">,
  ) {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(`${apiBase}/habits/${habit.habitId}/checkins`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({ status }),
      });
      setHabits((prev) =>
        prev.map((h) => (h.habitId === habit.habitId ? { ...h, status } : h)),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function completeTask(task: Task) {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      await fetch(`${apiBase}/tasks/${task.taskId}/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${auth.token}`,
        },
        body: JSON.stringify({}),
      });
      setTasks((prev) =>
        prev.map((t) =>
          t.taskId === task.taskId ? { ...t, status: "done" as const } : t,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function addHouseholdMember(householdId: string) {
    if (!auth) return;
    const email = (addMemberEmail[householdId] ?? "").trim().toLowerCase();
    if (!email) {
      setError("Enter an email address");
      return;
    }
    setAddMemberLoading((prev) => ({ ...prev, [householdId]: true }));
    setError(null);
    try {
      const res = await fetch(
        `${apiBase}/households/${householdId}/members`,
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
            Authorization: `Bearer ${auth.token}`,
          },
          body: JSON.stringify({ email }),
        },
      );
      const body = (await res.json()) as { message?: string };
      if (!res.ok) throw new Error(body.message ?? "Failed to add member");
      setAddMemberEmail((prev) => ({ ...prev, [householdId]: "" }));
      void loadHouseholds();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAddMemberLoading((prev) => ({ ...prev, [householdId]: false }));
    }
  }

  if (!auth) {
    return (
      <div className="page">
        <div className="auth-card">
          <h1>Lifebuddy</h1>
          <p className="subtitle">
            Your stubborn habit coach for things you keep forgetting.
          </p>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="auth-actions">
            <button disabled={loading} onClick={() => void handleAuth("login")}>
              Log in
            </button>
            <button
              className="secondary"
              disabled={loading}
              onClick={() => void handleAuth("signup")}
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasNextUp = nextUpHabits.length > 0 || nextUpTasks.length > 0;

  if (isKiosk) {
    const visibleEntries =
      selectedHouseholdUser === "all"
        ? householdFocus
        : householdFocus.filter((e) => e.userId === selectedHouseholdUser);

    return (
      <div className="page">
        <header className="header">
          <div>
            <h1>Focus</h1>
            <p className="subtitle">
              Habits due today and tasks due or overdue.
            </p>
          </div>
          <div className="header-actions">
            <nav className="tabs">
              <button
                type="button"
                className={selectedHouseholdUser === "all" ? "active" : ""}
                onClick={() => setSelectedHouseholdUser("all")}
              >
                All
              </button>
              {householdFocus.map((e) => (
                <button
                  key={e.userId}
                  type="button"
                  className={selectedHouseholdUser === e.userId ? "active" : ""}
                  onClick={() => setSelectedHouseholdUser(e.userId)}
                >
                  {e.email}
                </button>
              ))}
            </nav>
          </div>
        </header>

        {error && <p className="error">{error}</p>}
        {loading && <p className="subtitle">Loading…</p>}

        {visibleEntries.length === 0 ? (
          <p className="subtitle">No household focus data yet.</p>
        ) : (
          visibleEntries.map((entry) => (
            <section key={entry.userId} className="habit-groups">
              <h2>{entry.email} – Next up</h2>
              <div className="cards">
                {entry.habitsDueToday.map((h) => (
                  <div key={h.habitId} className="card habit-card">
                    <h3>{h.name}</h3>
                    {h.status === "done" && (
                      <p className="description">Completed for today</p>
                    )}
                  </div>
                ))}
                {entry.tasksDueTodayOrOverdue.map((t) => (
                  <div key={t.taskId} className="card task-card">
                    <h3>{t.title}</h3>
                    {t.dueDate && (
                      <p className="description">Due {t.dueDate}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="page">
      {hasNextUp && (
        <div className="nag-bar">
          <strong>Next up:</strong>{" "}
          {[
            ...nextUpHabits.map((h) => h.name),
            ...nextUpTasks.map((t) => t.title),
          ]
            .slice(0, 4)
            .join(", ")}{" "}
          — do one before you leave.
        </div>
      )}

      <header className="header">
        <div>
          <h1>Lifebuddy</h1>
          <p className="subtitle">Habits, tasks, and goals in one place.</p>
        </div>
        <div className="header-actions">
          <nav className="tabs">
            <button
              type="button"
              className={tab === "focus" ? "active" : ""}
              onClick={() => setTab("focus")}
            >
              Focus
            </button>
            <button
              type="button"
              className={tab === "habits" ? "active" : ""}
              onClick={() => setTab("habits")}
            >
              Habits
            </button>
            <button
              type="button"
              className={tab === "tasks" ? "active" : ""}
              onClick={() => setTab("tasks")}
            >
              Tasks
            </button>
            <button
              type="button"
              className={tab === "goals" ? "active" : ""}
              onClick={() => setTab("goals")}
            >
              Goals
            </button>
            <button
              type="button"
              className={tab === "household" ? "active" : ""}
              onClick={() => setTab("household")}
            >
              Household
            </button>
          </nav>
          <span className="user-email">{auth.email}</span>
          <button
            className="secondary"
            onClick={() => {
              setAuth(null);
              window.localStorage.removeItem("lifebuddy-auth");
            }}
          >
            Log out
          </button>
        </div>
      </header>

      {error && <p className="error">{error}</p>}
      {loading && <p className="subtitle">Loading…</p>}

      {tab === "focus" && (
        <>
          <section className="next-up">
            <h2>Focus — Today</h2>
            <p className="subtitle">
              Habits due today and tasks due or overdue.
            </p>
            {pendingHabitsDueToday.length === 0 && nextUpTasks.length === 0 ? (
              <p>Nothing due right now. Nice work.</p>
            ) : (
              <div className="cards">
                {pendingHabitsDueToday.map((habit) => (
                  <HabitCard
                    key={habit.habitId}
                    habit={habit}
                    onAction={updateHabitStatus}
                  />
                ))}
                {nextUpTasks.map((task) => (
                  <div key={task.taskId} className="card task-card">
                    <div>
                      <h3>{task.title}</h3>
                      {task.durationMinutes != null && (
                        <p className="description">
                          {task.durationMinutes} min
                        </p>
                      )}
                      {task.dueDate && (
                        <p className="description">
                          Due {task.dueDate}
                          {task.dueDate < today ? " (overdue)" : ""}
                        </p>
                      )}
                    </div>
                    <div className="habit-actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() => void completeTask(task)}
                      >
                        Done
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
          {habitsDueToday.length > 0 && (
            <section className="habit-groups">
              <h2>All habits due today</h2>
              <div className="cards">
                {habitsDueToday.map((h) => (
                  <HabitCard
                    key={h.habitId}
                    habit={h}
                    onAction={updateHabitStatus}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {tab === "habits" && (
        <>
          <section className="create-habit">
            <CreateHabitForm
              onCreated={(habit) => {
                setHabits((prev) => [
                  { ...habit, status: "pending" as const },
                  ...prev,
                ]);
              }}
              apiBase={apiBase}
              token={auth.token}
              setError={setError}
            />
          </section>
          <section className="next-up">
            <h2>Next up</h2>
            {nextUpHabits.length === 0 ? (
              <p>No pending habits.</p>
            ) : (
              <div className="cards">
                {nextUpHabits.map((habit) => (
                  <HabitCard
                    key={habit.habitId}
                    habit={habit}
                    onAction={updateHabitStatus}
                  />
                ))}
              </div>
            )}
          </section>
          <section className="habit-groups">
            <HabitGroup
              title="Morning"
              habits={groupedHabits.morning}
              onAction={updateHabitStatus}
            />
            <HabitGroup
              title="Afternoon"
              habits={groupedHabits.afternoon}
              onAction={updateHabitStatus}
            />
            <HabitGroup
              title="Evening"
              habits={groupedHabits.evening}
              onAction={updateHabitStatus}
            />
            <HabitGroup
              title="Any time"
              habits={groupedHabits.any}
              onAction={updateHabitStatus}
            />
          </section>
        </>
      )}

      {tab === "tasks" && (
        <>
          <section className="create-habit">
            <CreateTaskForm
              apiBase={apiBase}
              token={auth.token}
              setError={setError}
              onCreated={(task) => setTasks((prev) => [task, ...prev])}
            />
          </section>
          <section className="habit-groups">
            {tasksOverdue.length > 0 && (
              <>
                <h2>Overdue</h2>
                <div className="cards">
                  {tasksOverdue.map((t) => (
                    <TaskCard
                      key={t.taskId}
                      task={t}
                      onComplete={() => void completeTask(t)}
                    />
                  ))}
                </div>
              </>
            )}
            {tasksDueToday.length > 0 && (
              <>
                <h2>Due today</h2>
                <div className="cards">
                  {tasksDueToday.map((t) => (
                    <TaskCard
                      key={t.taskId}
                      task={t}
                      onComplete={() => void completeTask(t)}
                    />
                  ))}
                </div>
              </>
            )}
            <h2>All tasks</h2>
            {pendingTasks.length === 0 ? (
              <p>No pending tasks.</p>
            ) : (
              <div className="cards">
                {pendingTasks.map((t) => (
                  <TaskCard
                    key={t.taskId}
                    task={t}
                    onComplete={() => void completeTask(t)}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "goals" && (
        <>
          <section className="create-habit">
            <CreateGoalForm
              apiBase={apiBase}
              token={auth.token}
              setError={setError}
              onCreated={(goal) => setGoals((prev) => [goal, ...prev])}
            />
          </section>
          <section className="habit-groups">
            <h2>Goals</h2>
            {goals.length === 0 ? (
              <p>No goals yet.</p>
            ) : (
              <div className="cards">
                {goals.map((g) => (
                  <div key={g.goalId} className="card habit-card">
                    <h3>{g.title}</h3>
                    {g.targetDate && (
                      <p className="description">Target: {g.targetDate}</p>
                    )}
                    {g.linkedTaskIds.length + g.linkedHabitIds.length > 0 && (
                      <p className="description">
                        {g.linkedTaskIds.length} tasks,{" "}
                        {g.linkedHabitIds.length} habits linked
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {tab === "household" && (
        <>
          <section className="habit-groups">
            <h2>Households</h2>
            {households.length === 0 ? (
              <p>You’re not in any household yet. Create one via API or add yourself manually in DynamoDB.</p>
            ) : (
              <div className="cards">
                {households.map((h) => (
                  <div key={h.householdId} className="card habit-card">
                    <h3>{h.householdName}</h3>
                    <p className="description">Your role: {h.role}</p>
                    <div className="habit-actions" style={{ marginTop: 8 }}>
                      <input
                        type="email"
                        placeholder="Member email"
                        value={addMemberEmail[h.householdId] ?? ""}
                        onChange={(e) =>
                          setAddMemberEmail((prev) => ({
                            ...prev,
                            [h.householdId]: e.target.value,
                          }))
                        }
                        style={{ marginRight: 8 }}
                      />
                      <button
                        type="button"
                        className="primary"
                        disabled={addMemberLoading[h.householdId]}
                        onClick={() => void addHouseholdMember(h.householdId)}
                      >
                        {addMemberLoading[h.householdId] ? "Adding…" : "Add member"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
};

type HabitCardProps = {
  habit: HabitWithStatus;
  onAction: (
    habit: HabitWithStatus,
    status: Exclude<HabitStatus, "pending">,
  ) => void;
};

const HabitCard: React.FC<HabitCardProps> = ({ habit, onAction }) => {
  const isDone = habit.status === "done";
  return (
    <div className={`card habit-card status-${habit.status}`}>
      <div>
        <h3>{habit.name}</h3>
        {habit.description && (
          <p className="description">{habit.description}</p>
        )}
        {isDone && <p className="description">Completed for today</p>}
      </div>
      <div className="habit-actions">
        <button
          type="button"
          onClick={() => onAction(habit, "done")}
          className="primary"
          disabled={isDone}
        >
          Done
        </button>
        <button
          type="button"
          onClick={() => onAction(habit, "snoozed")}
          className="secondary"
        >
          Snooze
        </button>
        <button
          type="button"
          onClick={() => onAction(habit, "skipped")}
          className="ghost"
        >
          Skip
        </button>
      </div>
    </div>
  );
};

type HabitGroupProps = {
  title: string;
  habits: HabitWithStatus[];
  onAction: HabitCardProps["onAction"];
};

const HabitGroup: React.FC<HabitGroupProps> = ({ title, habits, onAction }) => {
  if (!habits.length) return null;
  return (
    <section>
      <h2>{title}</h2>
      <div className="cards">
        {habits.map((h) => (
          <HabitCard key={h.habitId} habit={h} onAction={onAction} />
        ))}
      </div>
    </section>
  );
};

const TaskCard: React.FC<{
  task: Task;
  onComplete: () => void;
}> = ({ task, onComplete }) => {
  if (task.status === "done") return null;
  return (
    <div className="card task-card">
      <div>
        <h3>{task.title}</h3>
        {task.description && <p className="description">{task.description}</p>}
        {task.durationMinutes != null && (
          <p className="description">{task.durationMinutes} min</p>
        )}
        {task.dueDate && (
          <p className="description">
            Due {task.dueDate}
            {task.dueDate < todayStr() ? " (overdue)" : ""}
          </p>
        )}
      </div>
      <div className="habit-actions">
        <button type="button" className="primary" onClick={onComplete}>
          Done
        </button>
      </div>
    </div>
  );
};

const CreateHabitForm: React.FC<{
  apiBase: string;
  token: string;
  onCreated: (habit: Habit) => void;
  setError: (m: string | null) => void;
}> = ({ apiBase, token, onCreated, setError }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<HabitFrequency>("daily");
  const [timeOfDay, setTimeOfDay] =
    useState<Habit["preferredTimeOfDay"]>("any");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Habit name is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/habits`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          frequency,
          preferredTimeOfDay: timeOfDay,
          reminderChannel: "in_app",
          ...(frequency === "weekly" ? { dayOfWeek } : {}),
          ...(frequency === "monthly" ? { dayOfMonth } : {}),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to create habit");
      onCreated(body as Habit);
      setName("");
      setDescription("");
      setFrequency("daily");
      setTimeOfDay("any");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card create-habit-card" onSubmit={handleSubmit}>
      <div className="create-habit-fields">
        <div className="field">
          <label>
            <span>New habit</span>
            <input
              type="text"
              placeholder="e.g. Take creatine with coffee"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        </div>
        <div className="field">
          <label>
            <span>Frequency</span>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
        </div>
        {frequency === "daily" && (
          <div className="field">
            <label>
              <span>Time of day</span>
              <select
                value={timeOfDay}
                onChange={(e) =>
                  setTimeOfDay(e.target.value as Habit["preferredTimeOfDay"])
                }
              >
                <option value="morning">Morning</option>
                <option value="afternoon">Afternoon</option>
                <option value="evening">Evening</option>
                <option value="any">Any time</option>
              </select>
            </label>
          </div>
        )}
        {frequency === "weekly" && (
          <div className="field">
            <label>
              <span>Day of week</span>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
              >
                {[
                  "Sunday",
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                ].map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}
        {frequency === "monthly" && (
          <div className="field">
            <label>
              <span>Day of month (1–31)</span>
              <input
                type="number"
                min={1}
                max={31}
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
              />
            </label>
          </div>
        )}
        <div className="field">
          <label>
            <span>Details (optional)</span>
            <input
              type="text"
              placeholder="Context"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="create-habit-actions">
        <button type="submit" className="primary" disabled={submitting}>
          Add habit
        </button>
      </div>
    </form>
  );
};

const CreateTaskForm: React.FC<{
  apiBase: string;
  token: string;
  setError: (m: string | null) => void;
  onCreated: (task: Task) => void;
}> = ({ apiBase, token, setError, onCreated }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Task title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/tasks`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          dueDate: dueDate || undefined,
          durationMinutes: durationMinutes
            ? Number(durationMinutes)
            : undefined,
          status: "pending",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to create task");
      onCreated(body as Task);
      setTitle("");
      setDescription("");
      setDueDate("");
      setDurationMinutes("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card create-habit-card" onSubmit={handleSubmit}>
      <div className="create-habit-fields">
        <div className="field">
          <label>
            <span>New task</span>
            <input
              type="text"
              placeholder="e.g. Change kitchen light bulb"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>
        <div className="field">
          <label>
            <span>Due date (optional)</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
        </div>
        <div className="field">
          <label>
            <span>Duration in minutes (optional)</span>
            <input
              type="number"
              min={1}
              placeholder="5"
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
            />
          </label>
        </div>
        <div className="field">
          <label>
            <span>Details (optional)</span>
            <input
              type="text"
              placeholder="Context"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="create-habit-actions">
        <button type="submit" className="primary" disabled={submitting}>
          Add task
        </button>
      </div>
    </form>
  );
};

const CreateGoalForm: React.FC<{
  apiBase: string;
  token: string;
  setError: (m: string | null) => void;
  onCreated: (goal: Goal) => void;
}> = ({ apiBase, token, setError, onCreated }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Goal title is required");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/goals`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          targetDate: targetDate || undefined,
          status: "active",
          linkedTaskIds: [],
          linkedHabitIds: [],
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to create goal");
      onCreated(body as Goal);
      setTitle("");
      setDescription("");
      setTargetDate("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="card create-habit-card" onSubmit={handleSubmit}>
      <div className="create-habit-fields">
        <div className="field">
          <label>
            <span>New goal</span>
            <input
              type="text"
              placeholder="e.g. Exterior house repairs in 2 years"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>
        </div>
        <div className="field">
          <label>
            <span>Target date (optional)</span>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
            />
          </label>
        </div>
        <div className="field">
          <label>
            <span>Details (optional)</span>
            <input
              type="text"
              placeholder="Context"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="create-habit-actions">
        <button type="submit" className="primary" disabled={submitting}>
          Add goal
        </button>
      </div>
    </form>
  );
};
