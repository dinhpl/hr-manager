# HR Manager System - Codebase Overview

This document provides a comprehensive overview of the HR Manager application, its architecture, technology stack, and core business logic.

## 🚀 Project Summary
An HR Management system focused on leave requests, attendance tracking, overtime, and reporting. It supports multiple roles (Employee, Manager, HR, Admin) and handles complex leave policies.

---

## 🏗️ Architecture

The project is structured as a monorepo with separate directories for frontend and backend.

### 🌓 Frontend (Next.js)
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4.0, Radix UI (Shadcn UI)
- **Icons**: Lucide React
- **Validation**: Zod + React Hook Form
- **State Management**: React Hooks + Next.js Server/Client components
- **Utilities**: [lib/hr-utils.ts](file:///Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/lib/hr-utils.ts) (Core business logic for date/time and leave modes)
- **Location**: Root directory (`app/`, `components/`, `lib/`, `hooks/`)

### 🛰️ Backend (Node.js/Express)
- **Framework**: Express.js
- **Language**: TypeScript (using [tsx](file:///Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/app/page.tsx) for dev)
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Authentication**: JWT + HTTP-only Cookies, Bcrypt
- **Documentation**: Swagger (Swagger UI)
- **Logging**: Pino
- **File Uploads**: Multer
- **Location**: `/backend`

---

## 🗄️ Database Schema (Prisma)

Core models defined in `backend/prisma/schema.prisma`:
- **User**: Authentication and profile data. Supports role-based access control (RBAC).
- **LeaveType**: Configurable leave categories (Annual, Sick, etc.).
- **LeaveRequest**: Leave applications, approvals, and attachments.
- **OvertimeRecord**: Extra work hour tracking.
- **CompOffRecord**: Compensatory leave earned from overtime.
- **LeaveBalance**: Yearly tracking of available/used leave days per user.
- **Attendance**: Daily check-in/out logs.
- **Notification**: System alerts for requests and status updates.

---

## 🔑 Core Business Logic (`lib/hr-utils.ts`)
The system handles complex date/time logic specifically for **Vietnam (UTC+7)**:
- **Leave Modes**: `FULL_DAY`, `MORNING_HALF_DAY`, `AFTERNOON_HALF_DAY`, `HOURLY`.
- **Policy Validation**: Validates advance notice requirements and maximum consecutive days.
- **Role Mapping**: Consistent mapping between frontend and backend role nomenclature.
- **Date Handling**: Custom parsers for "YYYY-MM-DD HH:mm" formats used in the API.

---

## 🚢 Deployment & DevOps
- **Docker**: `Dockerfile` and `docker-compose.yml` for multi-stage builds and local development.
- **Scripts**: `deploy.sh` automates the build and deployment process.
- **Environment**: Configuration via `.env` files (separate for FE and BE).

---

## 📁 Key Directories & Files
- `/app`: Next.js routes (Dashboard, Approval, Leave History, etc.).
- `/components`: Reusable UI components (Shadcn/Radix).
- `/backend/src/modules`: Feature-based backend logic (Auth, Users, Leaves).
- `/backend/prisma`: Database schema and migrations.
- `package.json`: Main project dependencies.
- `hr_leave_db.sql`: Initial database structure export.

---

## 📝 Usage Notes for AI Assistant
- Always consider **Vietnam Timezone (UTC+7)** when dealing with dates.
- Use `lib/hr-utils.ts` for any frontend date/time manipulations to stay consistent with the backend.
- Backend modules are located under `backend/src/modules` - follow this pattern for new features.
- All IDs are `BigInt` in the database but usually treated as strings or BigInts in code.
