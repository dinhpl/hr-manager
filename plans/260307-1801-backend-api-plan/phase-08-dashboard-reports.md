# Phase 8 — Dashboard & Reports

**Mục tiêu:** Endpoints tổng hợp cho dashboard (role-based) và báo cáo thống kê (reports page).

---

## 8.1 File Structure

```
src/modules/dashboard/
├── dashboard.router.ts
├── dashboard.controller.ts
└── dashboard.service.ts

src/modules/reports/
├── reports.router.ts
├── reports.controller.ts
└── reports.service.ts
```

---

## 8.2 Dashboard Service

```typescript
// dashboard.service.ts

// Response khác nhau theo role
export async function getDashboardSummary(user: { userId: string; role: string }) {
  if (user.role === "EMPLOYEE") {
    return getEmployeeSummary(user.userId);
  }
  return getAdminHRSummary(user.role, user.userId);
}

async function getEmployeeSummary(userId: string) {
  const year = new Date().getFullYear();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [balances, pendingCount, approvedCount, rejectedCount] = await Promise.all([
    // Phép còn lại (AL type)
    prisma.leaveBalance.findFirst({
      where: { userId: BigInt(userId), year, leaveType: { code: "AL" } },
    }),
    // Chờ duyệt
    prisma.leaveRequest.count({ where: { userId: BigInt(userId), status: "PENDING" } }),
    // Đã duyệt
    prisma.leaveRequest.count({ where: { userId: BigInt(userId), status: "APPROVED" } }),
    // Từ chối
    prisma.leaveRequest.count({ where: { userId: BigInt(userId), status: "REJECTED" } }),
  ]);

  const remainingDays = balances
    ? Number(balances.totalDays) - Number(balances.usedDays)
    : 0;

  return {
    type: "employee",
    stats: {
      remainingLeaveDays: remainingDays,
      usedLeaveDays: balances ? Number(balances.usedDays) : 0,
      pendingRequests: pendingCount,
      approvedRequests: approvedCount,
      rejectedRequests: rejectedCount,
    },
  };
}

async function getAdminHRSummary(role: string, userId: string) {
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());

  const [
    totalUsers,
    pendingRequests,
    todayRequests,
    weekApproved,
    overdueRequests,
    hrPendingRequests,
  ] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
    prisma.leaveRequest.count({ where: { createdAt: { gte: today } } }),
    prisma.leaveRequest.count({ where: { status: "APPROVED", approvedAt: { gte: weekStart } } }),
    // Overdue: pending > 2 days
    prisma.leaveRequest.count({
      where: {
        status: "PENDING",
        createdAt: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) },
      },
    }),
    prisma.leaveRequest.count({ where: { status: "PENDING" } }),
  ]);

  return {
    type: role === "ADMIN" ? "admin" : "hr",
    stats: {
      totalEmployees: totalUsers,
      pendingRequests,
      todayRequests,
      weekApproved,
      overdueRequests,
      hrPendingRequests,
    },
  };
}

// Calendar data: dates with leave requests for a given month
export async function getCalendarData(
  user: { userId: string; role: string },
  year: number,
  month: number
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  const where =
    user.role === "EMPLOYEE"
      ? { userId: BigInt(user.userId), fromDate: { lte: end }, toDate: { gte: start }, status: { in: ["APPROVED", "PENDING"] as any } }
      : { fromDate: { lte: end }, toDate: { gte: start }, status: { in: ["APPROVED", "PENDING"] as any } };

  const requests = await prisma.leaveRequest.findMany({
    where,
    select: { fromDate: true, toDate: true, status: true },
  });

  // Build map: "YYYY-MM-DD" → { approved: bool, pending: bool }
  const calendarMap: Record<string, { approved?: boolean; pending?: boolean }> = {};
  for (const r of requests) {
    const cur = new Date(r.fromDate);
    while (cur <= r.toDate) {
      const key = cur.toISOString().slice(0, 10);
      if (!calendarMap[key]) calendarMap[key] = {};
      if (r.status === "APPROVED") calendarMap[key].approved = true;
      if (r.status === "PENDING") calendarMap[key].pending = true;
      cur.setDate(cur.getDate() + 1);
    }
  }
  return calendarMap;
}

// Recent requests for dashboard table
export async function getRecentRequests(user: { userId: string; role: string }, limit = 5) {
  const where = user.role === "EMPLOYEE" ? { userId: BigInt(user.userId) } : {};
  const requests = await prisma.leaveRequest.findMany({
    where,
    include: {
      user: { select: { fullName: true } },
      leaveType: { select: { code: true, name: true, color: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return requests.map((r) => ({ ...r, id: r.id.toString() }));
}
```

---

## 8.3 Reports Service

