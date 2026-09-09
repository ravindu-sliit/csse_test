# Smart Disaster Early-Warning and Emergency Coordination System
## Group 060 — SE3070 Assignment

## Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop
- npm

### 1. Start Database
```bash
docker-compose up -d
```

### 2. Backend
```bash
cd backend
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

### Default Test Accounts
| Role | Email | Password |
|---|---|---|
| DMC Officer | national@dmc.lk | Password123! |
| DMC Duty Officer | officer@dmc.lk | Password123! |
| District Officer | coord@dmc.lk | Password123! |
| Citizen | citizen@test.lk | Password123! |
| Rescue Team | teama@rescue.lk | Password123! |