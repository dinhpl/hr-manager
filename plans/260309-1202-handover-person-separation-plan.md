# Plan: Tách handover_person từ reason thành field riêng

## Mục tiêu
Tách trường "Người bàn giao" (handover_person) từ trường `reason` text thành field riêng trong database và API, cập nhật frontend tương ứng.

## Hiện trạng
- **Database**: Chưa có trường `handover_person` trong `LeaveRequest` model
- **Frontend leave-request**: Đã có state `handoverPerson` riêng nhưng khi submit ghép vào `reason` với format `Người bàn giao: {name}`
- **Frontend leave-history/approval**: Extract handover từ `reason` bằng regex

---

## Phase 1: Database Schema & Backend API

### 1.1 Thêm migration schema
**File:** `backend/prisma/schema.prisma`
```prisma
model LeaveRequest {
  // ... existing fields
  handoverPerson String?  @map("handover_person")  // THÊM MỚI
}
```
→ Chạy `npx prisma migrate dev` để tạo migration

### 1.2 Cập nhật Leave Request Service
**Files:**
- `backend/src/modules/leave-requests/leave-requests.service.ts`
- `backend/src/modules/leave-requests/leave-requests.router.ts`

**Thay đổi:**
- Thêm `handoverPerson` vào DTO/create schema
- Khi tạo/mapping leave-request: gán `handoverPerson` vào field mới
- API GET trả về `handoverPerson` riêng

### 1.3 Frontend API Client (nếu cần)
Kiểm tra `lib/api-client.ts` và types để đảm bảo `handoverPerson` được parse đúng.

---

## Phase 2: Frontend - Leave Request Form

### 2.1 `app/dashboard/leave-request/page.tsx`
**Thay đổi:**
- **Line 286**: Thay vì ghép vào `composedReason`, gửi `handoverPerson` riêng trong FormData:
  ```typescript
  formData.append('handoverPersonId', handoverPerson);  // THAY ĐỔI
  ```
- **Line 259-268**: Bỏ logic ghép `Người bàn giao:` vào reason

### 2.2 `components/leave-request-modal.tsx`
**Thay đổi:**
- **Line ~366**: Tương tự - gửi `handoverPersonId` riêng thay vì ghép vào reason

---

## Phase 3: Frontend - Leave History & Approval

### 3.1 `app/dashboard/leave-history/page.tsx`
**Thay đổi:**
- **Line 196-199**: Xóa function `extractHandover()` vì không còn extract từ regex
- **Line 226, 246**: Thay `extractHandover(item.reason)` bằng `item.handoverPerson || '-'`

### 3.2 `app/dashboard/approval/page.tsx`
**Thay đổi:**
- **Line 123-127**: Xóa function `extractHandover()`
- **Line 161**: Thay `extractHandover(request.reason)` bằng `request.handoverPerson || '-'`

### 3.3 `components/leave-detail-modal.tsx`
**Thay đổi:**
- **Interface LeaveDetailData** (nếu có) - đảm bảo có `handover` field
- Component hiển thị `data.handover` đã có sẵn, không cần thay đổi

---

## Phase 4: Kiểm tra & Validation

### 4.1 Test checklist
- [ ] Tạo leave request mới với handover person → Lưu vào DB riêng
- [ ] Xem leave history → Hiển thị handover đúng
- [ ] Xem approval → Hiển thị handover đúng
- [ ] Xem chi tiết (modal) → Hiển thị handover đúng

### 4.2 Backward compatibility
- Nếu API trả về `handoverPerson` null → Hiển thị `-` hoặc giá trị mặc định
- Các request cũ (chưa có `handover_person` column) vẫn hoạt động

---

## Files affected
```
backend/
├── prisma/schema.prisma                    [THÊM TRƯỜNG]
├── src/modules/leave-requests/
│   ├── leave-requests.service.ts           [CẬP NHẬT]
│   └── leave-requests.router.ts             [CẬP NHẬT]

app/dashboard/
├── leave-request/page.tsx                  [SỬA SUBMIT]
├── leave-history/page.tsx                  [BỎ EXTRACT]
└── approval/page.tsx                       [BỎ EXTRACT]

components/
├── leave-request-modal.tsx                [SỬA SUBMIT]
└── leave-detail-modal.tsx                 [OK - DÙNG DATA]
```

---

## Thứ tự thực hiện đề xuất
1. Schema migration + Backend API
2. Frontend leave-request form
3. Frontend leave-history
4. Frontend approval
5. Test end-to-end
