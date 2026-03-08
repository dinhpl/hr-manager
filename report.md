# HR Leave Management System - Báo Cáo Phân Tích Codebase

> **Ngày phân tích:** 08/03/2026
> **Dự án:** HR Leave Management System
> **Công nghệ:** Next.js 14 (App Router) + TypeScript + TailwindCSS + shadcn/ui

---

## 1. Tổng Quan Kiến Trúc

### Frontend Structure
```
hr-change-login-page/
├── app/
│   ├── page.tsx                    # Login page
│   ├── layout.tsx                  # Root layout
│   ├── globals.css                 # Global styles
│   └── dashboard/
│       ├── page.tsx                # Dashboard (Employee/Manager/HR/Admin)
│       ├── layout.tsx              # Dashboard layout
│       ├── leave-request/          # Đăng ký nghỉ phép
│       ├── leave-history/          # Lịch sử nghỉ phép
│       ├── approval/               # Duyệt yêu cầu nghỉ phép
│       ├── employees/              # Quản lý nhân viên
│       ├── overtime/               # Quản lý Overtime
│       ├── compoff/                # Quản lý Comp-off
│       ├── reports/                # Báo cáo & Thống kê
│       └── settings/               # Cài đặt hệ thống
├── components/
│   ├── ui/                         # shadcn/ui components (60+)
│   ├── app-layout.tsx              # App layout with sidebar
│   ├── leave-request-modal.tsx     # Modal tạo yêu cầu nghỉ
│   ├── leave-detail-modal.tsx       # Modal chi tiết yêu cầu
│   ├── confirm-dialog.tsx           # Dialog xác nhận
│   └── theme-provider.tsx           # Theme provider
└── lib/
    ├── api-client.ts               # API client (Axios + interceptors)
    └── hr-utils.ts                # Utility functions
```

### Backend APIs (Expected)
- **Base URL:** `http://localhost:4000`
- **Authentication:** JWT (access token + refresh token)
- **Cookie:** httpOnly withCredentials

---

## 2. Các Màn Hình (Pages)

### 2.1. Login Page (`/`)
| Tính năng | Trạng thái |
|------------|-------------|
| Form đăng nhập (username/password) | ✅ Hoàn chỉnh |
| Show/hide password | ✅ Hoàn chỉnh |
| Remember me | ✅ Hoàn chỉnh |
| Demo accounts (4 roles) | ✅ Hoàn chỉnh |
| Forgot password modal | ✅ Hoàn chỉnh (UI only) |
| Redirect nếu đã login | ✅ Hoàn chỉnh |

### 2.2. Dashboard (`/dashboard`)
| Tính năng | Trạng thái |
|------------|-------------|
| **Employee View** | |
| - Stats: Phép còn lại, Chờ duyệt, Đã duyệt, Từ chối | ✅ Hoàn chỉnh |
| - Calendar view (Google Calendar style) | ✅ Hoàn chỉnh |
| - Recent requests table | ✅ Hoàn chỉnh |
| - FAB tạo yêu cầu mới | ✅ Hoàn chỉnh |
| **Manager/HR/Admin View** | |
| - Stats: Tổng NV, Yêu cầu hôm nay, Đã duyệt tuần, Quá hạn | ✅ Hoàn chỉnh |
| - Calendar view | ✅ Hoàn chỉnh |
| - Pending requests count | ✅ Hoàn chỉnh |
| - Approval rate | ✅ Hoàn chỉnh |
| - Recent requests table | ✅ Hoàn chỉnh |

### 2.3. Leave Request (`/dashboard/leave-request`)
| Tính năng | Trạng thái |
|------------|-------------|
| Chọn loại nghỉ phép (AL, SL, WFH, UL, BL, ML) | ✅ Hoàn chỉnh |
| Chọn ngày bắt đầu - kết thúc | ✅ Hoàn chỉnh |
| Hình thức nghỉ (Cả ngày, Nửa ngày, Theo giờ) | ✅ Hoàn chỉnh |
| Tính toán số ngày tự động | ✅ Hoàn chỉnh |
| Cảnh báo vượt quá số phép | ✅ Hoàn chỉnh |
| Lý do nghỉ | ✅ Hoàn chỉnh |
| Chọn người bàn giao | ✅ Hoàn chỉnh |
| Upload file đính kèm (PDF, DOC, JPG, PNG, max 5MB) | ✅ Hoàn chỉnh |
| Reset form | ✅ Hoàn chỉnh |
| Submit và chuyển sang lịch sử | ✅ Hoàn chỉnh |

