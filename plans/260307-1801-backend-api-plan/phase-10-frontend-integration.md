# Phase 10 — Frontend Integration

**Mục tiêu:** Thay toàn bộ mock data / localStorage logic trong Next.js frontend bằng API calls thật. Không thay đổi UI.

---

## 10.1 API Client Setup

### Tạo `lib/api-client.ts`

```typescript
// frontend/lib/api-client.ts

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("accessToken") ?? sessionStorage.getItem("accessToken");
}

async function refreshAccessToken(): Promise<string | null> {
  const res = await fetch(`${API_URL}/api/auth/refresh-token`, {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return null;
  const data = await res.json();
  const token = data.data?.accessToken;
  if (token) {
    // Re-save token
    const storage = localStorage.getItem("userInfo") ? localStorage : sessionStorage;
    storage.setItem("accessToken", token);
  }
  return token ?? null;
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ data: T; meta?: object; success: boolean }> {
  let token = getToken();

  const makeRequest = async (t: string | null) =>
    fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(t ? { Authorization: `Bearer ${t}` } : {}),
        ...(options.headers ?? {}),
      },
    });

  let res = await makeRequest(token);

  // Auto refresh on 401
  if (res.status === 401 && token) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      res = await makeRequest(newToken);
    } else {
      // Redirect to login
      window.location.href = "/";
      throw new Error("Session expired");
    }
  }

  const json = await res.json();
  if (!json.success) throw new Error(json.error?.message ?? "API error");
  return json;
}

// Convenience methods
export const api = {
  get: <T>(url: string) => apiRequest<T>(url),
  post: <T>(url: string, body: unknown) =>
    apiRequest<T>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(url: string, body: unknown) =>
    apiRequest<T>(url, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(url: string) => apiRequest<T>(url, { method: "DELETE" }),
};
```

### Thêm env variable

```bash
# .env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:4000
```

---

## 10.2 Thay thế từng trang

### 10.2.1 Login Page (`app/page.tsx`)

**Trước:** Check DEMO_ACCOUNTS, lưu role vào localStorage
**Sau:**
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError("");
  try {
    const { data } = await api.post<{ accessToken: string; user: UserInfo }>(
      "/api/auth/login",
      { username, password }
    );
    const storage = rememberMe ? localStorage : sessionStorage;
    storage.setItem("accessToken", data.accessToken);
    storage.setItem("userInfo", JSON.stringify(data.user));
    router.push("/dashboard");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
  } finally {
    setLoading(false);
  }
};
```

### 10.2.2 Dashboard Layout (`components/app-layout.tsx`)

**Trước:** Đọc userInfo từ storage
**Sau:** Gọi `GET /api/auth/me` → dùng làm source of truth
```typescript
useEffect(() => {
  api.get<UserInfo>("/api/auth/me")
    .then(({ data }) => setUserInfo(data))
    .catch(() => router.push("/"));
}, []);

// Logout: gọi API
const handleLogout = async () => {
  await api.post("/api/auth/logout", {});
  localStorage.clear();
  sessionStorage.clear();
  router.push("/");
};
```

### 10.2.3 Dashboard Page (`app/dashboard/page.tsx`)

```typescript
// Trong useEffect thay vì đọc storage:
const [summary, setSummary] = useState(null);
const [calendarData, setCalendarData] = useState({});
const [recentRequests, setRecentRequests] = useState([]);

useEffect(() => {
  Promise.all([
    api.get("/api/dashboard/summary"),
    api.get(`/api/dashboard/calendar?year=${year}&month=${month}`),
    api.get("/api/dashboard/recent-requests"),
  ]).then(([s, c, r]) => {
    setSummary(s.data);
    setCalendarData(c.data);
    setRecentRequests(r.data);
  });
}, [year, month]);
```

### 10.2.4 Leave Request Page (`app/dashboard/leave-request/page.tsx`)

```typescript
// Load leave types từ API
useEffect(() => {
  api.get<LeaveType[]>("/api/leave-types").then(({ data }) => setLeaveTypes(data));
  api.get<LeaveBalance[]>("/api/leave-balances").then(({ data }) => setBalances(data));
  api.get<User[]>("/api/users/dropdown").then(({ data }) => setHandoverPersons(data));
}, []);

// Submit — không còn DRAFT mode, luôn POST PENDING
// "Lưu nháp" button sẽ bị remove hoặc đổi thành "Gửi"
const handleSubmit = async () => {
  const formData = new FormData();
  formData.append("leaveTypeId", leaveType);
  formData.append("fromDate", fromDate);
  formData.append("toDate", toDate);
  formData.append("totalDays", String(days));
  formData.append("reason", reason);
  if (attachedFile) formData.append("attachment", attachedFile);

  const res = await fetch(`${API_URL}/api/leave-requests`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    // Không set Content-Type — browser tự set multipart boundary
    body: formData,
  });
  const data = await res.json();
  if (data.success) router.push("/dashboard/leave-history");
};
```

### 10.2.5 Leave History Page (`app/dashboard/leave-history/page.tsx`)

```typescript
const [records, setRecords] = useState([]);
const [meta, setMeta] = useState({ total: 0, page: 1, totalPages: 1 });

useEffect(() => {
  const query = new URLSearchParams({ page: String(page), limit: "20", ...filters });
  api.get(`/api/leave-requests?${query}`).then(({ data, meta }) => {
    setRecords(data);
    setMeta(meta);
  });
}, [page, filters]);

