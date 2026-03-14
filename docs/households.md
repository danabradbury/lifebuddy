## Household model

- **Goal**: allow multiple people (e.g. family members) to share Lifebuddy while keeping ownership and assignments clear.
- **Concepts**:
  - `User`: individual person, already modeled.
  - `Household`: group of users (e.g. "Bradbury Family").
  - `HouseholdMember`: link between user and household with a `role`.
- **Assignments**:
  - Habits, tasks, and goals may reference a `householdId` and an optional `assigneeUserId`.
  - This lets us represent:
    - Personal items (just `userId`).
    - Household items (shared in a household, optionally assigned).

Implementation details will live in the backend models and SAM template; this file guides the data shape and intended behavior.

