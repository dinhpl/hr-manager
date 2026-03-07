# Phase 10 Follow-up — Frontend API Gaps

**Ngày audit:** 2026-03-07

**Mục tiêu:** Ghi nhận các chức năng frontend đã tích hợp API một phần hoặc chưa thể tích hợp trọn vẹn do backend chưa có endpoint/phân rã dữ liệu phù hợp, đồng thời đề xuất kế hoạch implement tiếp theo.

---

## 1. Kết quả hiện tại

Các màn hình đã chuyển sang dùng API thật:

- Auth: `app/page.tsx`, `components/app-layout.tsx`
- Dashboard: `app/dashboard/page.tsx`
- Leave request: `app/dashboard/leave-request/page.tsx`, `components/leave-request-modal.tsx`
- Leave history: `app/dashboard/leave-history/page.tsx`
- Approval: `app/dashboard/approval/page.tsx`
- Employees: `app/dashboard/employees/page.tsx`
- Settings: `app/dashboard/settings/page.tsx`
- Overtime: `app/dashboard/overtime/page.tsx`
- Comp-off: `app/dashboard/compoff/page.tsx`
- Reports: `app/dashboard/reports/page.tsx`

**Xác minh:** `next build` đã pass.

---

## 2. API Gaps Còn Lại

### 2.1 Leave History

**Trạng thái hiện tại**

- Đã dùng `GET /api/leave-requests`
- Đã dùng `GET /api/leave-requests/:id`
- Đã dùng `PATCH /api/leave-requests/:id/cancel`

**Còn thiếu**

- Chưa có draft workflow thật:
  - tạo bản nháp
  - cập nhật bản nháp
  - submit lại bản nháp
  - resubmit yêu cầu bị reject
- Chưa có query backend cho:
  - search text theo `id/reason`
  - filter theo approver
  - filter theo số ngày
  - sort nhiều tiêu chí

**Đề xuất backend**

- Thêm `DRAFT` vào `LeaveRequestStatus`
- Thêm `PATCH /api/leave-requests/:id`
- Thêm `PATCH /api/leave-requests/:id/resubmit`
- Mở rộng `GET /api/leave-requests` với `search`, `approverId`, `minDays`, `maxDays`, `sortBy`, `sortOrder`

### 2.2 Approval

**Trạng thái hiện tại**

- Đã dùng `GET /api/leave-requests?status=PENDING`
- Đã dùng `PATCH /api/leave-requests/:id/approve`
- Đã dùng `PATCH /api/leave-requests/:id/reject`
- Đã dùng `POST /api/leave-requests/bulk-approve`

**Còn thiếu**

- Chưa có trạng thái duyệt nhiều cấp rõ ràng như:
  - `MANAGER_APPROVED`
  - `HR_PENDING`
  - `HR_APPROVED`
- Chưa có bulk reject
- Chưa có bulk approve kèm ghi chú chung từ UI
- Chưa có query backend cho `priority`, search đa tiêu chí, overdue flag

**Đề xuất backend**

- Mở rộng state machine cho leave approval nhiều cấp
- Thêm `POST /api/leave-requests/bulk-reject`
- Thêm query `search`, `priority`, `overdueOnly`
- Nếu vẫn dùng single status, thêm field `approvalStage`

### 2.3 Employees

**Trạng thái hiện tại**

- Đã dùng list/create/update/delete thật
- Đã patch inline cho role/department

**Còn thiếu**

- Import Excel chưa có API
- Export danh sách nhân viên chưa có API
- Chưa có edit form đầy đủ cho toàn bộ hồ sơ nhân viên
- Chưa có endpoint thống kê:
  - nghỉ phép hôm nay
  - sinh nhật tháng này
  - activity feed

**Đề xuất backend**

- `POST /api/users/import`
- `GET /api/users/export`
- `GET /api/users/stats`
- `GET /api/users/activity`

### 2.4 Settings

**Trạng thái hiện tại**

- Đã dùng `GET/PATCH /api/settings/leave-policy`
- Đã dùng `GET/PATCH /api/settings/approval-flow`

**Còn thiếu**

- Chưa có field backend cho:
  - `carryOverExpiryDate`
  - mode “tăng phép theo thâm niên”
- Export config hiện đang làm local, chưa có endpoint
- Các tab thông báo/hệ thống vẫn chưa có API tương ứng

