## Lifebuddy Roadmap

### Now (core assistant)

- **Habits**: Daily/weekly/monthly habits with clear \"Next up\" and check-ins.
- **Tasks**: One-off and recurring tasks with due dates and quick \"Done\" actions.
- **Goals**: Long-term goals linked to tasks/habits (lightweight for now).
- **Focus view**: Combined \"today\" screen showing habits due today + tasks due/overdue.

### Next (household & presence)

- **Households**:
  - Model multi-user households (you, your wife, your son).
  - Assign habits/tasks/goals to specific members or to the household in general.
  - Add simple household management APIs and, later, UI.
- **Kiosk / doorway view**:
  - `/kiosk` route tuned for a wall-mounted tablet.
  - Always-on Focus view with big, glanceable \"next actions\".
  - Automatic refresh when the screen wakes.
- **Notifications**:
  - Email reminders for habits/tasks due soon.
  - User-level notification settings (how pushy to be).

### Later (smart presence & richer planning)

- **Physical kiosk hardware**:
  - Raspberry Pi / tablet setup in kiosk mode.
  - Presence detection (motion or screen wake) to nudge when someone walks by.
- **Face recognition (local)**:
  - Recognize household members locally on the kiosk.
  - Personalize prompts: \"Hey Dana, pushups + creatine, and chairs are due tomorrow\".
- **Richer goals & planning**:
  - Better goal breakdown into milestones.
  - Smarter scheduling that drips large goals into daily Focus suggestions.

