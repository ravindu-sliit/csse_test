# TECH STACK
## Smart Disaster Early-Warning and Emergency Coordination System
### Group 060

---

## Decision Summary

This is a university project. Stack choices prioritise:
1. **Familiarity** — widely taught languages and frameworks
2. **Speed** — fast to scaffold, well-documented
3. **Free hosting** — no paid services required
4. **Correctness** — tools that match the data model (relational DB for relational data)
5. **Single language** — JavaScript/TypeScript end-to-end reduces context switching

---

## 1. Frontend

### Framework: React 18 + TypeScript
- **Why React**: Most widely taught frontend framework. Component-based architecture maps perfectly to the design system (cards, tables, forms, modals).
- **Why TypeScript**: Catches type errors at compile time. Mandatory for an AI-assisted project — agents can infer types from interfaces. All component props and API response types must be typed.
- **Version**: React 18.x, TypeScript 5.x

### Build Tool: Vite
- Faster than Create React App. Zero config for TypeScript.
- Dev server with HMR (Hot Module Replacement).
- **Command**: `npm create vite@latest frontend -- --template react-ts`

### Styling: Tailwind CSS 3.x
- Utility-first CSS — matches the wireframe design patterns (flex, grid, spacing, colour).
- No separate CSS files needed for most components.
- Custom theme configured for the severity colour system (watch/advisory/warning/emergency).
- **Never** use inline `style={}` objects except for dynamic values that cannot be expressed in Tailwind.

### UI Component Library: shadcn/ui
- Built on Radix UI primitives (accessible by default).
- Not a traditional installed package — components are copied into `/src/components/ui/`.
- Provides: Button, Input, Select, Table, Dialog, Badge, Card, Tabs, Toast.
- Use shadcn components as the base; extend with Tailwind classes.

### Maps: React-Leaflet + Leaflet.js
- Free, open-source map library. No API key or billing required.
- Used for: district hazard map (UC01 dashboard), incident spatial map (UC02 verification queue), national deployment map (UC03 dashboard), supply distribution map (UC04).
- Sri Lanka GeoJSON district boundaries included as a static asset.

### Charts: Recharts
- React-native charting library. Used in UC04 analytics.
- Chart types needed: BarChart, LineChart, PieChart/DonutChart, AreaChart.

### HTTP Client: Axios
- Used for all API calls from the frontend.
- Global interceptor configured for: attaching JWT Bearer token, handling 401 redirects, showing toast on network errors.
- Base URL configured from `VITE_API_URL` environment variable.

### State Management: Zustand
- Lightweight global state. Used for: auth state (current user, token), notification toasts.
- Server state (API data) managed with **React Query (TanStack Query v5)** — handles caching, loading states, refetching.
- **Rule**: Do NOT use useEffect + useState for API calls. Always use React Query.

### Form Handling: React Hook Form + Zod
- React Hook Form: performant form state management.
- Zod: schema-based validation. All form schemas defined as Zod schemas and shared with the backend where possible.

### Routing: React Router v6
- File-based route structure using `createBrowserRouter`.
- Route guards via `ProtectedRoute` wrapper component that checks auth state.

### Notifications: Firebase Cloud Messaging (FCM)
- Client SDK for receiving push notifications in the browser.
- Service worker registered for background notifications.
- **Free tier** is sufficient.

### Offline Support (Citizen Portal only)
- `IndexedDB` via the `idb` library for storing draft reports offline.
- Online/offline detection via `navigator.onLine` and the `online`/`offline` window events.
- Sync queue: when online, pending reports in IndexedDB are submitted in order.

---

## 2. Backend

### Runtime: Node.js 20 LTS
- LTS version for stability.

### Framework: Express.js 4.x
- Minimal, un-opinionated REST API framework.
- Middleware stack: cors, helmet, express-rate-limit, morgan (logging), express-validator.

### Language: TypeScript
- Same TypeScript used on frontend. Compiled to JS at runtime using `ts-node` (dev) or compiled build for production.
- Strict mode enabled.

### ORM: Prisma 5.x
- Type-safe database client generated from the schema.
- Schema file: `/backend/prisma/schema.prisma`.
- Migrations tracked in `/backend/prisma/migrations/`.
- **Never** write raw SQL. Use Prisma Client for all queries.
- Seed script: `/backend/prisma/seed.ts`.

### Database: PostgreSQL 15
- Relational database matching the class diagram's entity relationships.
- **Why not MongoDB**: The data is clearly relational — Users, Warnings, Reports, Shelters all have foreign key relationships. A document DB would force application-level joins.
- Local dev: PostgreSQL via Docker (`docker-compose.yml` provided).
- Production: Supabase free tier (managed PostgreSQL).

### Authentication: JWT + bcrypt
- `jsonwebtoken` for signing/verifying tokens.
- `bcryptjs` for password hashing (salt rounds: 12).
- Access token: 15-minute expiry.
- Refresh token: 7-day expiry, stored in httpOnly cookie.
- Middleware: `authenticateToken` checks Bearer token on protected routes.
- Middleware: `authorizeRoles(...roles)` checks user role.

### File Upload: Multer + Cloudinary
- Multer: parses `multipart/form-data` for photo uploads (UC02 hazard reports).
- Cloudinary: free tier for image storage. Returns a URL stored in the database.
- Max file size: 5MB per photo. Max 3 photos per report.

