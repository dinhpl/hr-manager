# Đề xuất tech stack backend

## Mục tiêu

Xây dựng backend cho hệ thống quản lý nghỉ phép dựa trên source code hiện tại của frontend `Next.js` và schema trong `hr_leave_db.sql`, theo hướng dễ triển khai, dễ bảo trì, phù hợp MVP nhưng vẫn đủ chỗ để mở rộng.

## Tech stack đề xuất

### Core

- Runtime: `Node.js 20 LTS`
- Framework: `Express.js`
- Ngôn ngữ: `TypeScript`
- Database: `PostgreSQL`
- ORM / Query layer: `Prisma ORM`

### API và validation

- API style: `RESTful API`
- Validation request: `Zod`
- Tài liệu API: `Swagger / OpenAPI` với `swagger-jsdoc` + `swagger-ui-express`

### Authentication và authorization

- Authentication: `JWT` (`access token` + `refresh token`)
- Password hashing: `bcrypt`
- Authorization: `RBAC` theo role trong DB: `EMPLOYEE`, `MANAGER`, `HR`, `ADMIN`

### Hạ tầng ứng dụng

- Logging: `Pino` hoặc `Winston`
- Security middleware: `helmet`, `cors`, `express-rate-limit`
- Env management: `dotenv`
- Test: `Vitest` hoặc `Jest` + `Supertest`
- Lint/format: `ESLint` + `Prettier`
- Process manager khi deploy VPS: `PM2`
- Container hóa: `Docker` + `docker-compose`

## Vì sao stack này phù hợp với source code hiện tại

### 1. Phù hợp frontend đang có

Frontend hiện tại là `Next.js` và đang dùng mock data cho:

- Đăng nhập
- Dashboard
- Quản lý nhân viên
- Nghỉ phép / overtime / comp-off

Backend `Express.js + REST API` là lựa chọn đơn giản, dễ kết nối với frontend hiện có thông qua `fetch` hoặc `axios`, không cần thay đổi kiến trúc frontend nhiều.

### 2. Phù hợp schema trong `hr_leave_db.sql`

Schema hiện tại đã rất rõ nghiệp vụ HR leave management, gồm các bảng:

- `users`
- `leave_types`
- `leave_requests`
- `overtime_records`
- `comp_off_records`
- `leave_balances`

Ngoài ra còn có:

- `ENUM` cho `user_role`, `leave_request_status`, `overtime_status`
- Quan hệ `foreign key`
- Chỉ mục cơ bản cho các cột tra cứu

`PostgreSQL` rất phù hợp vì:

- Hỗ trợ tốt kiểu dữ liệu quan hệ và transaction
- Hợp với các luồng duyệt đơn, cập nhật quota phép, overtime, comp-off
- Dễ mở rộng báo cáo thống kê sau này

`Prisma` phù hợp vì:

- Mapping tốt với PostgreSQL
- Tạo schema/type an toàn cho TypeScript
- Dễ truy vấn cho CRUD, filter, pagination, quan hệ dữ liệu
- Phù hợp team cần tốc độ phát triển nhanh

### 3. Phù hợp giai đoạn MVP nhưng vẫn mở rộng được

`Express.js` phù hợp ở giai đoạn đầu vì:

- Nhẹ, ít boilerplate
- Dễ chia module theo domain
- Dễ onboarding
- Dễ nâng cấp thêm Redis, queue, file storage, background jobs khi hệ thống lớn hơn

## Cấu trúc backend nên dùng

```txt
backend/
  src/
    app.ts
    server.ts
    config/
      env.ts
      prisma.ts
    middlewares/
      auth.middleware.ts
      role.middleware.ts
      error.middleware.ts
    modules/
      auth/
      users/
      leave-types/
      leave-requests/
      overtime/
      comp-off/
      dashboard/
      reports/
    utils/
    types/
    validations/
  prisma/
    schema.prisma
    migrations/
  tests/
```

## Các module API nên ưu tiên build

### 1. Auth

- `POST /api/auth/login`
- `POST /api/auth/refresh-token`
- `POST /api/auth/logout`
- `GET /api/auth/me`

### 2. Users

- `GET /api/users`
- `GET /api/users/:id`
- `POST /api/users`
- `PATCH /api/users/:id`

### 3. Leave types

- `GET /api/leave-types`
- `POST /api/leave-types`
- `PATCH /api/leave-types/:id`

### 4. Leave requests

- `GET /api/leave-requests`
- `POST /api/leave-requests`
- `PATCH /api/leave-requests/:id/approve`
- `PATCH /api/leave-requests/:id/reject`

### 5. Overtime / comp-off

- `GET /api/overtime`
- `POST /api/overtime`
- `GET /api/comp-off`
- `POST /api/comp-off`

### 6. Dashboard / reports

- `GET /api/dashboard/summary`
- `GET /api/reports/leave`
- `GET /api/reports/overtime`

## Thư viện Node.js / Express.js khuyến nghị

```bash
pnpm add express cors helmet express-rate-limit jsonwebtoken bcrypt zod dotenv pino pino-http @prisma/client
pnpm add -D typescript tsx @types/node @types/express @types/jsonwebtoken @types/bcrypt prisma eslint prettier vitest supertest @types/supertest
```

## Quy ước triển khai dữ liệu

- Dùng `BIGINT`/`BIGSERIAL` đúng như SQL hiện tại để tránh lệch kiểu id
- Giữ `ENUM` ở PostgreSQL cho các trạng thái nghiệp vụ chính
- Dùng transaction cho các tác vụ như:
  - duyệt nghỉ phép
  - cập nhật `leave_balances`
  - tạo comp-off từ overtime
- Thêm `created_at`, `updated_at` thống nhất ở tất cả bảng mới
- Bổ sung migration thay vì sửa tay trực tiếp database sau khi vào giai đoạn phát triển chính thức

## Gợi ý triển khai môi trường

### Local

- App backend chạy `http://localhost:4000`
- Frontend `Next.js` gọi API qua biến môi trường `NEXT_PUBLIC_API_URL`
- Database chạy bằng `PostgreSQL` local hoặc `Docker`

### Production

- Backend: `Node.js + Express.js` chạy bằng `Docker` hoặc `PM2`
- Database: `PostgreSQL`
- Reverse proxy: `Nginx`
- CI/CD: `GitHub Actions`

## Kết luận

Với code hiện tại, tech stack phù hợp nhất để build backend là:

- `Node.js`
- `Express.js`
- `TypeScript`
- `PostgreSQL`
- `Prisma ORM`
- `JWT` cho auth
- `Zod` cho validation

Đây là lựa chọn cân bằng giữa tốc độ phát triển, độ dễ bảo trì và khả năng mở rộng cho bài toán quản lý nghỉ phép, overtime, comp-off và nhân sự nội bộ.