**Đề xuất backend**

- Mở rộng `leave_policy`:
  - `carryOverExpiryDate`
  - `seniorityMode`
- Thêm:
  - `GET /api/settings/export`
  - `GET/PATCH /api/settings/notification`
  - `GET/PATCH /api/settings/system`

### 2.5 Overtime

**Trạng thái hiện tại**

- Đã dùng `GET /api/overtime`
- Đã dùng `POST /api/overtime`

**Còn thiếu**

- Lưu nháp OT chưa có API
- Backend chưa có field `holiday` thật khi submit, hiện chỉ suy luận `weekday/weekend`
- Chưa có endpoint summary riêng theo tháng/nhân sự

**Đề xuất backend**

- Thêm `draft` cho OT hoặc bảng nháp riêng
- Mở rộng payload `createOvertime` với `otType`
- Thêm `GET /api/overtime/summary`

### 2.6 Comp-off

**Trạng thái hiện tại**

- Đã dùng `GET /api/comp-off`
- Đã dùng `GET /api/comp-off/summary`

**Còn thiếu**

- Chưa có thao tác “sử dụng comp-off” thật
- Chưa có lịch sử sử dụng chi tiết
- Chưa có endpoint xem OT nguồn của từng comp-off
- Nút export/đăng ký ở đầu trang chưa có backend tương ứng

**Đề xuất backend**

- `POST /api/comp-off/:id/use`
- `GET /api/comp-off/:id/history`
- `GET /api/comp-off/:id/source-overtime`
- `GET /api/comp-off/export`

### 2.7 Reports

**Trạng thái hiện tại**

- Đã dùng:
  - `GET /api/reports/leave`
  - `GET /api/reports/overtime`
  - `GET /api/reports/department`
  - `GET /api/reports/top-users`
  - `GET /api/reports/export` (CSV)

**Còn thiếu**

- Chưa có export PDF/Excel
- Chưa có filter theo team
- Một số metric đang phải suy ra ở frontend:
  - approval rate theo tháng
  - comp-off theo tháng
  - breakdown đầy đủ theo leave type ngoài `AL/SL/WFH`

**Đề xuất backend**

- `GET /api/reports/export?format=xlsx`
- `GET /api/reports/export?format=pdf`
- Mở rộng report params với `team`
- Thêm endpoint tổng hợp tháng:
  - `GET /api/reports/monthly-summary`
- Mở rộng `leave report` để trả breakdown đầy đủ theo leave type

### 2.8 Dashboard

**Trạng thái hiện tại**

- Đã dùng đủ 3 endpoint dashboard

**Còn thiếu**

- Một số card phụ đang suy ra từ dữ liệu thật thay vì có metric riêng:
  - approval rate
  - next upcoming request

**Đề xuất backend**

- Nếu muốn dashboard ổn định và ít logic frontend hơn, thêm:
  - `approvalRate`
  - `nextUpcomingLeave`
  - `todayPendingUrgentCount`

---

## 3. Kế Hoạch Implement

### Phase A — Hoàn thiện Leave Workflow

- Mở rộng backend cho `draft/update/resubmit`
- Thêm query nâng cao cho leave history
- Refactor `leave-history` để bỏ toàn bộ filter/sort client-side tạm thời

### Phase B — Hoàn thiện Approval Flow nhiều cấp

- Thiết kế trạng thái duyệt nhiều tầng
- Bổ sung bulk reject và note hàng loạt
- Tách rõ manager queue và HR queue

### Phase C — Hoàn thiện Admin Operations

- Thêm import/export cho users
- Thêm stats/activity cho employees
- Mở rộng settings schema và API export

### Phase D — Hoàn thiện OT / Comp-off

- Thêm `otType` thật cho overtime
- Thêm OT draft nếu cần
- Thêm consume/history/source APIs cho comp-off

### Phase E — Hoàn thiện Reports

- Thêm export `xlsx/pdf`
- Thêm report monthly summary
- Thêm filter theo team và breakdown leave type đầy đủ

---

## 4. Ưu Tiên Đề Xuất

1. Leave draft/resubmit + history filters
2. Approval nhiều cấp và bulk reject
3. Comp-off consume/history/source
4. Reports export nâng cao
5. Users import/export + stats/activity
6. Settings fields mở rộng
7. Dashboard metrics chuyên biệt