### 2.4. Leave History (`/dashboard/leave-history`)
| Tính năng | Trạng thái |
|------------|-------------|
| Filter theo status | ✅ Hoàn chỉnh |
| Filter theo loại nghỉ | ✅ Hoàn chỉnh |
| Filter theo tháng/năm | ✅ Hoàn chỉnh |
| Search theo tên/mã | ✅ Hoàn chỉnh |
| Pagination | ✅ Hoàn chỉnh |
| Chi tiết yêu cầu (modal) | ✅ Hoàn chỉnh |
| Download file đính kèm | ✅ Hoàn chỉnh |
| Hủy yêu cầu (nếu chưa duyệt) | ✅ Hoàn chỉnh |

### 2.5. Approval (`/dashboard/approval`)
| Tính năng | Trạng thái |
|------------|-------------|
| Danh sách yêu cầu chờ duyệt | ✅ Hoàn chỉnh |
| Filter theo phòng ban | ✅ Hoàn chỉnh |
| Filter theo loại nghỉ | ✅ Hoàn chỉnh |
| Filter theo priority (overdue/pending) | ✅ Hoàn chỉnh |
| Search theo tên/mã | ✅ Hoàn chỉnh |
| Duyệt từng yêu cầu | ✅ Hoàn chỉnh |
| Từ chối từng yêu cầu | ✅ Hoàn chỉnh |
| Bulk approve | ✅ Hoàn chỉnh |
| Ghi chú duyệt | ✅ Hoàn chỉnh |
| Xem chi tiết yêu cầu | ✅ Hoàn chỉnh |
| Download file đính kèm | ✅ Hoàn chỉnh |
| Overdue detection (>2 ngày) | ✅ Hoàn chỉnh |

### 2.6. Employees (`/dashboard/employees`)
| Tính năng | Trạng thái |
|------------|-------------|
| Danh sách nhân viên (table) | ✅ Hoàn chỉnh |
| Thêm mới nhân viên | ✅ Hoàn chỉnh |
| Edit thông tin nhân viên | ✅ Hoàn chỉnh |
| Xóa nhân viên | ✅ Hoàn chỉnh |
| Filter theo phòng ban | ✅ Hoàn chỉnh |
| Filter theo role | ✅ Hoàn chỉnh |
| Filter theo status (active/inactive) | ✅ Hoàn chỉnh |
| Search | ✅ Hoàn chỉnh |
| Pagination | ✅ Hoàn chỉnh |
| Import CSV | 🔶 UI có, chưa tích hợp backend |
| Export CSV | 🔶 UI có, chưa tích hợp backend |

### 2.7. Overtime (`/dashboard/overtime`)
| Tính năng | Trạng thái |
|------------|-------------|
| Đăng ký OT mới | ✅ Hoàn chỉnh |
| Chọn ngày, giờ bắt đầu/kết thúc | ✅ Hoàn chỉnh |
| Khấu trừ giờ nghỉ trưa | ✅ Hoàn chỉnh |
| Chọn loại OT (weekday/weekend/holiday) | ✅ Hoàn chỉnh |
| Tính toán OT hours + Comp-off | ✅ Hoàn chỉnh |
| Lịch sử OT gần đây | ✅ Hoàn chỉnh |
| Tổng quan Comp-off | ✅ Hoàn chỉnh |
| Chi tiết Comp-off theo OT | ✅ Hoàn chỉnh |