```typescript
// reports.service.ts

// Thống kê nghỉ phép theo tháng (cho LineChart ở reports page)
export async function getLeaveReport(query: { year: number; department?: string; leaveTypeId?: string }) {
  const { year, department, leaveTypeId } = query;

  // Group by month, leave_type
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const data = await Promise.all(
    months.map(async (month) => {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0);

      const where: Record<string, unknown> = {
        status: "APPROVED",
        fromDate: { gte: start },
        toDate: { lte: end },
      };
      if (department) where.user = { department };
      if (leaveTypeId) where.leaveTypeId = BigInt(leaveTypeId);

      const [annualCount, sickCount, wfhCount] = await Promise.all([
        prisma.leaveRequest.count({ where: { ...where, leaveType: { code: "AL" } } }),
        prisma.leaveRequest.count({ where: { ...where, leaveType: { code: "SL" } } }),
        prisma.leaveRequest.count({ where: { ...where, leaveType: { code: "WFH" } } }),
      ]);

      return { month: `${month}`, annual: annualCount, sick: sickCount, wfh: wfhCount };
    })
  );

  return data;
}

// Thống kê theo phòng ban (cho PieChart)
export async function getDepartmentReport(year: number) {
  const departments = await prisma.user.findMany({
    where: { isActive: true, department: { not: null } },
    select: { department: true },
    distinct: ["department"],
  });

  return Promise.all(
    departments.map(async ({ department }) => {
      const [totalDays, employeeCount, otHours] = await Promise.all([
        prisma.leaveRequest.aggregate({
          where: { status: "APPROVED", user: { department: department! } },
          _sum: { totalDays: true },
        }),
        prisma.user.count({ where: { department: department!, isActive: true } }),
        prisma.overtimeRecord.aggregate({
          where: { status: "APPROVED", user: { department: department! } },
          _sum: { hours: true },
        }),
      ]);

      return {
        department,
        totalDays: Number(totalDays._sum.totalDays ?? 0),
        employeeCount,
        otHours: Number(otHours._sum.hours ?? 0),
      };
    })
  );
}

// Top users by leave usage
export async function getTopLeaveUsers(year: number, limit = 10) {
  const balances = await prisma.leaveBalance.findMany({
    where: { year, leaveType: { code: "AL" } },
    include: { user: { select: { fullName: true, department: true } } },
    orderBy: { usedDays: "desc" },
    take: limit,
  });

  return balances.map((b, i) => ({
    rank: i + 1,
    name: b.user.fullName,
    department: b.user.department,
    days: Number(b.usedDays),
    pct: Math.round((Number(b.usedDays) / Number(b.totalDays)) * 100),
  }));
}
```

---

## 8.4 Routers

```typescript
// dashboard.router.ts
dashboardRouter.use(authMiddleware);
dashboardRouter.get("/summary", ctrl.getSummary);
dashboardRouter.get("/calendar", ctrl.getCalendar);         // ?year=&month=
dashboardRouter.get("/recent-requests", ctrl.getRecentRequests);

// reports.router.ts
reportsRouter.use(authMiddleware, requireRole("HR", "ADMIN", "MANAGER"));
reportsRouter.get("/leave", ctrl.getLeaveReport);            // ?year=&department=
reportsRouter.get("/overtime", ctrl.getOvertimeReport);
reportsRouter.get("/department", ctrl.getDepartmentReport);  // ?year=
reportsRouter.get("/top-users", ctrl.getTopUsers);           // ?year=&limit=
reportsRouter.get("/export", ctrl.exportReport);             // ?year=&format=csv
```

---

## 8.5 Frontend Integration

**Dashboard (`/dashboard`):**
```typescript
// Thay ADMIN_STATS, EMPLOYEE_STATS hardcode
const summaryRes = await fetch(`${API_URL}/api/dashboard/summary`, headers);
const { data: summary } = await summaryRes.json();

// Thay CALENDAR_DATA hardcode
const calRes = await fetch(`${API_URL}/api/dashboard/calendar?year=${year}&month=${month}`, headers);
const { data: calendarData } = await calRes.json();

// Thay RECENT_REQUESTS hardcode
const recentRes = await fetch(`${API_URL}/api/dashboard/recent-requests`, headers);
```

**Reports page (`/dashboard/reports`):**
```typescript
// Thay TREND_DATA hardcode (LineChart)
const trendRes = await fetch(`${API_URL}/api/reports/leave?year=2026`, headers);

// Thay DEPT_PIE_DATA (PieChart)
const deptRes = await fetch(`${API_URL}/api/reports/department?year=2026`, headers);

// Thay TOP_USERS
const topRes = await fetch(`${API_URL}/api/reports/top-users?year=2026`, headers);
```

---

## Checklist Phase 8

- [ ] `GET /api/dashboard/summary` — role-based stats (employee vs admin/hr)
- [ ] `GET /api/dashboard/calendar` — map ngày → trạng thái nghỉ
- [ ] `GET /api/dashboard/recent-requests` — 5-10 request gần nhất
- [ ] `GET /api/reports/leave` — trend data 12 tháng (annual/sick/wfh)
- [ ] `GET /api/reports/department` — stats theo phòng ban
- [ ] `GET /api/reports/top-users` — top nhân viên dùng phép nhiều nhất
- [ ] `GET /api/reports/export` — export CSV (MVP: chỉ cần CSV đơn giản)
