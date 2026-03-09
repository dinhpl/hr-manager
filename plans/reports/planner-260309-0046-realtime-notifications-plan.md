# Real-time Notifications Plan - HR Leave Management System

> **Ngày lập plan:** 2026-03-09
> **Phạm vi:** Frontend + Backend
> **Mục tiêu:** Triển khai notifications real-time cho dashboard/header notification trong MVP

---

## 1. Mục Tiêu

Triển khai hệ thống notification real-time để:

- Manager/HR nhận được thông báo ngay khi có yêu cầu nghỉ phép hoặc OT mới
- Employee nhận được thông báo ngay khi yêu cầu nghỉ phép hoặc OT được duyệt / từ chối
- Header notification trong dashboard hiển thị dữ liệu thật thay cho mảng hardcode hiện tại
- Có badge unread count, mark-as-read, và deep link đến màn hình liên quan

---

## 2. Hiện Trạng Codebase

### Frontend

- [`components/app-layout.tsx`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/components/app-layout.tsx) đang dùng mảng `notifications` hardcode
- Chưa có `useNotifications` hook
- Chưa có SSE/WebSocket/EventSource integration
- Đã có sẵn hạ tầng toast:
  - [`hooks/use-toast.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/hooks/use-toast.ts)
  - [`components/ui/toaster.tsx`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/components/ui/toaster.tsx)
  - [`components/ui/sonner.tsx`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/components/ui/sonner.tsx)

### Backend

- Express app hiện tại ở:
  - [`backend/src/app.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/src/app.ts)
  - [`backend/src/server.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/src/server.ts)
- Chưa có module notification
- Chưa có real-time transport
- Các business flow phù hợp để phát notification:
  - [`backend/src/modules/leave-requests/leave-requests.service.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/src/modules/leave-requests/leave-requests.service.ts)
  - [`backend/src/modules/overtime/overtime.service.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/src/modules/overtime/overtime.service.ts)

### Database

- [`backend/prisma/schema.prisma`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/prisma/schema.prisma) chưa có bảng `Notification`

---

## 3. Kiến Trúc Đề Xuất

### Chọn SSE thay vì WebSocket

Chọn `Server-Sent Events (SSE)` cho vòng đầu vì:

- Nhu cầu hiện tại là server đẩy dữ liệu một chiều về client
- Tích hợp đơn giản hơn với Express hiện tại
- Không cần thêm thư viện socket phức tạp
- Phù hợp cho notification badge/dropdown/toast
- Dễ rollout MVP, ít rủi ro hơn WebSocket

### Kiến trúc tổng quát

1. Business action xảy ra ở backend
2. Backend ghi notification vào DB
3. Backend publish event đến các connection SSE đang mở của user nhận
4. Frontend nhận event từ `EventSource`
5. Frontend cập nhật badge, dropdown list, và hiện toast

---

## 4. Scope MVP

### Event cần hỗ trợ ngay

1. `LEAVE_REQUEST_CREATED`
2. `LEAVE_REQUEST_APPROVED`
3. `LEAVE_REQUEST_REJECTED`
4. `OVERTIME_CREATED`
5. `OVERTIME_APPROVED`
6. `OVERTIME_REJECTED`

### Ngoài scope MVP

- Email notifications
- Push notifications
- Notification settings theo từng user
- Notification center riêng thành một page độc lập
- WebSocket hai chiều

---

## 5. Thiết Kế Database

### Prisma model đề xuất

Thêm model `Notification` vào [`backend/prisma/schema.prisma`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/prisma/schema.prisma).

Field khuyến nghị:

- `id`
- `userId`
- `type`
- `title`
- `message`
- `entityType`
- `entityId`
- `isRead`
- `readAt`
- `createdAt`

### Enum gợi ý

- `NotificationType`
  - `LEAVE_REQUEST_CREATED`
  - `LEAVE_REQUEST_APPROVED`
  - `LEAVE_REQUEST_REJECTED`
  - `OVERTIME_CREATED`
  - `OVERTIME_APPROVED`
  - `OVERTIME_REJECTED`

### Lưu ý

- `entityType` dùng để điều hướng frontend
- `entityId` lưu ID của leave request hoặc OT record
- `isRead` mặc định `false`
- Cần index theo `userId`, `isRead`, `createdAt`

---

## 6. Thiết Kế Backend

### 6.1. Module mới

Tạo module:

- `backend/src/modules/notifications/notifications.router.ts`
- `backend/src/modules/notifications/notifications.controller.ts`
- `backend/src/modules/notifications/notifications.service.ts`

### 6.2. API endpoints

Thêm các endpoint:

- `GET /api/notifications`
- `GET /api/notifications/unread-count`
- `PATCH /api/notifications/:id/read`
- `PATCH /api/notifications/read-all`
- `GET /api/notifications/stream`

### 6.3. SSE connection registry

Tạo lớp hoặc utility để giữ danh sách kết nối SSE theo user:

- `Map<string, Set<Response>>`

Nhiệm vụ:

- đăng ký connection khi user mở stream
- remove connection khi tab đóng hoặc request close
- broadcast event tới đúng `userId`

### 6.4. Notification service

Service nên có các hàm:

- `createNotification`
- `createManyNotifications`
- `getNotifications`
- `getUnreadCount`
- `markAsRead`
- `markAllAsRead`
- `publishToUser`
- `persistAndPublish`

### 6.5. Auth cho SSE

Route `GET /api/notifications/stream` phải dùng auth middleware hiện có để tận dụng JWT/cookie flow đang chạy trong hệ thống.

---

## 7. Điểm Tích Hợp Business Flow

### 7.1. Leave Requests

File tích hợp:

- [`backend/src/modules/leave-requests/leave-requests.service.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/src/modules/leave-requests/leave-requests.service.ts)