### Real-time Updates: Socket.io
- Used for: live dashboard updates (new warning broadcast, new report submitted, shelter occupancy change).
- Namespaces: `/officer`, `/citizen`.
- Events emitted by the backend on key mutations, received by connected clients.

### Push Notifications: Firebase Admin SDK
- Server-side SDK to send FCM push notifications.
- Called from the Warning broadcast service.
- Stores delivery receipts in `notification_logs` table.

### Validation: Zod (shared with frontend)
- All request body schemas validated with Zod on the backend.
- Validation middleware wraps route handlers.

### Email (optional): Nodemailer
- For account registration confirmation only. Uses a free Gmail SMTP app password.

---

## 3. Database

### System: PostgreSQL 15
### ORM: Prisma 5
### Hosting (prod): Supabase (free tier — 500MB, 2 compute hours)
### Hosting (dev): Docker (`postgres:15-alpine` image)

See `DATABASE_SCHEMA.md` for all table definitions.

---

## 4. DevOps & Tooling

### Version Control: Git + GitHub
- Monorepo structure: `/frontend` and `/backend` in same repo.
- Branch strategy: `main` (production), `dev` (integration), `feature/uc01-*`, `feature/uc02-*` etc.
- PRs require at least one review before merging to `dev`.

### Package Manager: npm (both frontend and backend)
- Do not mix npm and yarn.

### Environment Variables
- Frontend: `.env` files with `VITE_` prefix (Vite convention).
- Backend: `.env` file, loaded via `dotenv`.
- `.env.example` committed to repo, actual `.env` in `.gitignore`.

### Linting & Formatting
- ESLint with `@typescript-eslint` rules.
- Prettier for formatting.
- Configuration files: `.eslintrc.json`, `.prettierrc`.
- Run on save in VS Code (recommended settings in `.vscode/settings.json`).

### API Testing: Thunder Client / Postman
- Collection exported and committed to `/docs/api-collection/`.

### Local Development
```bash
# Start PostgreSQL
docker-compose up -d

# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

---

## 5. Hosting (Free Tier)

| Service | Purpose | Provider |
|---|---|---|
| Frontend | Static site hosting | Vercel (free) |
| Backend API | Node.js hosting | Railway (free 500h/month) or Render (free) |
| Database | PostgreSQL | Supabase (free 500MB) |
| Images | Photo storage | Cloudinary (free 25GB) |
| Push Notifications | FCM | Firebase (free) |
| Maps | Tile server | OpenStreetMap via Leaflet (free) |

---

## 6. Key Dependencies (Pinned Versions)

### Frontend (`frontend/package.json`)
```json
{
  "dependencies": {
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-router-dom": "6.26.2",
    "axios": "1.7.7",
    "@tanstack/react-query": "5.56.2",
    "zustand": "4.5.5",
    "react-hook-form": "7.53.0",
    "zod": "3.23.8",
    "react-leaflet": "4.2.1",
    "leaflet": "1.9.4",
    "recharts": "2.12.7",
    "tailwindcss": "3.4.12",
    "socket.io-client": "4.7.5",
    "firebase": "10.13.2",
    "idb": "8.0.0",
    "@hookform/resolvers": "3.9.0"
  }
}
```

### Backend (`backend/package.json`)
```json
{
  "dependencies": {
    "express": "4.21.0",
    "prisma": "5.19.1",
    "@prisma/client": "5.19.1",
    "typescript": "5.6.2",
    "bcryptjs": "2.4.3",
    "jsonwebtoken": "9.0.2",
    "zod": "3.23.8",
    "multer": "1.4.5-lts.1",
    "cloudinary": "2.5.0",
    "socket.io": "4.7.5",
    "firebase-admin": "12.5.0",
    "cors": "2.8.5",
    "helmet": "7.1.0",
    "morgan": "1.10.0",
    "dotenv": "16.4.5",
    "express-rate-limit": "7.4.0"
  }
}
```

---

## 7. Environment Variables Reference

### Backend `.env`
```
# Server
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/dmc_db

# JWT
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Firebase Admin
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://your-vercel-app.vercel.app
```

### Frontend `.env`
```
VITE_API_URL=http://localhost:3000/api
VITE_SOCKET_URL=http://localhost:3000
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
VITE_FIREBASE_VAPID_KEY=your-vapid-key
```

---

## 8. Architectural Decisions Log

| Decision | Chosen | Rejected | Reason |
|---|---|---|---|
| Frontend framework | React + TypeScript | Next.js, Vue | React is most familiar; Next.js SSR adds unnecessary complexity |
| Styling | Tailwind CSS | CSS Modules, Styled Components | Faster to write; matches wireframe patterns directly |
| Database | PostgreSQL | MongoDB | Data is relational; document DB would require application-level joins |
| Mobile app | Responsive React web | React Native | Saves one entire codebase; wireframes work as responsive pages |
| State management | Zustand + React Query | Redux, Context API | Redux is overkill; React Query handles server state better than Context |
| ORM | Prisma | TypeORM, Sequelize | Prisma has best TypeScript support and migration tooling |
| Auth | JWT | Sessions, Auth0 | Simple; no external service; sufficient for a uni project |
| Real-time | Socket.io | SSE, polling | Socket.io is well-known and handles reconnection automatically |
