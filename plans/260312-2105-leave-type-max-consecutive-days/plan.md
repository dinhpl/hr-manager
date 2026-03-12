# Plan: Thêm cột maxConsecutiveDays vào leave_types và màn hình quản lý

## Mục tiêu
- Thêm cột `max_consecutive_days` vào bảng `leave_types` để mỗi loại nghỉ phép có giới hạn ngày nghỉ liên tiếp riêng
- Thêm cột `uses_annual_balance` để xác định loại nghỉ nào tính vào phép năm (AL)
- Tạo màn hình quản lý loại nghỉ phép trong Settings
- Cập nhật logic kiểm tra leave_request dựa vào giới hạn của từng loại

---

## Phase 1: Database Migration

### 1.1 Thêm cột vào schema.prisma
- File: `backend/prisma/schema.prisma`
- Thêm 2 fields vào model `LeaveType`:
  ```prisma
  maxConsecutiveDays    Int?   @map("max_consecutive_days")     // Số ngày liên tiếp tối đa
  usesAnnualBalance    Boolean @default(false) @map("uses_annual_balance")  // Có tính vào phép năm?
  ```
- Nullable để backward compatibility

### 1.2 Tạo migration
- Chạy `npx prisma migrate dev` để tạo migration file
- Cập nhật seed data:

| Code | Tên | maxConsecutiveDays | usesAnnualBalance |
|------|-----|-------------------|-------------------|
| AL | Phép năm | 5 | true |
| SL | Nghỉ ốm | 5 | true |
| BL | Nghỉ cưới | 5 | true |
| ML | Nghỉ tang | 5 | true |
| CO | Nghỉ bù | 5 | false |
| BT | Công tác | 5 | false |
| UL | Không lương | 5 | false |
| WFH | Làm từ xa | 5 | false |

---

## Phase 2: Backend API

### 2.1 Cập nhật leave-types service
- File: `backend/src/modules/leave-types/leave-types.service.ts`
- Thêm `maxConsecutiveDays` và `usesAnnualBalance` vào:
  - `createLeaveType()`
  - `updateLeaveType()`
  - `getLeaveTypes()` (include trong response)

### 2.2 Cập nhật leave-requests validation
- File: `backend/src/modules/leave-requests/leave-requests.service.ts`

**2.2.1 Thay đổi logic kiểm tra maxConsecutiveDays:**
```typescript
// ĐỌC từ leaveType thay vì từ global leavePolicy
const maxDays = leaveType.maxConsecutiveDays ?? leavePolicy.maxConsecutiveDays;
if (maxDays && inclusiveDays > maxDays) {
  throw new Error(`Loại nghỉ ${leaveType.name} tối đa ${maxDays} ngày liên tiếp`);
}
```

**2.2.2 Thay đổi logic kiểm tra balance:**
- Xóa `BALANCE_EXEMPT_LEAVE_TYPE_CODES` hardcoded
- Thay bằng đọc từ DB: `leaveType.usesAnnualBalance`
- Nếu `usesAnnualBalance = true` → kiểm tra AL balance thay vì balance của loại đó

**2.2.3 Thay đổi deductBalance:**
- Khi `usesAnnualBalance = true` → trừ vào AL (code='AL') balance thay vì leaveTypeId hiện tại
- Với AL request: trừ vào AL balance (bình thường)

### 2.3 Cập nhật leave-balances service
- File: `backend/src/modules/leave-balances/leave-balances.service.ts`
- `deductBalance()` và `restoreBalance()` cần nhận thêm `targetLeaveTypeId` (AL khi usesAnnualBalance=true)

---

## Phase 3: Frontend - Leave Types Management UI

### 3.1 Thêm tab mới vào Settings
- File: `app/dashboard/settings/page.tsx`
- Thêm tab "Loại nghỉ phép" (Leave Types) - tab thứ 3

### 3.2 Component Leave Types CRUD
- **List table:** Code, Tên, Số ngày mặc định, Max consecutive days, Tính phép năm, Màu, Trạng thái
- **Actions:** Edit, Toggle active
- **Modal form:** Create/Edit leave type với các field:
  - Code (text)
  - Name (text)
  - Default Days (number)
  - Max Consecutive Days (number, optional)
  - Uses Annual Balance (checkbox)
  - Is Paid (checkbox)
  - Color (color picker)

### 3.3 Update Leave Request Modal
- File: `components/leave-request-modal.tsx`
- Khi chọn loại nghỉ có `usesAnnualBalance = true`:
  - Hiển thị AL balance thay vì balance của loại đó
  - Validation hint: "Loại nghỉ này sẽ trừ vào phép năm"

---

## Phase 4: Testing & Polish

### 4.1 Test các flow
- [ ] Tạo leave request SL/BL/ML → verify trừ vào AL balance
- [ ] Tạo leave request với số ngày > maxConsecutiveDays của loại đó → verify bị reject
- [ ] CRUD leave types trong Settings
- [ ] Verify WFH/CO/BT/UL không trừ balance

### 4.2 Update documentation
- Cập nhật docs nếu cần

---

## Files cần thay đổi

| File | Thay đổi |
|------|-----------|
| `backend/prisma/schema.prisma` | Thêm cột maxConsecutiveDays + usesAnnualBalance |
| `backend/prisma/seed.ts` | Update seed data với giá trị mới |
| `backend/src/modules/leave-types/leave-types.service.ts` | Support new fields |
| `backend/src/modules/leave-types/leave-types.controller.ts` | Check if needed (có thể ko cần) |
| `backend/src/modules/leave-requests/leave-requests.service.ts` | Update validation + balance deduction logic |
| `backend/src/modules/leave-balances/leave-balances.service.ts` | Update deduct/restore functions |
| `app/dashboard/settings/page.tsx` | Thêm tab quản lý leave types |
| `components/leave-request-modal.tsx` | Hiển thị AL balance khi usesAnnualBalance=true |

---

## Questions đã xác nhận

1. **Default values:**
   - Tất cả các loại: maxConsecutiveDays=5
   - AL/SL/BL/ML: usesAnnualBalance=true (tất cả tính vào phép năm)
   - WFH/CO/BT/UL: usesAnnualBalance=false

2. **Fallback:** Có, dùng global setting nếu leave_type không có giới hạn riêng

3. **UI Placement:** Tab thứ 3 sau "Chính sách nghỉ phép" và "Luồng duyệt"

4. **Logic mới cho balance:**
   - `usesAnnualBalance = true` → trừ vào AL balance (bao gồm cả AL)
   - `usesAnnualBalance = false` → không trừ balance (CO/BT/UL/WFH)
