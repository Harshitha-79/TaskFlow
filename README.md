# TaskFlow 

Collaborative task board: projects, members with roles, Kanban tasks, comments, activity feed, dashboard,
and live updates over WebSockets. Stack: React (Vite) + Django REST Framework + Django Channels + PostgreSQL + Redis.

Full write-up (auth flow, WebSocket design, what was hard, AI usage): see [README.md](README.md).

## Prerequisites

Python 3.11+, Node 18+, PostgreSQL 14+, and a Redis-compatible server running on `localhost:6379`
(Memurai on Windows, Redis on macOS/Linux).

Create the database once:

```sql
CREATE DATABASE taskflow_db;
CREATE USER taskflow_user WITH PASSWORD 'yourpassword';
ALTER DATABASE taskflow_db OWNER TO taskflow_user;
```

## Run the backend (from the repository root)

```powershell
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python manage.py migrate
python manage.py seed_demo_data
daphne config.asgi:application
```

Edit `.env` first: set `SECRET_KEY` (in double quotes) and the password in `DATABASE_URL`.
Use `daphne`, not `runserver`, so the WebSocket endpoint works. API: `http://localhost:8000`.

## Run the frontend

```powershell
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Demo logins (created by the seed command)

| Email | Password | Role |
|---|---|---|
| alice@example.com | `TaskFlow@2026` | Owner of "Website Redesign" |
| bob@example.com | `TaskFlow@2026` | Member |

## Data model

```
User          id PK | name | email UNIQUE | password (Argon2 hash)

Project       id PK | title | description | owner_id -> User (CASCADE) | created_at

Membership    id PK | user_id -> User (CASCADE) | project_id -> Project (CASCADE)
              role: 'owner' | 'member' | joined_at
              UNIQUE (user_id, project_id)          <- the many-to-many User <-> Project

Task          id PK | project_id -> Project (CASCADE)
              title | description
              status: todo | in_progress | done
              priority: low | medium | high
              due_date (nullable) | completed_at (nullable)
              assignee_id   -> User (SET NULL)
              created_by_id -> User (SET NULL)
              created_at

Comment       id PK | task_id -> Task (CASCADE) | author_id -> User (CASCADE) | body | created_at

ActivityLog   id PK | project_id -> Project (CASCADE) | actor_id -> User (SET NULL)
              verb | description | created_at       (newest first)
```

Relations and rules:

- **Users and projects:** many-to-many through `Membership`, which carries the role. The unique
  `(user, project)` pair prevents duplicate membership. Creating a project also creates the owner's
  membership in the same transaction.
- **Project deleted:** cascades to memberships, tasks, comments and activity, so nothing is orphaned.
- **Member removed:** only their `Membership` row is deleted. Tasks they created stay, and tasks assigned
  to them become unassigned (`assignee` set to null).
- **Done date:** moving a task to Done sets `completed_at`. Moving it out of Done clears it.
- **Roles:** only the owner can invite or remove members and delete the project. A task can only be
  assigned to a current member, and only the assignee or the owner can mark it Done. All of this is
  enforced by the backend, and non-members get `404` for anything in a project they do not belong to.