### 2.8. Comp-off (`/dashboard/compoff`)
| Tính năng | Trạng thái |
|------------|-------------|
| Tổng quan Comp-off (total, available, expiring, expired) | ✅ Hoàn chỉnh |
| Progress bar trạng thái | ✅ Hoàn chỉnh |
| Filter theo status | ✅ Hoàn chỉnh |
| Filter theo loại OT | ✅ Hoàn chỉnh |
| Sort theo expiry | ✅ Hoàn chỉnh |
| Chi tiết từng record | ✅ Hoàn chỉnh |
| Timeline hoạt động | ✅ Hoàn chỉnh |
| Quick calculator | ✅ Hoàn chỉnh |
| Đăng ký nghỉ bù | 🔶 Button disabled |
| Export | 🔶 Button disabled |

### 2.9. Reports (`/dashboard/reports`)
| Tính năng | Trạng thái |
|------------|-------------|
| KPI cards (Tổng yêu cầu, Phép năm, OT, Phòng ban) | ✅ Hoàn chỉnh |
| Trend chart (12 tháng) | ✅ Hoàn chỉnh |
| Pie chart theo phòng ban | ✅ Hoàn chỉnh |
| Phân tích chi tiết theo phòng ban | ✅ Hoàn chỉnh |
| Top 10 nhân viên nghỉ nhiều nhất | ✅ Hoàn chỉnh |
| Phân tích theo loại nghỉ | ✅ Hoàn chỉnh |
| Bảng chi tiết theo tháng | ✅ Hoàn chỉnh |
| Export CSV | ✅ Hoàn chỉnh |
| Export PDF | 🔶 Button disabled |

### 2.10. Settings (`/dashboard/settings`)
| Tính năng | Trạng thái |
|------------|-------------|
| Tab: Chính sách nghỉ phép | ✅ Hoàn chỉnh |
| - Annual leave rules | ✅ Hoàn chỉnh |
| - Carry over limit | ✅ Hoàn chỉnh |
| - Advance request days | ✅ Hoàn chỉnh |
| - Max consecutive days | ✅ Hoàn chỉnh |
| Tab: Luồng duyệt | ✅ Hoàn chỉnh |
| - Approval levels | ✅ Hoàn chỉnh |
| - Auto approve WFH | ✅ Hoàn chỉnh |
| - Require document types | ✅ Hoàn chỉnh |
| Save settings | ✅ Hoàn chỉnh |

---

## 3. API Endpoints Đang Sử Dụng

### Authentication
| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/auth/login` | POST | Đăng nhập |
| `/api/auth/me` | GET | Lấy thông tin user hiện tại |
| `/api/auth/refresh-token` | POST | Refresh access token |

### Dashboard
| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/dashboard/summary` | GET | Lấy tổng quan dashboard |
| `/api/dashboard/calendar` | GET | Lấy dữ liệu lịch |
| `/api/dashboard/recent-requests` | GET | Lấy yêu cầu gần đây |

### Leave Management
| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/leave-types` | GET | Lấy danh sách loại nghỉ |
| `/api/leave-balances` | GET | Lấy số phép còn lại |
| `/api/leave-requests` | GET/POST | Lấy/Tạo yêu cầu nghỉ |
| `/api/leave-requests/:id` | GET | Chi tiết yêu cầu |
| `/api/leave-requests/:id/approve` | PATCH | Duyệt yêu cầu |
| `/api/leave-requests/:id/reject` | PATCH | Từ chối yêu cầu |
| `/api/leave-requests/bulk-approve` | POST | Duyệt hàng loạt |

### Overtime & Comp-off
| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/overtime` | GET/POST | Lấy/Tạo OT |
| `/api/comp-off` | GET | Lấy danh sách comp-off |
| `/api/comp-off/summary` | GET | Tổng quan comp-off |

### Users
| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/users/dropdown` | GET | Dropdown danh sách user |
| `/api/users` | GET/POST/PATCH/DELETE | CRUD users |

### Reports
| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/reports/leave` | GET | Báo cáo nghỉ phép |
| `/api/reports/overtime` | GET | Báo cáo OT |
| `/api/reports/department` | GET | Báo cáo theo phòng ban |
| `/api/reports/top-users` | GET | Top users |
| `/api/reports/export` | GET | Export CSV |

