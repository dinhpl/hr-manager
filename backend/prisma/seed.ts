import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

// Placeholder hash for accounts with no password (NULL in source data)
// This hash is for "no-login" — cannot be matched by any real password
const NO_PASSWORD_HASH = '$2b$10$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

// Map system_role from users.json → UserRole enum
// "member" → EMPLOYEE (per plan.txt requirement)
function mapRole(systemRole: string | null): UserRole {
  switch ((systemRole ?? '').toLowerCase()) {
    case 'admin':
      return UserRole.ADMIN;
    case 'hr':
      return UserRole.HR;
    case 'manager':
      return UserRole.MANAGER;
    case 'member':
    default:
      return UserRole.EMPLOYEE;
  }
}

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

  // ── 1. Clear existing users (cascade: leave_balances, leave_requests, etc.) ──
  // Delete in dependency order to avoid FK violations
  await prisma.leaveBalance.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.compOffRecord.deleteMany();
  await prisma.overtimeRecord.deleteMany();
  await prisma.user.deleteMany();
  console.log('🗑️  Cleared all users and dependent records.');

  // ── 2. Leave types ──
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

  // ── 3. Import all users from users.json, id = 1,2,3... in order ──
  // Source data has UUID ids — reassign sequential BigInt ids here
  const usersJsonData = [
    {
      email: 'kawamoto@onetech.jp',
      password: '$2y$10$947UOf8w1Y3KI9j39PcJ0egBqt7bXNP3xb/0.d7xBNLH3n0fpSCrS',
      firstName: 'Naoki',
      lastName: 'Kawamoto',
      systemRole: 'member',
      teamId: null,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'thanglb@onetech.vn',
      password: '$2b$10$EjN7bEXZOtIbtonF1lnWtOc44N8vVqctosHuWbIWIm4gdJhvZE15W',
      firstName: 'Thang',
      lastName: 'Lam Bao',
      systemRole: 'admin',
      teamId: null,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'vietnt@onetech.vn',
      password: '$2b$10$H/s6oQu1tK8wM/fYRS6KYOFHLlogi.pnKKlrXN3g00aKW87fY302m',
      firstName: 'Viet',
      lastName: 'Nguyen Tung',
      systemRole: 'admin',
      teamId: 2,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'wada@onetech.jp',
      password: '$2y$10$bk45VKY.fFpVZSvNJ3MiNOzdzUdqztY6WsM5ZGRZayqB7F19FVKgG',
      firstName: 'Shou',
      lastName: 'Wada',
      systemRole: 'member',
      teamId: null,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'thao@onetech.vn',
      password: '$2y$10$RQmlwQSfFOrsBENWkGgHM.4B5s8u24iSE5Hol2mDeCM0jkIhtxtVO',
      firstName: 'Thao',
      lastName: 'Nguyen Lam',
      systemRole: 'admin',
      teamId: 3,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'dinhpl@onetech.vn',
      password: '$2b$10$HGAL.U0rG.CLUQeDoTAxBew8FV1aM4G1nqAlfMMFhHUdrVUlhuOFS',
      firstName: 'Dinh',
      lastName: 'PL',
      systemRole: 'admin',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'shimojima@onetech.jp',
      password: '$2y$10$YioFzEP4dkszEGlTd6GU0eMVlmeWOHcpu24yF4hHE99gGhd0mjSSu',
      firstName: 'Tuan',
      lastName: 'Nguyen Hong Anh',
      systemRole: 'member',
      teamId: 1,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'hungnv@onetech.vn',
      password: '$2y$10$HmkFirlnXp38ZHw5UHq5pOCV.zs/SQNDuxK.o5uLmalMGMWwHpsbG',
      firstName: 'Hung',
      lastName: 'Nguyen Viet',
      systemRole: 'admin',
      teamId: 1,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'duy@onetech.vn',
      password: '$2a$12$1wHlHSnVf3b9pG01c/GT0.3CTaA6DkF9oUYMyyPAQIj4gcRfiaaHO',
      firstName: 'Duy',
      lastName: 'Le Ba Phuoc',
      systemRole: 'member',
      teamId: 1,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'khanhnb@onetech.vn',
      password: '$2y$10$RVmEJAtkZ5FnVkATgoKsUOYLc2EXM7EkuxaVDNm5N454S.a/LJ/Gi',
      firstName: 'Khanh',
      lastName: 'Nguyen Bao',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'uyennp@onetech.vn',
      password: null,
      firstName: 'Nguyen Phuong',
      lastName: 'Uyen',
      systemRole: 'member',
      teamId: null,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'trint@onetech.vn',
      password: '$2y$10$bU0YGA16DBfm.I3Fy88RluPFdgqEg6g/s86Fdlc4G/7Awc1LUmL82',
      firstName: 'Tri',
      lastName: 'Nguyen Thanh',
      systemRole: 'member',
      teamId: null,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'thang@onetech.vn',
      password: '$2y$10$69Th0azsDM01YE22LNuBZ.gglYbwV6yokS6nWMM8xbxQIh4MhGIvG',
      firstName: 'Thang',
      lastName: 'Lam Bao',
      systemRole: 'member',
      teamId: null,
      isCountable: true,
      isActive: false,
    },
    {
      email: 'nguyendh@onetech.vn',
      password: '$2b$10$h/gZK1n2Y.QnrpIn3lHsl.CiuPO7sKv8MLffEXaYql2/FxrwJ94A2',
      firstName: 'Nguyen',
      lastName: 'Duong Hong',
      systemRole: 'member',
      teamId: 2,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'duy@onetech.jp',
      password: null,
      firstName: 'Duy',
      lastName: 'Le',
      systemRole: 'member',
      teamId: null,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'tamnt@onetech.vn',
      password: '$2a$12$tm3KDgu9SwHDkVdXxAAOV.vCAqBzrH1H10vyWLQUSVsJ6zkWYVH8W',
      firstName: 'Tam',
      lastName: 'Nguyen Thien',
      systemRole: 'admin',
      teamId: null,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'minhlq@onetech.vn',
      password: '$2y$10$mkjqeGZ.m4CDDvAMh91lJuptTi1s.L/Nxl6HDSOVwR/QbRK7sKMy2',
      firstName: 'Minh',
      lastName: 'Le Quang',
      systemRole: 'member',
      teamId: null,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'dienpt@onetech.vn',
      password: '$2y$10$UfxBZjjeWkkLTpZQWMum9eVACISTtcAB/yLW7nT/SBSzyq.vR1Mnm',
      firstName: 'Dien',
      lastName: 'Pham Thi',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'lanhvc_freelancer@onetech.vn',
      password: '$2a$12$4L74gGHAWkGRap0LTbcabOZd9Hj9S/Ek3VDjMc2xiILzgxTn.Zu2W',
      firstName: 'Lanh',
      lastName: 'Van Cong',
      systemRole: 'member',
      teamId: null,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'ptp285@gmail.com',
      password: '$2y$10$4VyENKupovyf.P.dNCT7g.CAbPSZ3mWVBSpLSFmFeM/qjYV5LR1fS',
      firstName: 'Phan Truong',
      lastName: 'Phuc',
      systemRole: 'member',
      teamId: 2,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'thuyntt@onetech.vn',
      password: '$2y$10$EjebqRblr4v9IQJyw4FSheTXvFQOHON7Rt44Bk4RFLJYKDiwf2/hK',
      firstName: 'Nguyen Thi Thanh',
      lastName: 'Thuy',
      systemRole: 'admin',
      teamId: null,
      isCountable: false,
      isActive: true,
    },
    {
      email: 'trangln@onetech.vn',
      password: '$2y$10$F0e2wCizWEgk2T.hKAisLe69VUliB.tNsM38HjlhDzWoOUJmCm/zq',
      firstName: 'Le Nguyen',
      lastName: 'Trang',
      systemRole: 'member',
      teamId: null,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'quochuy91.np@onetech.vn',
      password: '$2y$10$8wH.0cd.zeinVLWus4odweQAH4QXg3E4.AvWUZ7ANwYCd8XGE0WRS',
      firstName: 'Tran Quoc',
      lastName: 'Huy',
      systemRole: 'member',
      teamId: null,
      isCountable: true,
      isActive: false,
    },
    {
      email: 'linhldx@onetech.vn',
      password: '$2y$10$vvRP0.DzM46tyZJ9QDu5quBJtx6q25Az/7G3cIPojyd6FW4WoZAuy',
      firstName: 'La Duong Xuan',
      lastName: 'Linh',
      systemRole: 'member',
      teamId: 2,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'sutv@onetech.vn',
      password: '$2y$10$bmkzNt1r.WiXpHDJ6E8hBOlwZRd8jiLbpfRBmVAPo4kaHPz6PSCfO',
      firstName: 'Tran Van',
      lastName: 'Su',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'datth@onetech.vn',
      password: '$2y$10$tnjAu3kWkBiTKwZLuCzdGuMB9u3.Qg5VWKy3Y14r9a1K9a4.D6OTm',
      firstName: 'Dat',
      lastName: 'Truong Huu',
      systemRole: 'admin',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'hangnt@onetech.vn',
      password: '$2y$10$hk8Bz4h8wGYzlFOJo5vpb.jWEBdWh3Hd3tSMOYgLYA2AF/XURaKHu',
      firstName: 'Hang',
      lastName: 'Nguyen Thuy',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'longht@onetech.vn',
      password: '$2y$10$u2EQm3SkmlosqEtYnYnMCO3BIw.h471HUwi44WbncgsSccRXzQmYi',
      firstName: 'Long',
      lastName: 'Ha Thanh',
      systemRole: 'member',
      teamId: 2,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'emkvt@onetech.vn',
      password: '$2b$10$4vpwTJAL/kvr.Hazb6r2cuV18Cq7gI1ubJzM9/OAwNZWMkguOwFDS',
      firstName: 'Khuu Van',
      lastName: 'Thao Em',
      systemRole: 'member',
      teamId: 2,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'phuckh@onetech.vn',
      password: '$2y$10$k/fGu/f5y69CLK.szccIw.5/nHudAFbf8VpfGswuJm.JTiBPKXWlC',
      firstName: 'Phuc',
      lastName: 'Kieu Hoang',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'uyenth@onetech.vn',
      password: '$2y$10$VmBUWIFzkn/OHoCoqPwfZup31K6421khCKpzi5srHZ/USeKypKQt6',
      firstName: 'Uyen',
      lastName: 'Tran Hong',
      systemRole: 'member',
      teamId: 1,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'thanhdc@onetech.vn',
      password: '$2y$10$e9rb63yrJODAGHoJDw8R.OOT3FxeLL5fWvCSDuNPg50YhxVMcp6im',
      firstName: 'Thanh',
      lastName: 'Din Chi',
      systemRole: 'admin',
      teamId: null,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'thuongpa@onetech.vn',
      password: '$2b$10$HGAL.U0rG.CLUQeDoTAxBew8FV1aM4G1nqAlfMMFhHUdrVUlhuOFS',
      firstName: 'Thuong',
      lastName: 'Pham Anh',
      systemRole: 'member',
      teamId: 2,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'ductv@onetech.vn',
      password: '$2y$10$OrMwXeamCP7bsbFq19lVnuS5huCQGxnHu4j2EIRpEorNz3VXVhyTG',
      firstName: 'Tran Viet',
      lastName: 'Duc',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'dangtv@onetech.vn',
      password: '$2y$10$dwM0KMU8vGvgPqzEViGKheDMiZMfuXe3bLwjjsYPdSEpKJLKgWmbe',
      firstName: 'Tran Van',
      lastName: 'Dang',
      systemRole: 'member',
      teamId: 1,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'thytnt@onetech.vn',
      password: '$2y$10$hl.P2kXmu7mvB0VR4fhJrubF05TuElEbWPSc3847.5zpbXs.FD71S',
      firstName: 'Truong Ngoc Thy',
      lastName: 'Thy',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'hoaitm@onetech.vn',
      password: '$2y$10$tSuGjRcWrd7fh58WuPTk5embjCeoNMbkVErIgr3TuuP3ZBN2Y3LeK',
      firstName: 'Hoai',
      lastName: 'Tran Minh',
      systemRole: 'member',
      teamId: 2,
      isCountable: true,
      isActive: true,
    },
    {
      email: 'minhlq.ot@gmail.com',
      password: '$2y$10$63Qwx/X/dWntq0hNAogRfe8zLlz4TMHnhhiRepEll/toB/VD0B/UG',
      firstName: 'Minh',
      lastName: 'Le Quang',
      systemRole: 'member',
      teamId: 3,
      isCountable: true,
      isActive: true,
    },
  ];

  // Build user records: id 1,2,3..., username = email prefix, role = role = systemRole (uppercase)
  const usersData = usersJsonData.map((u, index) => {
    const role = mapRole(u.systemRole);
    return {
      id: BigInt(index + 1),
      email: u.email,
      // username = part before '@', replace dots/special chars to ensure uniqueness
      username: u.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '_'),
      password: u.password ?? NO_PASSWORD_HASH,
      fullName: `${u.firstName} ${u.lastName}`.trim(),
      firstName: u.firstName,
      lastName: u.lastName,
      role,
      // role and systemRole must match (same value, per plan.txt)
      systemRole: role as string,
      teamId: u.teamId,
      isCountable: u.isCountable,
      isActive: u.isActive,
    };
  });

  await prisma.user.createMany({ data: usersData, skipDuplicates: true });
  console.log(`👥 Imported ${usersData.length} users.`);

  // Print admin accounts for easy login reference
  const admins = usersData.filter((u) => u.role === UserRole.ADMIN);
  admins.forEach((u) => console.log(`  👤 ADMIN: ${u.email} (username: ${u.username})`));

  // ── 4. Departments ──
  await prisma.department.createMany({
    data: [
      { id: 1n, code: 'EXISTING', name: 'Existing', isActive: true },
      { id: 2n, code: 'MK', name: 'MK', isActive: true },
      { id: 3n, code: 'NEXCONSTRUCT', name: 'NexConstruct', isActive: true },
    ],
    skipDuplicates: true,
  });
  console.log('🏢 Seeded 3 departments.');

  // ── 5. Default settings ──
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

  // Sync auto-increment sequences after bulk insert with explicit ids
  await Promise.all([
    syncSequence('leave_types'),
    syncSequence('users'),
    syncSequence('departments'),
  ]);

  console.log('✅ Seed complete');
  console.log('ℹ️  Note: Original password hashes preserved from users.json');
  console.log('ℹ️  Accounts with NULL password cannot login (no valid hash)');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
