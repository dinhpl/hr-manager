# Plan: Xử lý UI non-functional trong MVP

**Ngày:** 04/03/2026
**Phạm vi:** Tất cả màn hình MVP

---

## Tổng quan hiện trạng

Sau khi review toàn bộ 6 màn hình MVP, phát hiện **28 button/action** hiện có trong UI nhưng chưa được xử lý. Dưới đây là phân tích chi tiết và plan xử lý theo mức độ ưu tiên.

---

## I. Danh sách non-functional theo màn hình

### 1. Login (`/`)
| Button | Vấn đề | Ưu tiên |
|--------|---------|---------|
| "Quên mật khẩu?" | Không có onClick | Low |

### 2. Dashboard (`/dashboard`)
| Button | Vấn đề | Ưu tiên |
|--------|---------|---------|
| "Xem" (icon Eye) trên bảng "Yêu cầu gần đây" | Không có onClick | High |
| Bell notification | Không có dropdown/panel | Low |
| Avatar + ChevronDown | Không có dropdown | Low |

### 3. Đăng ký nghỉ phép (`/dashboard/leave-request`)
| Button | Vấn đề | Ưu tiên |
|--------|---------|---------|
| "Lưu nháp" | Chỉ mock bằng `setTimeout` + alert, không persist data | High |
| "Gửi yêu cầu" | Chỉ mock bằng `setTimeout`, không gọi API | High |

### 4. Lịch sử nghỉ phép (`/dashboard/leave-history`)
| Button | Vấn đề | Ưu tiên |
|--------|---------|---------|
| "Export Excel" | Không có onClick | Medium |
| "In báo cáo" | Không có onClick | Medium |
| "Lọc" (filter button) | Không có onClick (filter đang reactive, button thừa) | Low |
| "Thao tác hàng loạt" | Không có onClick | Medium |
| Eye icon (Xem) trên từng row | Không có onClick | High |
| Pencil icon (Sửa) trên từng row | Không có onClick | High |
| Send icon (Gửi - với draft) | Không có onClick | High |
| X icon (Hủy) trên từng row | Không có onClick | High |
| Download icon | Không có onClick | Medium |
| RotateCcw icon (Gửi lại) | Không có onClick | Medium |
| Printer icon | Không có onClick | Medium |
| Pagination Prev/Next | Không có onClick | Medium |

### 5. Duyệt yêu cầu (`/dashboard/approval`)
| Button | Vấn đề | Ưu tiên |
|--------|---------|---------|
| "Duyệt hàng loạt" | Không có onClick | High |
| "Làm mới" (RefreshCw) | Không có onClick | Low |
| Nút Search (kính lúp) | Không có onClick, filter đang reactive | Low |
| Eye icon trong mỗi card | Không có onClick | High |
| MessageSquare icon | Không có onClick | Medium |
| Download icon (file đính kèm) | Không có onClick | Medium |
| Pagination Prev/Next | Không có onClick | Low |

### 6. Cài đặt - Settings (`/dashboard/settings`)
| Button | Vấn đề | Ưu tiên |
|--------|---------|---------|
| "Lưu tất cả" | Chỉ mock bằng `setTimeout`, không persist | Medium |
| "Reset" | Không có onClick | Low |
| "Export cấu hình" | Không có onClick | Low |
| "Thêm quy tắc" (Leave Policy tab) | Không có onClick | Medium |
| "Thêm quy tắc escalation" (Approval tab) | Không có onClick | Medium |
| Edit2 icon trong Escalation table | Không có onClick | Medium |
| Trash2 icon trong Escalation table | Không có onClick | Medium |

---

## II. Plan xử lý theo ưu tiên

### Phase 1 — HIGH PRIORITY (Core MVP flow)

#### 1.1 Modal xem chi tiết yêu cầu (dùng chung)
**Áp dụng cho:** Dashboard > Xem, Leave History > Eye, Approval > Eye
**Giải pháp:** Tạo component `LeaveDetailModal` — overlay slide-in panel hiển thị đầy đủ thông tin yêu cầu nghỉ phép.

**Props:** `request: LeaveRecord | null`, `onClose: () => void`
**Nội dung modal:**
- Header: ID, type badge, status badge
- Thông tin nghỉ: từ ngày, đến ngày, số ngày, hình thức
- Thông tin nhân viên (trong approval context)
- Lý do, người bàn giao
- File đính kèm (nếu có)
- Lịch sử duyệt (approver, approved at)
- Actions contextual: Sửa/Hủy (nếu draft/pending)

**File:** `components/leave-detail-modal.tsx`

---

#### 1.2 Leave History — Row actions
**Giải pháp per action:**