### Settings
| Endpoint | Method | Mô tả |
|----------|--------|-------|
| `/api/settings/leave-policy` | GET/PATCH | Cài đặt chính sách |
| `/api/settings/approval-flow` | GET/PATCH | Cài đặt luồng duyệt |

---

## 4. Chức Năng Đã Có (Tổng Hợp)

### ✅ Authentication & Authorization
- Đăng nhập với JWT
- Token refresh tự động
- Phân quyền theo role (Employee, Manager, HR, Admin)
- Remember me
- Logout

### ✅ Leave Management
- Đăng ký nghỉ phép (đầy đủ các loại)
- Hỗ trợ nghỉ cả ngày, nửa ngày, theo giờ
- Kiểm tra số phép còn lại
- Cảnh báo vượt quota
- Upload file đính kèm
- Lịch sử nghỉ phép cá nhân
- Hủy yêu cầu (nếu chưa duyệt)

### ✅ Approval Workflow
- Duyệt/Từ chối từng yêu cầu
- Bulk approve
- Ghi chú khi duyệt/từ chối
- Phát hiện yêu cầu quá hạn (>2 ngày)
- Lọc theo nhiều tiêu chí

### ✅ Overtime Management
- Đăng ký Overtime
- Tính toán giờ OT và Comp-off tự động
- Hỗ trợ weekday/weekend/holiday
- Trừ giờ nghỉ trưa

### ✅ Comp-off Management
- Theo dõi tổng comp-off
- Trạng thái: available, expiring, expired
- Timeline hoạt động
- Quick calculator

### ✅ Employee Management
- CRUD nhân viên
- Quản lý phòng ban, chức vụ
- Import/Export (UI ready)

### ✅ Reports & Analytics
- KPI dashboard
- Charts (Line, Pie)
- Phân tích theo phòng ban
- Top nhân viên
- Export CSV

### ✅ Settings
- Cấu hình chính sách nghỉ phép
- Cấu hình luồng duyệt

---

## 5. Chức Năng Chưa Có / Cần Phát Triển

### 5.1. Backend (API)
| Tính năng | Priority | Mô tả |
|------------|----------|-------|
| Settings endpoints đầy đủ | Cao | Các endpoint cài đặt hệ thống |
| Notifications | Trung bình | Thông báo real-time |
| Email notifications | Thấp | Gửi email khi có thay đổi |
| Leave types CRUD | Cao | Quản lý loại nghỉ phép |
| Leave balances management | Cao | Quản lý số phép |
| Teams/Groups management | Trung bình | Quản lý nhóm/đội |

### 5.2. Frontend Features
| Tính năng | Priority | Mô tả |
|------------|----------|-------|
| Profile page | Cao | Trang cá nhân của user |
| Password change | Cao | Đổi mật khẩu |
| Forgot password flow | Trung bình | Quy trình quên mật khẩu |
| Leave request edit | Trung bình | Chỉnh sửa yêu cầu đã gửi |
| Calendar sync | Thấp | Đồng bộ với Google Calendar |
| Mobile app | Thấp | Phiên bản mobile |
| Dark mode | Trung bình | Giao diện dark mode |
| Audit log | Trung bình | Nhật ký hoạt động |
| Dashboard widgets tùy chỉnh | Thấp | Custom widgets |

### 5.3. Business Features
| Tính năng | Priority | Mô tả |
|------------|----------|-------|
| Multi-company support | Thấp | Hỗ trợ nhiều công ty |
| Leave quota by department | Trung bình | Phân bổ phép theo phòng ban |
| Leave planning/calendar | Trung bình | Lên kế hoạch nghỉ |
| Holiday management | Trung bình | Quản lý ngày lễ |
| WFH tracking | Cao | Tracking Work From Home |

### 5.4. Missing UI Components
| Tính năng | Priority |
|------------|----------|
| Leave request draft | Trung bình |
| Bulk reject | Trung bình |
| Request history by date range | Trung bình |
| Overtime approval page | Cao |
| Comp-off request form | Cao |
| Employee detail view | Cao |
| Settings: Leave types management | Cao |
| Settings: Holiday calendar | Trung bình |

---

## 6. Đề Xuất Tính Năng Mới

