// Test environment setup
process.env.DATABASE_URL = "postgresql://postgres:secret@localhost:5432/hr_leave_db_test";
process.env.JWT_ACCESS_SECRET = "test-access-secret-at-least-16-chars";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-at-least-16-chars";
process.env.JWT_ACCESS_EXPIRES_IN = "15m";
process.env.JWT_REFRESH_EXPIRES_IN = "7d";
process.env.PORT = "4001";
process.env.NODE_ENV = "test";
process.env.FRONTEND_URL = "http://localhost:3000";
process.env.UPLOAD_DIR = "uploads/leave-attachments";
process.env.MAIL_ENABLED = "false";
process.env.MAIL_PORT = "587";
process.env.MAIL_SECURE = "false";
process.env.MAIL_FROM_EMAIL = "no-reply@example.com";
process.env.MAIL_FROM_NAME = "OTA HR System";