| Action | Implementation |
|--------|---------------|
| **Xem (Eye)** | Mở `LeaveDetailModal` với data của row đó |
| **Sửa (Pencil)** | Redirect sang `/dashboard/leave-request?edit={id}` — hoặc mở modal edit |
| **Gửi (Send)** | Confirm dialog → đổi `status: "draft"` → `"pending"` trong local state |
| **Hủy (X)** | Confirm dialog → đổi status thành `"cancelled"` hoặc xóa khỏi list |
| **Gửi lại (RotateCcw)** | Confirm dialog → đổi `status: "rejected"` → `"pending"` |
| **Download** | `window.print()` hoặc mock download blob với dummy PDF |
| **Print** | `window.print()` hoặc open print preview modal |

**State management:** Chuyển `RECORDS` từ `const` sang `useState<LeaveRecord[]>` để có thể mutate.

---

#### 1.3 Leave History — "Thao tác hàng loạt"
**Giải pháp:** Khi `selectedIds.length > 0`, hiện dropdown menu với options:
- Hủy các yêu cầu đã chọn
- Export các yêu cầu đã chọn

**Implementation:** Button mở `<select>` hoặc small dropdown với 2 options. Confirm trước khi thực hiện.

---

#### 1.4 Approval — "Duyệt hàng loạt"
**Giải pháp:** Button này chỉ active khi có `selectedIds`. Khi click:
1. Confirm dialog: "Bạn có chắc muốn duyệt {n} yêu cầu?"
2. Gọi `handleApprove(id)` cho tất cả selectedIds
3. Clear selectedIds

---

#### 1.5 Leave Request — Persist data (local state simulation)
**Giải pháp:** Dùng `localStorage` để lưu danh sách requests, giả lập backend:
- `handleSubmit("draft")` → save to `localStorage["leave_requests"]` với status `draft`
- `handleSubmit("submit")` → save với status `pending`, redirect to `/dashboard/leave-history`
- Leave History page đọc từ `localStorage` và merge với `RECORDS` static

---

### Phase 2 — MEDIUM PRIORITY

#### 2.1 Settings — CRUD Escalation Rules
**Giải pháp:**
- Chuyển `ESCALATION_RULES` từ `const` sang `useState`
- Edit2 icon → open inline edit row (replace cells với inputs)
- Trash2 icon → confirm dialog → filter ra khỏi state
- "Thêm quy tắc escalation" → append empty row với inline edit mode

#### 2.2 Settings — CRUD Leave Rules (Seniority table)
**Tương tự 2.1** cho bảng `LEAVE_RULES`

#### 2.3 Settings — "Lưu tất cả"
**Giải pháp:** Save state xuống `localStorage["hr_settings"]` thay vì chỉ show toast

#### 2.4 Leave History — Export Excel
**Giải pháp:** Dùng `json2csv` hoặc generate CSV string thủ công, trigger download qua `<a>` tag

#### 2.5 Leave History — Pagination
**Giải pháp:** Implement actual slice logic: `filtered.slice((currentPage-1)*pageSize, currentPage*pageSize)`

---

### Phase 3 — LOW PRIORITY (Deferred)

| Item | Note |
|------|------|
| "Quên mật khẩu?" | Show modal với message "Liên hệ Admin để reset mật khẩu" |
| Notification bell | Hardcode dropdown với 3 mock notifications |
| Avatar dropdown | Menu: Thông tin cá nhân, Đăng xuất |
| "Làm mới" (Approval) | Reload `REQUESTS` về initial state |
| Settings "Reset" | Reload state về default constants |
| Settings "Export cấu hình" | Export JSON của current settings |
| "In báo cáo" (History) | `window.print()` |
| "Lọc" button (History) | Remove thừa, filter đã reactive |

---

## III. Component cần tạo mới

| Component | Dùng ở | Mô tả |
|-----------|---------|-------|
| `components/leave-detail-modal.tsx` | Dashboard, History, Approval | Modal xem chi tiết yêu cầu |
| `components/confirm-dialog.tsx` | History, Approval, Settings | Reusable confirm dialog |

---

## IV. Thứ tự implement khuyến nghị

```
Phase 1:
  1. components/confirm-dialog.tsx
  2. components/leave-detail-modal.tsx
  3. Leave History: useState + row actions (View, Cancel, Submit, Resubmit)
  4. Dashboard: "Xem" → mở LeaveDetailModal
  5. Approval: Eye → modal, bulk approve
  6. Leave Request: persist to localStorage

Phase 2:
  7. Settings: CRUD escalation + leave rules
  8. Settings: save to localStorage
  9. Leave History: Export CSV, Pagination

Phase 3:
  10. Login: Forgot password modal
  11. Header: Bell + Avatar dropdowns
  12. Misc: Refresh, Reset, Print
```

---

## Unresolved Questions

1. **Data persistence:** Dùng localStorage (đủ cho demo MVP) hay cần setup API/mock server (json-server)?
2. **Edit leave request:** Khi sửa từ History, mở modal inline hay redirect sang `/dashboard/leave-request?edit={id}`?
3. **Download attachment:** Mock file download hay skip trong MVP?
4. **Role-based visibility:** Các button (Duyệt hàng loạt, HR xác nhận) có cần ẩn theo role không?