### 6.1. Tính Năng Ưu Tiên Cao

#### A. Profile & Account Management
```
/dashboard/profile
├── Thông tin cá nhân
├── Đổi mật khẩu
├── Cập nhật avatar
├── Xem activity log
```
**Lý do:** Cần thiết cho UX, user cần quản lý tài khoản

#### B. Overtime Approval (Dành cho Manager/HR)
```
/dashboard/overtime-approval
├── Danh sách OT chờ duyệt
├── Duyệt/Từ chối OT
├── Bulk approve
```
**Lý do:** Hiện chỉ có trang đăng ký OT, thiếu trang duyệt

#### C. Comp-off Request Form
```
/dashboard/compoff/request
├── Chọn ngày nghỉ bù
├── Sử dụng comp-off đã tích lũy
├── Submit request
```
**Lý do:** Button bị disabled, cần implement

#### D. Leave Types Management (Settings)
```
/dashboard/settings/leave-types
├── CRUD các loại nghỉ
├── Cấu hình màu sắc
├── Quy định số ngày tối đa
```
**Lý do:** Cần linh hoạt trong quản lý loại nghỉ

### 6.2. Tính Năng Ưu Tiên Trung Bình

#### E. Real-time Notifications
- Toast notifications khi có thay đổi
- Badge hiển thị số thông báo chưa đọc
- Notification center

#### F. Dark Mode
- Toggle giao diện sáng/tối
- Lưu preference vào localStorage

#### G. Employee Detail View
```
/dashboard/employees/[id]
├── Profile chi tiết
├── Leave history
├── Overtime history
├── Balance summary
```
**Lý do:** Cần xem chi tiết nhân viên

### 6.3. Tính Năng Ưu Tiên Thấp

#### H. Calendar Integration
- Sync với Google Calendar
- Export calendar (.ics)

#### I. Audit Log
- Nhật ký hoạt động
- Ai làm gì, khi nào

#### J. Bulk Operations
- Bulk reject leave requests
- Bulk update employee status

---

## 7. Technical Recommendations

### 7.1. Code Quality
| Vấn đề | Khuyến nghị |
|--------|--------------|
| Components lớn | Tách thành smaller components |
| Magic strings | Sử dụng constants/enums |
| API calls trong components | Sử dụng React Query / SWR |
| Error handling | Unified error boundaries |

### 7.2. Performance
| Vấn đề | Khuyến nghị |
|--------|--------------|
| Large lists | Implement virtual scrolling |
| Multiple API calls | Sử dụng React Query caching |
| Bundle size | Analyze và optimize imports |

### 7.3. Security
| Vấn đề | Khuyến nghị |
|--------|--------------|
| File upload | Validate MIME types, scan for malware |
| API rate limiting | Implement frontend rate limiting |
| XSS in user input | Sanitize user inputs |

---

## 8. Kết Luận

### Tổng quan hiện trạng:
- ✅ **Core features đã hoàn chỉnh:** ~80%
- ✅ **UI/UX tốt:** Giao diện hiện đại, responsive
- ✅ **API integration tốt:** Axios interceptors, token refresh
- 🔶 **Cần phát triển thêm:** ~20% features

### Ưu điểm:
1. Code structure rõ ràng, dễ maintain
2. Sử dụng shadcn/ui - đảm bảo consistency
3. TypeScript đầy đủ
4. Responsive design
5. Role-based access control

### Cần cải thiện:
1. Thiếu một số trang: Overtime Approval, Profile, Comp-off Request
2. Một số buttons bị disabled cần implement
3. Thiếu error boundaries và loading states
4. Chưa có unit tests
5. Cần thêm documentation

---

## 9. Unresolved Questions

1. **Backend đã có chưa?** - Cần xác nhận backend Express.js đã được implement chưa
2. **Database schema** - Có database schema đầy đủ chưa?
3. **Authentication flow** - Có cần implement forgot password email flow không?
4. **Multi-language** - Có cần hỗ trợ tiếng Anh không?
5. **Deployment** - Kế hoạch deploy như thế nào?

---

*Báo cáo được tạo tự động bởi AI*
