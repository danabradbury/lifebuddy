import React, { useEffect, useMemo, useState } from "react";
import "./style.css";

type Habit = {
  habitId: string;
  name: string;
  description?: string;
  preferredTimeOfDay: "morning" | "afternoon" | "evening" | "any";
  isActive: boolean;
};

type HabitStatus = "pending" | "done" | "snoozed" | "skipped";

type HabitWithStatus = Habit & { status: HabitStatus };

type AuthState = {
  token: string;
  email: string;
} | null;

const API_BASE = import.meta.env.VITE_API_BASE as string | undefined;

export const App: React.FC = () => {
  const [auth, setAuth] = useState<AuthState>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [habits, setHabits] = useState<HabitWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = API_BASE ?? "";

  useEffect(() => {
    const stored = window.localStorage.getItem("lifebuddy-auth");
    if (stored) {
      const parsed = JSON.parse(stored) as AuthState;
      setAuth(parsed);
    }
  }, []);

  useEffect(() => {
    if (!auth) return;
    void loadHabits();
  }, [auth]);

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

  const nextUp = useMemo(() => {
    const pending = habits.filter((h) => h.status === "pending");
    return pending.slice(0, 3);
  }, [habits]);

  async function loadHabits() {
    if (!auth) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/habits`, {
        headers: {
          Authorization: `Bearer ${auth.token}`,
        },
      });
      if (!res.ok) {
        throw new Error("Failed to load habits");
      }
      const data = (await res.json()) as Habit[];

      // For each habit, ask the backend for today's check-ins so we can
      // reflect Done / Snoozed / Skipped on initial load.
      const withStatus: HabitWithStatus[] = [];
      for (const habit of data) {
        try {
          const checkinsRes = await fetch(
            `${apiBase}/habits/${habit.habitId}/checkins`,
            {
              headers: {
                Authorization: `Bearer ${auth.token}`,
              },
            },
          );
          let status: HabitStatus = "pending";
          if (checkinsRes.ok) {
            const checkins = (await checkinsRes.json()) as {
              status: HabitStatus;
            }[];
            if (checkins.length > 0) {
              // Use the last checkin's status for today
              status = checkins[checkins.length - 1]!.status;
            }
          }
          withStatus.push({
            ...habit,
            status,
          });
        } catch {
          withStatus.push({
            ...habit,
            status: "pending",
          });
        }
      }

      setHabits(withStatus);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(path: "login" | "signup") {
    if (!apiBase) {
      setError("API base not configured");
      return;
    }
    console.log("handleAuth", path, email, password);
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
      if (!res.ok) {
        throw new Error(body.message ?? "Auth failed");
      }
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
        prev.map((h) =>
          h.habitId === habit.habitId
            ? {
                ...h,
                status,
              }
            : h,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
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
            <button
              disabled={loading}
              onClick={() => {
                void handleAuth("login");
              }}
            >
              Log in
            </button>
            <button
              className="secondary"
              disabled={loading}
              onClick={() => {
                void handleAuth("signup");
              }}
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const hasOverdue = nextUp.length > 0;

  return (
    <div className="page">
      {hasOverdue && (
        <div className="nag-bar">
          <strong>Next up:</strong> {nextUp.map((h) => h.name).join(", ")} — do
          one before you leave.
        </div>
      )}

      <header className="header">
        <div>
          <h1>Today</h1>
          <p className="subtitle">
            Stay on top of the small things that matter.
          </p>
        </div>
        <div className="header-actions">
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

      <section className="create-habit">
        <CreateHabitForm
          onCreated={(habit) => {
            setHabits((prev) => [
              {
                ...habit,
                status: "pending",
              },
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
        {nextUp.length === 0 ? (
          <p>Nothing urgent. Nice work.</p>
        ) : (
          <div className="cards">
            {nextUp.map((habit) => (
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
        {isDone && (
          <p className="description">Completed for today 🎯</p>
        )}
      </div>
      <div className="habit-actions">
        <button
          onClick={() => onAction(habit, "done")}
          className="primary"
          disabled={isDone}
        >
          Done
        </button>
        <button
          onClick={() => onAction(habit, "snoozed")}
          className="secondary"
        >
          Snooze
        </button>
        <button onClick={() => onAction(habit, "skipped")} className="ghost">
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
  if (!habits.length) {
    return null;
  }
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

type CreateHabitFormProps = {
  apiBase: string;
  token: string;
  onCreated: (habit: Habit) => void;
  setError: (message: string | null) => void;
};

const CreateHabitForm: React.FC<CreateHabitFormProps> = ({
  apiBase,
  token,
  onCreated,
  setError,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [timeOfDay, setTimeOfDay] = useState<
    Habit["preferredTimeOfDay"]
  >("any");
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
          frequency: "daily",
          preferredTimeOfDay: timeOfDay,
          reminderChannel: "in_app",
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        throw new Error(body.message ?? "Failed to create habit");
      }
      onCreated(body as Habit);
      setName("");
      setDescription("");
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
            <span>New daily habit</span>
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
        <div className="field">
          <label>
            <span>Details (optional)</span>
            <input
              type="text"
              placeholder="Context or where it fits in your routine"
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
}

