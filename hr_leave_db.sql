-- PostgreSQL bootstrap script generated from hr_leave_db.json
-- Table names and column names are normalized to snake_case.
-- Run with: psql -U postgres -f hr_leave_db.sql

CREATE DATABASE hr_leave_db;
\connect hr_leave_db;

CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'MANAGER', 'HR', 'ADMIN');
CREATE TYPE leave_request_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE overtime_status AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE users (
    id BIGSERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    role user_role NOT NULL DEFAULT 'EMPLOYEE',
    system_role VARCHAR(100),
    source_role VARCHAR(100),
    role_id INTEGER,
    department VARCHAR(100),
    position VARCHAR(150),
    avatar TEXT,
    profile_image_url TEXT,
    team_id INTEGER,
    is_countable BOOLEAN NOT NULL DEFAULT TRUE,
    pre_join_date TIMESTAMP,
    company_join_date TIMESTAMP,
    manager_id BIGINT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_users_manager
        FOREIGN KEY (manager_id) REFERENCES users(id)
);

CREATE TABLE leave_types (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    default_days NUMERIC(10,2) NOT NULL DEFAULT 0,
    is_paid BOOLEAN NOT NULL DEFAULT TRUE,
    color VARCHAR(20) NOT NULL DEFAULT '#1DB87A',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE overtime_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    date TIMESTAMP NOT NULL,
    hours NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status overtime_status NOT NULL DEFAULT 'PENDING',
    approver_id BIGINT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_overtime_records_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_overtime_records_approver
        FOREIGN KEY (approver_id) REFERENCES users(id)
);

CREATE TABLE leave_requests (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    leave_type_id BIGINT NOT NULL,
    from_date TIMESTAMP NOT NULL,
    to_date TIMESTAMP NOT NULL,
    total_days NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status leave_request_status NOT NULL DEFAULT 'PENDING',
    approver_id BIGINT,
    approved_at TIMESTAMP,
    approved_note TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_requests_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_leave_requests_leave_type
        FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
    CONSTRAINT fk_leave_requests_approver
        FOREIGN KEY (approver_id) REFERENCES users(id)
);

CREATE TABLE comp_off_records (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    overtime_id BIGINT,
    from_date TIMESTAMP NOT NULL,
    to_date TIMESTAMP NOT NULL,
    total_days NUMERIC(10,2) NOT NULL,
    reason TEXT NOT NULL,
    status leave_request_status NOT NULL DEFAULT 'PENDING',
    approver_id BIGINT,
    approved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_comp_off_records_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_comp_off_records_overtime
        FOREIGN KEY (overtime_id) REFERENCES overtime_records(id),
    CONSTRAINT fk_comp_off_records_approver
        FOREIGN KEY (approver_id) REFERENCES users(id)
);

