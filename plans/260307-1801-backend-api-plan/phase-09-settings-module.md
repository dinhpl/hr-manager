# Phase 9 — Settings Module

**Mục tiêu:** API cho trang `/dashboard/settings` — leave policy và approval flow. MVP scope chỉ có 2 tabs này (notification/system đã comment `[MVP-HIDDEN]`).

---

## 9.1 Thiết kế Storage

Settings không có bảng riêng trong `hr_leave_db.sql`. 2 lựa chọn:

**Option A: Lưu vào DB (recommended)** — tạo bảng `settings`:
```sql
CREATE TABLE settings (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_by BIGINT REFERENCES users(id),
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

**Option B: Config file** — lưu JSON file trong server, đọc/ghi file.

**Chọn Option A** — dễ query, audit trail, scale tốt hơn. Cần migration thêm bảng `settings`.

---

## 9.2 File Structure

```
src/modules/settings/
├── settings.router.ts
├── settings.controller.ts
└── settings.service.ts
```

---

## 9.3 Settings Keys

```typescript
// Cấu trúc settings
const SETTINGS_KEYS = {
  LEAVE_POLICY: "leave_policy",
  APPROVAL_FLOW: "approval_flow",
} as const;

// Leave policy schema
interface LeavePolicy {
  annualLeaveRules: Array<{ fromYear: number; toYear: number; days: number }>;
  carryOverLimit: number;      // số ngày phép được chuyển sang năm sau
  advanceRequestDays: number;  // phải đăng ký trước bao nhiêu ngày
  maxConsecutiveDays: number;  // nghỉ liên tục tối đa
}

// Approval flow schema
interface ApprovalFlow {
  levels: Array<{
    level: number;
    approverRole: "MANAGER" | "HR" | "ADMIN";
    timeLimit: number;   // hours
    escalateTo?: string; // email hoặc role nếu quá hạn
  }>;
  autoApproveWFH: boolean;
  requireDocumentTypes: string[];   // loại phép cần đính kèm giấy tờ
}
```

---

## 9.4 Service

```typescript
// settings.service.ts

// Default values nếu chưa có trong DB
const DEFAULTS = {
  leave_policy: {
    annualLeaveRules: [
      { fromYear: 0, toYear: 1, days: 12 },
      { fromYear: 1, toYear: 5, days: 15 },
      { fromYear: 5, toYear: 999, days: 18 },
    ],
    carryOverLimit: 5,
    advanceRequestDays: 1,
    maxConsecutiveDays: 30,
  },
  approval_flow: {
    levels: [
      { level: 1, approverRole: "MANAGER", timeLimit: 48 },
      { level: 2, approverRole: "HR", timeLimit: 24 },
    ],
    autoApproveWFH: false,
    requireDocumentTypes: ["SL", "ML"],
  },
};

export async function getSetting(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? DEFAULTS[key as keyof typeof DEFAULTS] ?? null;
}

export async function updateSetting(key: string, value: unknown, updatedBy: string) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value: value as any, updatedBy: BigInt(updatedBy) },
    update: { value: value as any, updatedBy: BigInt(updatedBy), updatedAt: new Date() },
  });
}
```

**Note:** Cần thêm model Setting vào `prisma/schema.prisma`:
```prisma
model Setting {
  id        Int      @id @default(autoincrement())
  key       String   @unique @db.VarChar(100)
  value     Json
  updatedBy BigInt?  @map("updated_by")
  updatedAt DateTime @default(now()) @map("updated_at")

  updater   User?    @relation(fields: [updatedBy], references: [id])

  @@map("settings")
}
```

---

## 9.5 Router

```typescript
// settings.router.ts
settingsRouter.use(authMiddleware, requireRole("HR", "ADMIN"));

settingsRouter.get("/leave-policy", ctrl.getLeavePolicy);
settingsRouter.patch("/leave-policy", requireRole("ADMIN"), ctrl.updateLeavePolicy);
settingsRouter.get("/approval-flow", ctrl.getApprovalFlow);
settingsRouter.patch("/approval-flow", requireRole("ADMIN"), ctrl.updateApprovalFlow);
```

---

## 9.6 Frontend Integration

**Settings page (`/dashboard/settings`):**
```typescript
// Thay LEAVE_RULES hardcode
const res = await fetch(`${API_URL}/api/settings/leave-policy`, {
  headers: { Authorization: `Bearer ${token}` },
});
const leavePolicy = await res.json();

// Save changes
await fetch(`${API_URL}/api/settings/leave-policy`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ annualLeaveRules: updatedRules, ...otherSettings }),
});

// Approval flow
const flowRes = await fetch(`${API_URL}/api/settings/approval-flow`, headers);
```

---

## Checklist Phase 9

- [x] Bảng `settings` migration tạo xong
- [x] `GET /api/settings/leave-policy` — trả policy (kèm default nếu chưa có)
- [x] `PATCH /api/settings/leave-policy` — cập nhật (chỉ ADMIN)
- [x] `GET /api/settings/approval-flow` — trả approval flow
- [x] `PATCH /api/settings/approval-flow` — cập nhật (chỉ ADMIN)
- [x] Default values có sẵn khi DB trống
