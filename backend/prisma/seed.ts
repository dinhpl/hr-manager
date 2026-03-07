import prisma from '../src/config/prisma';

async function syncSequence(tableName: string, columnName = 'id') {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"${tableName}"', '${columnName}'),
      COALESCE((SELECT MAX("${columnName}") FROM "${tableName}"), 1),
      true
    )
  `);
}

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Leave types (AL, SL, WFH, UL, BL, ML)
  await prisma.leaveType.createMany({
    data: [
      {
        id: 1n,
        code: 'AL',
        name: 'Nghỉ phép năm',
        defaultDays: 12,
        isPaid: true,
        color: '#1DB87A',
      },
      { id: 2n, code: 'SL', name: 'Nghỉ ốm', defaultDays: 30, isPaid: true, color: '#ef4444' },
      { id: 3n, code: 'WFH', name: 'Làm từ xa', defaultDays: 0, isPaid: true, color: '#3b82f6' },
      {
        id: 4n,
        code: 'UL',
        name: 'Nghỉ không lương',
        defaultDays: 0,
        isPaid: false,
        color: '#6b7280',
      },
      { id: 5n, code: 'BL', name: 'Nghỉ cưới', defaultDays: 3, isPaid: true, color: '#8b5cf6' },
      { id: 6n, code: 'ML', name: 'Nghỉ tang', defaultDays: 3, isPaid: true, color: '#374151' },
    ],
    skipDuplicates: true,
  });

  // 2. Users — password hash = "password123"
  // Hash: $2b$10$O10wd5iD0C.k4RJuycVci.hgUQ66.j8JECoXgPb2G6xKFE9AghT3i
  await prisma.user.createMany({
    data: [
      {
        id: 1n,
        email: 'admin@company.com',
        username: 'admin',
        password: '$2b$10$O10wd5iD0C.k4RJuycVci.hgUQ66.j8JECoXgPb2G6xKFE9AghT3i',
        fullName: 'Quản trị viên',
        role: 'ADMIN',
        department: 'IT',
        position: 'System Admin',
        isActive: true,
      },
      {
        id: 2n,
        email: 'hr@company.com',
        username: 'hr_nguyen',
        password: '$2b$10$O10wd5iD0C.k4RJuycVci.hgUQ66.j8JECoXgPb2G6xKFE9AghT3i',
        fullName: 'Nguyễn Thị HR',
        role: 'HR',
        department: 'HR',
        position: 'HR Manager',
        isActive: true,
      },
      {
        id: 3n,
        email: 'manager@company.com',
        username: 'manager_tran',
        password: '$2b$10$O10wd5iD0C.k4RJuycVci.hgUQ66.j8JECoXgPb2G6xKFE9AghT3i',
        fullName: 'Trần Văn Manager',
        role: 'MANAGER',
        department: 'Engineering',
        position: 'Team Lead',
        isActive: true,
      },
      {
        id: 4n,
        email: 'employee@company.com',
        username: 'emp_le',
        password: '$2b$10$O10wd5iD0C.k4RJuycVci.hgUQ66.j8JECoXgPb2G6xKFE9AghT3i',
        fullName: 'Lê Thị Employee',
        role: 'EMPLOYEE',
        department: 'Engineering',
        position: 'Developer',
        managerId: 3n,
        isActive: true,
      },
      {
        id: 10n,
        email: 'emp2@company.com',
        username: 'emp_pham',
        password: '$2b$10$O10wd5iD0C.k4RJuycVci.hgUQ66.j8JECoXgPb2G6xKFE9AghT3i',
        fullName: 'Phạm Văn Employee 2',
        role: 'EMPLOYEE',
        department: 'Engineering',
        position: 'Developer',
        managerId: 3n,
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });

  // 3. Leave balances for admin (year 2026, AL type)
  await prisma.leaveBalance.createMany({
    data: [
      { id: 1n, userId: 1n, leaveTypeId: 1n, year: 2026, totalDays: 12, usedDays: 1 },
      { userId: 2n, leaveTypeId: 1n, year: 2026, totalDays: 12, usedDays: 0 },
      { userId: 3n, leaveTypeId: 1n, year: 2026, totalDays: 12, usedDays: 0 },
      { userId: 4n, leaveTypeId: 1n, year: 2026, totalDays: 12, usedDays: 0 },
      { userId: 10n, leaveTypeId: 1n, year: 2026, totalDays: 12, usedDays: 2 },
    ],
    skipDuplicates: true,
  });

  // 4. Default settings
  await prisma.setting.createMany({
    data: [
      {
        key: 'leave_policy',
        value: {
          maxConsecutiveDays: 14,
          minAdvanceNoticeDays: 1,
          allowHalfDay: true,
          requireAttachment: false,
        },
      },
      {
        key: 'approval_flow',
        value: {
          requireManagerApproval: true,
          requireHrApproval: false,
          autoApproveWfh: false,
        },
      },
    ],
    skipDuplicates: true,
  });

  await Promise.all([
    syncSequence('leave_types'),
    syncSequence('users'),
    syncSequence('leave_balances'),
  ]);

  console.log('✅ Seed complete');
  console.log('👤 Login: admin@company.com / password123');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
