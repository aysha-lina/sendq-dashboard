# SendQ — Node.js + React Migration

A full-stack rewrite of the SendQ email marketing platform from PHP/Laravel to **Node.js (Express)** + **React (Vite)**.

---

## Project Structure

```
sendq/
├── backend/          ← Node.js + Express API
│   └── src/
│       ├── config/       database.js (Sequelize + MySQL)
│       ├── controllers/  authController, dashboardController, campaignController, listController
│       ├── middleware/   auth.js (JWT protect)
│       ├── models/       User, Customer, Campaign, MailList + associations
│       ├── routes/       auth.js, api.js
│       └── server.js     Entry point
└── frontend/         ← React + Vite + Tailwind
    └── src/
        ├── api/          client.js (Axios), services.js
        ├── components/   AppLayout, ProtectedRoute, UI components
        ├── pages/        Login, Register, Dashboard, Campaigns, Lists
        ├── store/        authStore (Zustand)
        ├── App.jsx       Router
        └── main.jsx      Entry point
```

---

## Setup

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env with your MySQL credentials (same DB as the PHP app)
npm install
npm run dev
# API runs on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# App runs on http://localhost:5173
```

---

## Environment Variables (backend/.env)

| Variable | Description |
|---|---|
| `DB_HOST` | MySQL host (same as PHP app) |
| `DB_PORT` | MySQL port (default 3306) |
| `DB_NAME` | Database name |
| `DB_USER` | Database user |
| `DB_PASSWORD` | Database password |
| `DB_PREFIX` | Table prefix (e.g. `sendq` → tables: `sendq_users`) |
| `JWT_SECRET` | Secret for signing JWT tokens |
| `JWT_EXPIRES_IN` | Token expiry (default `7d`) |
| `FRONTEND_URL` | React app URL for CORS (default `http://localhost:5173`) |

---

## API Endpoints

### Auth (public)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/login` | Login, returns JWT |
| POST | `/api/auth/register` | Register new account |
| GET | `/api/auth/me` | Get current user (protected) |
| POST | `/api/auth/logout` | Logout (protected) |

### Dashboard (protected)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/dashboard` | Quota, stats, recent items |

### Campaigns (protected)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/campaigns` | List campaigns (paginated) |
| POST | `/api/v1/campaigns` | Create campaign |
| GET | `/api/v1/campaigns/:uid` | Get single campaign |
| PUT | `/api/v1/campaigns/:uid` | Update campaign |
| DELETE | `/api/v1/campaigns/:uid` | Delete campaign |
| POST | `/api/v1/campaigns/:uid/run` | Start campaign |
| POST | `/api/v1/campaigns/:uid/pause` | Pause campaign |
| POST | `/api/v1/campaigns/:uid/resume` | Resume campaign |

### Mail Lists (protected)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/lists` | List mail lists (paginated) |
| POST | `/api/v1/lists` | Create list |
| GET | `/api/v1/lists/:uid` | Get single list |
| PUT | `/api/v1/lists/:uid` | Update list |
| DELETE | `/api/v1/lists/:uid` | Delete list |

---

## Database Notes

This backend connects to the **same MySQL database** as the PHP Laravel app. The Sequelize models match the existing table schema exactly (including the `DB_PREFIX` table naming). No data migration needed — they share the same database.

**Important:** Passwords in the PHP app are hashed with Laravel's `bcrypt` (which is standard bcrypt, compatible with Node.js `bcryptjs`). Existing users can log in immediately.

---

## Phase 2 Roadmap (next modules to add)

- [ ] Subscribers management (CRUD, import CSV)
- [ ] Sending servers (SMTP, SendGrid, Mailgun)
- [ ] Templates (editor, categories)
- [ ] Campaign editor (HTML builder)
- [ ] Admin panel (customer/plan management)
- [ ] Email queue jobs (BullMQ + Redis)
- [ ] Automation / auto-triggers
- [ ] Billing (plans, subscriptions)