CREATE TABLE leave_balances (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    leave_type_id BIGINT NOT NULL,
    year INTEGER NOT NULL,
    total_days NUMERIC(10,2) NOT NULL DEFAULT 0,
    used_days NUMERIC(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_balances_user
        FOREIGN KEY (user_id) REFERENCES users(id),
    CONSTRAINT fk_leave_balances_leave_type
        FOREIGN KEY (leave_type_id) REFERENCES leave_types(id),
    CONSTRAINT uq_leave_balances_user_leave_type_year
        UNIQUE (user_id, leave_type_id, year)
);

CREATE INDEX idx_users_manager_id ON users(manager_id);
CREATE INDEX idx_overtime_records_user_id ON overtime_records(user_id);
CREATE INDEX idx_overtime_records_approver_id ON overtime_records(approver_id);
CREATE INDEX idx_leave_requests_user_id ON leave_requests(user_id);
CREATE INDEX idx_leave_requests_leave_type_id ON leave_requests(leave_type_id);
CREATE INDEX idx_leave_requests_approver_id ON leave_requests(approver_id);
CREATE INDEX idx_comp_off_records_user_id ON comp_off_records(user_id);
CREATE INDEX idx_comp_off_records_overtime_id ON comp_off_records(overtime_id);
CREATE INDEX idx_comp_off_records_approver_id ON comp_off_records(approver_id);
CREATE INDEX idx_leave_balances_user_id ON leave_balances(user_id);
CREATE INDEX idx_leave_balances_leave_type_id ON leave_balances(leave_type_id);

INSERT INTO users (
    id, email, username, password, full_name, first_name, last_name, role,
    system_role, source_role, role_id, department, position, avatar,
    profile_image_url, team_id, is_countable, pre_join_date, company_join_date, manager_id,
    is_active, created_at, updated_at
) VALUES
    (
        1, 'admin@company.com', 'admin',
        '$2b$10$QwlcTGyAdCPRkkX41sjxrOy3zmJSfyBR88E2W8QSIcr.cdmyynBAy',
        'Quản trị viên', NULL, NULL, 'ADMIN',
        NULL, NULL, NULL, 'IT', 'System Admin', NULL,
        NULL, NULL, TRUE, NULL, NULL,
        TRUE, '2026-03-04 17:50:06.806', '2026-03-04 17:50:06.806'
    ),
    (
        3, 'placeholder3@company.com', 'user_3',
        'placeholder_hash', 'Placeholder User 3', NULL, NULL, 'EMPLOYEE',
        NULL, NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, TRUE, NULL, NULL,
        TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        4, 'placeholder4@company.com', 'user_4',
        'placeholder_hash', 'Placeholder User 4', NULL, NULL, 'EMPLOYEE',
        NULL, NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, TRUE, NULL, NULL,
        TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    ),
    (
        10, 'placeholder10@company.com', 'user_10',
        'placeholder_hash', 'Placeholder User 10', NULL, NULL, 'EMPLOYEE',
        NULL, NULL, NULL, NULL, NULL, NULL,
        NULL, NULL, TRUE, NULL, NULL,
        TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
    );

INSERT INTO leave_types (
    id, code, name, description, default_days, is_paid, color, is_active, created_at, updated_at
) VALUES
    (1, 'AL', 'Nghỉ phép năm', NULL, 12, TRUE, '#1DB87A', TRUE, '2026-03-04 17:50:06.479', '2026-03-04 17:50:06.479'),
    (2, 'SL', 'Nghỉ ốm', NULL, 30, TRUE, '#ef4444', TRUE, '2026-03-04 17:50:06.558', '2026-03-04 17:50:06.558'),
    (3, 'WFH', 'Làm từ xa', NULL, 0, TRUE, '#3b82f6', TRUE, '2026-03-04 17:50:06.587', '2026-03-04 17:50:06.587'),
    (4, 'UL', 'Nghỉ không lương', NULL, 0, FALSE, '#6b7280', TRUE, '2026-03-04 17:50:06.595', '2026-03-04 17:50:06.595'),
    (5, 'BL', 'Nghỉ cưới', NULL, 3, TRUE, '#8b5cf6', TRUE, '2026-03-04 17:50:06.6', '2026-03-04 17:50:06.6'),
    (6, 'ML', 'Nghỉ tang', NULL, 3, TRUE, '#374151', TRUE, '2026-03-04 17:50:06.605', '2026-03-04 17:50:06.605');

INSERT INTO overtime_records (
    id, user_id, date, hours, reason, status, approver_id, approved_at, created_at, updated_at
) VALUES
    (
        1, 4, '2026-03-04 00:00:00', 2,
        'BigInt migration smoke overtime', 'APPROVED', 3,
        '2026-03-04 18:12:17.895', '2026-03-04 18:12:17.889', '2026-03-04 18:12:17.896'
    );

INSERT INTO leave_requests (
    id, user_id, leave_type_id, from_date, to_date, total_days, reason,
    status, approver_id, approved_at, approved_note, created_at, updated_at
) VALUES
    (
        2, 10, 1, '2026-03-05 00:00:00', '2026-03-06 00:00:00', 2, '1',
        'APPROVED', 1, '2026-03-05 03:45:49.392', NULL, '2026-03-04 18:19:02.931', '2026-03-05 03:45:49.392'
    );

INSERT INTO comp_off_records (
    id, user_id, overtime_id, from_date, to_date, total_days, reason,
    status, approver_id, approved_at, created_at, updated_at
) VALUES
    (
        2, 1, NULL, '2026-03-07 10:11:41', '2026-03-07 10:11:38', 1, '1',
        'PENDING', 1, '2026-03-07 10:11:50', '2026-03-07 10:12:08.907', '2026-03-07 10:11:59'
    );

INSERT INTO leave_balances (
    id, user_id, leave_type_id, year, total_days, used_days, created_at, updated_at
) VALUES
    (1, 1, 1, 2026, 12, 1, '2026-03-04 17:50:06.837', '2026-03-04 17:50:06.837');

SELECT setval(pg_get_serial_sequence('users', 'id'), COALESCE(MAX(id), 1), TRUE) FROM users;
SELECT setval(pg_get_serial_sequence('leave_types', 'id'), COALESCE(MAX(id), 1), TRUE) FROM leave_types;
SELECT setval(pg_get_serial_sequence('overtime_records', 'id'), COALESCE(MAX(id), 1), TRUE) FROM overtime_records;
SELECT setval(pg_get_serial_sequence('leave_requests', 'id'), COALESCE(MAX(id), 1), TRUE) FROM leave_requests;
SELECT setval(pg_get_serial_sequence('comp_off_records', 'id'), COALESCE(MAX(id), 1), TRUE) FROM comp_off_records;
SELECT setval(pg_get_serial_sequence('leave_balances', 'id'), COALESCE(MAX(id), 1), TRUE) FROM leave_balances;
