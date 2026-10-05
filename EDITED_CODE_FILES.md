# Edited Code Files

Open this file in VS Code, then use the paths below to jump into the converted code.

## Backend Entry Points

- `backend/server.js`
- `backend/src/server.js`
- `backend/src/bootstrap/app.js`
- `backend/src/bootstrap/middleware.js`

## Backend Config

- `backend/src/config/database.config.js`
- `backend/src/config/redis.config.js`
- `backend/prisma/schema.prisma`
- `backend/package.json`
- `backend/.env.example`

## Backend Modules

- `backend/src/modules/auth/auth.controller.js`
- `backend/src/modules/auth/auth.middleware.js`
- `backend/src/modules/auth/auth.routes.js`
- `backend/src/modules/campaigns/campaign.controller.js`
- `backend/src/modules/campaigns/campaign.queue.js`
- `backend/src/modules/campaigns/campaign.routes.js`
- `backend/src/modules/subscribers/subscriber.controller.js`
- `backend/src/modules/subscribers/subscriber.routes.js`
- `backend/src/modules/analytics/analytics.controller.js`
- `backend/src/modules/analytics/analytics.routes.js`
- `backend/src/modules/automation/automation.controller.js`
- `backend/src/modules/automation/automation.engine.js`
- `backend/src/modules/automation/automation.routes.js`
- `backend/src/modules/billing/billing.controller.js`
- `backend/src/modules/billing/billing.middleware.js`
- `backend/src/modules/billing/billing.routes.js`
- `backend/src/modules/tracking/tracking.controller.js`
- `backend/src/modules/tracking/tracking.routes.js`
- `backend/src/modules/email-engine/smtp.factory.js`
- `backend/src/modules/email-engine/smtp.service.js`
- `backend/src/modules/email-engine/mail.dispatcher.js`
- `backend/src/modules/legacy/dashboard.controller.js`
- `backend/src/modules/legacy/list.controller.js`
- `backend/src/modules/legacy/legacy.routes.js`

## Backend Worker

- `backend/src/workers/campaign.worker.js`

## Frontend

- `frontend/src/App.jsx`
- `frontend/src/api/services.js`
- `frontend/src/components/layout/AppLayout.jsx`
- `frontend/src/pages/subscribers/SubscribersPage.jsx`
- `frontend/src/pages/analytics/AnalyticsPage.jsx`
- `frontend/src/pages/automation/AutomationPage.jsx`
- `frontend/src/pages/billing/BillingPage.jsx`

## Run Commands

Backend:

```powershell
cd backend
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm install
npx prisma generate
npm run dev
```

Worker:

```powershell
cd backend
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm run worker
```

Frontend:

```powershell
cd frontend
$env:Path = 'C:\Program Files\nodejs;' + $env:Path
npm install
npm run dev
```