// Cancel
const handleCancel = (id: string) =>
  api.patch(`/api/leave-requests/${id}/cancel`, {}).then(fetchData);
```

### 10.2.6 Approval Page (`app/dashboard/approval/page.tsx`)

```typescript
// Load pending requests
useEffect(() => {
  const query = new URLSearchParams({ status: "PENDING", ...filterParams });
  api.get(`/api/leave-requests?${query}`).then(({ data }) => setRequests(data));
}, [filterParams]);

// Approve/Reject
const handleApprove = async (id: string) => {
  await api.patch(`/api/leave-requests/${id}/approve`, { note: notes[id] });
  refetch();
};

// Bulk approve
const executeBulkApprove = async () => {
  await api.post("/api/leave-requests/bulk-approve", { ids: selectedIds });
  refetch();
};
```

### 10.2.7 Overtime Page (`app/dashboard/overtime/page.tsx`)

```typescript
useEffect(() => {
  Promise.all([
    api.get("/api/overtime?limit=10"),
    api.get("/api/comp-off?limit=5&sortBy=expiry_asc"),
    api.get("/api/overtime/summary"),
  ]).then(([ot, co, stats]) => { ... });
}, []);

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  await api.post("/api/overtime", { date: workDate, hours: calc?.otHrs, reason });
  setSubmitted(true);
};
```

### 10.2.8 Compoff Page (`app/dashboard/compoff/page.tsx`)

```typescript
useEffect(() => {
  const query = new URLSearchParams({ status: statusFilter, sortBy });
  api.get(`/api/comp-off?${query}`).then(({ data }) => setItems(data));
  api.get("/api/comp-off/summary").then(({ data }) => setSummary(data));
}, [statusFilter, sortBy]);
```

### 10.2.9 Employees Page (`app/dashboard/employees/page.tsx`)

```typescript
useEffect(() => {
  const query = new URLSearchParams({ search, department, role, page: String(page) });
  api.get(`/api/users?${query}`).then(({ data, meta }) => {
    setEmployees(data);
    setMeta(meta);
  });
}, [search, department, role, page]);

const handleCreate = (data: CreateEmployeeData) => api.post("/api/users", data);
const handleUpdate = (id: string, data: Partial<Employee>) => api.patch(`/api/users/${id}`, data);
const handleDelete = (id: string) => api.delete(`/api/users/${id}`);
```

### 10.2.10 Reports Page (`app/dashboard/reports/page.tsx`)

```typescript
useEffect(() => {
  Promise.all([
    api.get(`/api/reports/leave?year=${selectedYear}`),
    api.get(`/api/reports/department?year=${selectedYear}`),
    api.get(`/api/reports/top-users?year=${selectedYear}`),
  ]).then(([trend, dept, top]) => {
    setTrendData(trend.data);
    setDeptData(dept.data);
    setTopUsers(top.data);
  });
}, [selectedYear]);
```

### 10.2.11 Settings Page (`app/dashboard/settings/page.tsx`)

```typescript
useEffect(() => {
  Promise.all([
    api.get("/api/settings/leave-policy"),
    api.get("/api/settings/approval-flow"),
  ]).then(([policy, flow]) => {
    setLeavePolicy(policy.data);
    setApprovalFlow(flow.data);
  });
}, []);

const handleSaveLeavePolicy = async () => {
  await api.patch("/api/settings/leave-policy", leavePolicy);
};
```

---

## 10.3 Error Handling Pattern

```typescript
// Dùng toast hoặc alert state để show lỗi API
try {
  await api.post(...);
  toast.success("Thành công");
} catch (err) {
  toast.error(err instanceof Error ? err.message : "Có lỗi xảy ra");
}
```

---

## 10.4 Loading States

Mỗi trang cần:
```typescript
const [isLoading, setIsLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

// Trong useEffect
setIsLoading(true);
api.get(...).then(...).catch((err) => setError(err.message)).finally(() => setIsLoading(false));
```

Frontend đã có `Spinner`, `Empty` components để dùng.

---

## 10.5 Next.js Config Update

```typescript
// next.config.ts — thêm CORS headers hoặc rewrites nếu cần
/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Optional: proxy API calls qua Next.js để tránh CORS issues
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};
```

---

## 10.6 Integration Testing Checklist

### Auth Flow
- [ ] Login trả token, lưu vào storage
- [ ] Auto refresh token khi 401
- [ ] Logout xóa cookie + storage
- [ ] Dashboard load userInfo từ /me

### Employee
- [ ] Login page → dashboard (role-based render)
- [ ] Leave request form: dropdown leave types từ API
- [ ] Leave balance hiển thị từ API
- [ ] Submit leave request → database record

### Manager/HR
- [ ] Approval page load pending requests từ DB
- [ ] Approve → balance deducted
- [ ] Bulk approve works

### Full Flow
- [ ] Employee tạo OT request → Manager approve → Comp-off tự tạo
- [ ] Employee tạo leave request → Manager approve → Balance deducted
- [ ] Employee cancel leave → Balance restored

---

## 10.7 Migration Steps (Cách triển khai không break)

1. Deploy backend, chạy DB migrations
2. Seed test users (admin/employee/manager)
3. Thêm `NEXT_PUBLIC_API_URL` vào frontend `.env.local`
4. Tích hợp từng trang theo thứ tự: Auth → Dashboard → Leave Request → History → Approval → Overtime → Compoff → Employees → Reports → Settings
5. Test từng trang trước khi chuyển sang trang tiếp theo
6. Remove mock data constants sau khi verify xong