Các điểm cần phát notification:

1. `createLeaveRequest`
   - Gửi cho `approverId` nếu có
   - Nếu chưa có `approverId`, fallback rule cần chốt:
     - manager trực tiếp
     - hoặc HR/Admin theo scope MVP

2. `approveLeaveRequest`
   - Gửi cho người tạo request

3. `rejectLeaveRequest`
   - Gửi cho người tạo request

4. `bulkApproveLeaveRequests`
   - Tạo notification cho từng user bị ảnh hưởng

### 7.2. Overtime

File tích hợp:

- [`backend/src/modules/overtime/overtime.service.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/src/modules/overtime/overtime.service.ts)

Các điểm cần phát notification:

1. `createOvertime`
   - Gửi cho manager/approver

2. `approveOvertime`
   - Gửi cho người tạo OT

3. `rejectOvertime`
   - Gửi cho người tạo OT

### 7.3. Nguyên tắc tích hợp

- Chỉ publish SSE sau khi transaction hoặc mutation thành công
- Notification phải được lưu DB trước khi push ra client
- Không push event nếu business transaction rollback

---

## 8. Thiết Kế Frontend

### 8.1. Hook mới

Tạo hook:

- `hooks/use-notifications.ts`

Trách nhiệm:

- fetch danh sách notification ban đầu
- fetch unread count
- mở `EventSource` tới `GET /api/notifications/stream`
- merge event mới vào local state
- reconnect khi mất kết nối
- expose actions:
  - `markAsRead`
  - `markAllAsRead`
  - `refresh`

### 8.2. App layout integration

Cập nhật [`components/app-layout.tsx`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/components/app-layout.tsx):

- bỏ mảng notification hardcode
- badge hiển thị unread count thật
- dropdown render notification từ API
- click item thì:
  - mark as read
  - điều hướng đến trang liên quan

### 8.3. Toast UX

Khi nhận event mới qua SSE:

- hiện toast ngắn
- không duplicate nếu notification đã có trong state

### 8.4. Điều hướng gợi ý

- `leave_request`
  - employee: `/dashboard/leave-history`
  - manager/hr: `/dashboard/approval`
- `overtime_record`
  - `/dashboard/overtime`

---

## 9. Contract Payload

### Notification item từ API

```ts
type NotificationItem = {
  id: string;
  type:
    | 'LEAVE_REQUEST_CREATED'
    | 'LEAVE_REQUEST_APPROVED'
    | 'LEAVE_REQUEST_REJECTED'
    | 'OVERTIME_CREATED'
    | 'OVERTIME_APPROVED'
    | 'OVERTIME_REJECTED';
  title: string;
  message: string;
  entityType: 'leave_request' | 'overtime_record';
  entityId: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
};
```

### SSE event payload

```ts
{
  type: 'notification.created',
  data: {
    id: '123',
    title: 'Yeu cau nghi phep moi',
    message: 'Nguyen Van A vua gui yeu cau nghi phep',
    entityType: 'leave_request',
    entityId: '456',
    isRead: false,
    createdAt: '2026-03-09T10:00:00.000Z'
  }
}
```

---

## 10. Thứ Tự Triển Khai

### Phase 1

1. Thêm Prisma model `Notification`
2. Generate Prisma client
3. Tạo migration

### Phase 2

1. Tạo `notifications` module
2. Implement REST APIs cho list, unread count, mark-as-read
3. Mount router trong [`backend/src/app.ts`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/backend/src/app.ts)

### Phase 3

1. Implement SSE stream endpoint
2. Tạo connection registry
3. Test stream với 1 user và nhiều tab

### Phase 4

1. Gắn notification vào `leave-requests.service.ts`
2. Gắn notification vào `overtime.service.ts`
3. Xử lý bulk approve

### Phase 5

1. Tạo `hooks/use-notifications.ts`
2. Refactor [`components/app-layout.tsx`](/Users/dinhpl/Documents/TEST_AI/HR_AI/hr-change-login-page/components/app-layout.tsx)
3. Render dropdown thật + unread badge + toast

### Phase 6

1. Add reconnect logic
2. Add fallback polling unread count
3. Add loading / empty / disconnected state

### Phase 7

1. Viết test backend cho notification creation
2. Test manual multi-tab / multi-role
3. Bổ sung tài liệu API

---

## 11. Rủi Ro Và Quyết Định Cần Chốt

### 11.1. Rule xác định approver nhận notification

Hiện `createLeaveRequest` cho phép có `approverId`, nhưng nếu không có thì cần chốt rõ:

- dùng `managerId` của user
- hoặc push cho HR/Admin
- hoặc lookup theo `approval_flow`

Khuyến nghị MVP:

- nếu có `approverId` thì gửi đúng user đó
- nếu không có thì fallback `managerId`
- nếu không có manager thì gửi cho HR/Admin

### 11.2. EventSource với auth

Vì hệ thống đang dùng cookie refresh + access token logic riêng ở frontend, cần xác nhận:

- stream endpoint có thể xác thực bằng access token hiện tại hay không
- nếu token hết hạn, frontend cần reconnect sau refresh flow

Khuyến nghị MVP:

- dùng access token cho SSE URL hoặc header-based auth nếu browser flow cho phép
- nếu không ổn định, fallback ngắn hạn bằng polling

### 11.3. Scale nhiều instance

Thiết kế `Map<userId, Set<Response>>` chỉ phù hợp single-instance.

Khuyến nghị:

- chấp nhận cho MVP/local/dev
- khi scale nhiều instance thì thay bằng Redis pub/sub

---

## 12. Acceptance Criteria

Được xem là hoàn thành khi:

1. Employee tạo leave request, manager/HR thấy badge tăng ngay không cần reload
2. Manager approve/reject leave request, employee nhận notification ngay
3. Overtime create/approve/reject tạo notification đúng người nhận
4. Dropdown notification lấy dữ liệu thật từ API
5. Badge unread count đúng sau refresh trang
6. Click notification có mark-as-read và điều hướng hợp lý
7. Khi SSE mất kết nối, frontend tự reconnect hoặc fallback polling

---

## 13. Khuyến Nghị Triển Khai

Không nên làm toàn bộ notification center ngay từ đầu. Nên chia làm 2 đợt:

### Đợt 1

- DB model
- REST API
- SSE stream
- leave request notifications
- app header integration

### Đợt 2

- overtime notifications
- bulk actions
- reconnect/polling hardening
- audit log hoặc email integration nếu cần

---

## 14. Kết Luận

Với codebase hiện tại, hướng `SSE + DB-backed notifications` là phù hợp nhất cho MVP:

- thay đổi ít
- dễ tích hợp vào Express hiện tại
- đủ cho notification badge, dropdown, toast
- mở đường cho notification center hoặc Redis pub/sub ở giai đoạn sau

Ưu tiên thực hiện trước:

1. Thêm `Notification` model
2. Tạo module `notifications`
3. Gắn vào `leave-requests.service.ts`
4. Refactor `components/app-layout.tsx`

