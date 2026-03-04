# Báo cáo: Màn hình đã ẩn khỏi MVP

**Ngày:** 04/03/2026
**Phạm vi:** MVP - Phare HR Leave Management System

---

## MVP Scope (giữ nguyên)

| # | Màn hình | Route | Trạng thái |
|---|----------|-------|------------|
| 1 | Login | `/` | ✅ Hiển thị |
| 2 | Dashboard | `/dashboard` | ✅ Hiển thị |
| 3 | Đăng ký nghỉ phép | `/dashboard/leave-request` | ✅ Hiển thị |
| 4 | Lịch sử nghỉ phép | `/dashboard/leave-history` | ✅ Hiển thị |
| 5 | Duyệt yêu cầu nghỉ phép | `/dashboard/approval` | ✅ Hiển thị |
| 6 | Cài đặt - Chính sách nghỉ phép | `/dashboard/settings` (tab: leave) | ✅ Hiển thị |
| 7 | Cài đặt - Luồng duyệt | `/dashboard/settings` (tab: approval) | ✅ Hiển thị |

---

## Màn hình đã ẩn (non-MVP)

### Navigation Sidebar — `components/app-layout.tsx`

| # | Màn hình | Route | Lý do ẩn |
|---|----------|-------|----------|
| 1 | Quản lý Overtime | `/dashboard/overtime` | Không thuộc MVP scope |
| 2 | Nghỉ bù (Comp-off) | `/dashboard/compoff` | Không thuộc MVP scope |
| 3 | Quản lý nhân viên | `/dashboard/employees` | Không thuộc MVP scope |
| 4 | Báo cáo | `/dashboard/reports` | Không thuộc MVP scope |

### Settings Tabs — `app/dashboard/settings/page.tsx`

| # | Tab | ID | Lý do ẩn |
|---|-----|----|----------|
| 1 | Chính sách Overtime | `overtime` | Không thuộc MVP scope |
| 2 | Thông báo | `notification` | Không thuộc MVP scope |
| 3 | Hệ thống | `system` | Không thuộc MVP scope |

---

## Cách bật lại

Tất cả các items đã ẩn đều được comment out với tag `[MVP-HIDDEN]`. Để bật lại, bỏ comment các dòng tương ứng:

**`components/app-layout.tsx`** — Tìm và bỏ comment các block:
```
// [MVP-HIDDEN] Quản lý Overtime
// [MVP-HIDDEN] Nghỉ bù (Comp-off)
// [MVP-HIDDEN] Quản lý nhân viên
// [MVP-HIDDEN] Báo cáo
```

**`app/dashboard/settings/page.tsx`** — Tìm và bỏ comment các block:
```
// [MVP-HIDDEN] Chính sách Overtime
// [MVP-HIDDEN] Thông báo
// [MVP-HIDDEN] Hệ thống
```

> **Lưu ý:** Các file page tương ứng (`overtime/page.tsx`, `compoff/page.tsx`, `employees/page.tsx`, `reports/page.tsx`) vẫn còn nguyên trong source, chỉ bị ẩn khỏi navigation. Route vẫn accessible nếu truy cập trực tiếp qua URL.
