import prisma from '../../config/prisma';
import { UserRole } from '@prisma/client';
import { hashPassword } from '../../utils/hash';
import { getPaginationParams, buildMeta } from '../../utils/pagination';
import { canViewAllBirthdays } from '../../utils/authz';
import { GetUsersQuery, CreateUserDto, UpdateUserDto } from './users.validation';
import * as XLSX from 'xlsx';
import { syncCurrentYearAnnualLeaveBalanceForUser } from '../leave-balances/leave-balances.service';

type AuthUser = {
  id: bigint;
  role: UserRole;
  systemRole?: string | null;
};

// Fields returned in list/detail — password excluded
const USER_SELECT = {
  id: true,
  email: true,
  username: true,
  employeeCode: true,
  fullName: true,
  firstName: true,
  lastName: true,
  role: true,
  department: true,
  position: true,
  avatar: true,
  teamId: true,
  isCountable: true,
  companyJoinDate: true,
  birthday: true,
  gender: true,
  phone: true,
  isActive: true,
  createdAt: true,
  manager: { select: { id: true, fullName: true, username: true } },
} as const;

async function syncUsersIdSequence() {
  await prisma.$executeRawUnsafe(`
    SELECT setval(
      pg_get_serial_sequence('"users"', 'id'),
      COALESCE((SELECT MAX(id) FROM "users"), 1),
      true
    )
  `);
}

export async function getUsers(query: GetUsersQuery) {
  const { search, department, role, status, page, limit } = query;
  const { skip } = getPaginationParams(query);

  const where = {
    ...(search && {
      OR: [
        { fullName: { contains: search, mode: 'insensitive' as const } },
        { email: { contains: search, mode: 'insensitive' as const } },
        { username: { contains: search, mode: 'insensitive' as const } },
        { employeeCode: { contains: search, mode: 'insensitive' as const } },
      ],
    }),
    ...(department && { department }),
    ...(role && { role }),
    ...(status === 'active' && { isActive: true }),
    ...(status === 'inactive' && { isActive: false }),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: USER_SELECT,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.count({ where }),
  ]);

  return { data: users, meta: buildMeta(total, page, limit) };
}

export async function getUserById(id: bigint, requestingUser: AuthUser) {
  const scopeUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, managerId: true },
  });

  if (!scopeUser) throw Object.assign(new Error('User not found'), { status: 404 });

  const canView =
    requestingUser.role === 'ADMIN' ||
    requestingUser.role === 'HR' ||
    requestingUser.id === id ||
    (requestingUser.role === 'MANAGER' && scopeUser.managerId === requestingUser.id);

  if (!canView) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      ...USER_SELECT,
      leaveBalances: {
        where: { year: new Date().getFullYear() },
        include: { leaveType: { select: { code: true, name: true, color: true } } },
      },
    },
  });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });
  return user;
}

export async function createUser(data: CreateUserDto) {
  const {
    password,
    managerId,
    companyJoinDate,
    birthday,
    email,
    username,
    employeeCode,
    fullName,
    firstName,
    lastName,
    role,
    department,
    position,
    isCountable,
    gender,
    phone,
  } = data;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { username }, ...(employeeCode ? [{ employeeCode }] : [])],
    },
  });
  if (existing) {
    throw Object.assign(new Error('Email, username, or employee code already exists'), {
      status: 409,
    });
  }

  const hashedPassword = await hashPassword(password);
  await syncUsersIdSequence();

  const user = await prisma.user.create({
    data: {
      email,
      username,
      ...(employeeCode && { employeeCode }),
      password: hashedPassword,
      fullName,
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(role && { role }),
      ...(department && { department }),
      ...(position && { position }),
      ...(isCountable !== undefined && { isCountable }),
      ...(managerId && { manager: { connect: { id: managerId } } }),
      ...(companyJoinDate && { companyJoinDate: new Date(companyJoinDate) }),
      ...(birthday && { birthday: new Date(birthday) }),
      ...(gender && { gender }),
      ...(phone && { phone }),
    },
    select: USER_SELECT,
  });

  await syncCurrentYearAnnualLeaveBalanceForUser(user.id);
  return user;
}

export async function updateUser(id: bigint, data: UpdateUserDto) {
  // Verify user exists
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw Object.assign(new Error('User not found'), { status: 404 });

  const { password, companyJoinDate, birthday, managerId, ...rest } = data;

  if (managerId === id) {
    throw Object.assign(new Error('User cannot be their own manager'), { status: 400 });
  }

  if (rest.email) {
    const duplicated = await prisma.user.findFirst({
      where: {
        email: rest.email,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicated) {
      throw Object.assign(new Error('Email already exists'), { status: 409 });
    }
  }

  if (rest.username) {
    const duplicated = await prisma.user.findFirst({
      where: {
        username: rest.username,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicated) {
      throw Object.assign(new Error('Username already exists'), { status: 409 });
    }
  }

  if (rest.employeeCode) {
    const duplicated = await prisma.user.findFirst({
      where: {
        employeeCode: rest.employeeCode,
        id: { not: id },
      },
      select: { id: true },
    });

    if (duplicated) {
      throw Object.assign(new Error('Employee code already exists'), { status: 409 });
    }
  }

  const hashedPassword = password ? await hashPassword(password) : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...rest,
      ...(hashedPassword && { password: hashedPassword }),
      ...(managerId !== undefined && {
        manager: managerId === null ? { disconnect: true } : { connect: { id: managerId } },
      }),
      ...(companyJoinDate !== undefined && {
        companyJoinDate: companyJoinDate ? new Date(companyJoinDate) : null,
      }),
      ...(birthday !== undefined && {
        birthday: birthday ? new Date(birthday) : null,
      }),
    },
    select: USER_SELECT,
  });

  if (companyJoinDate !== undefined) {
    await syncCurrentYearAnnualLeaveBalanceForUser(user.id);
  }

  return user;
}

export async function deleteUser(id: bigint) {
  const exists = await prisma.user.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw Object.assign(new Error('User not found'), { status: 404 });
  // Soft delete only
  await prisma.user.update({ where: { id }, data: { isActive: false } });
}

// Birthday map for a given month: "YYYY-MM-DD" → list of employees with birthday that day
export async function getUsersBirthdaysByMonth(
  year: number,
  month: number,
  caller?: AuthUser | null,
) {
  const canSeeAllBirthdays = canViewAllBirthdays(caller);

  const whereClause: Record<string, unknown> = { birthday: { not: null }, isActive: true };
  if (!canSeeAllBirthdays) {
    whereClause.hideBirthday = false;
  }

  const users = await prisma.user.findMany({
    where: whereClause,
    select: {
      id: true,
      fullName: true,
      department: true,
      position: true,
      birthday: true,
    },
  });

  const result: Record<
    string,
    { id: string; name: string; department: string | null; position: string | null }[]
  > = {};

  for (const user of users) {
    const bday = user.birthday!;
    if (bday.getMonth() + 1 === month) {
      const day = bday.getDate();
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (!result[dateStr]) result[dateStr] = [];
      result[dateStr].push({
        id: String(user.id),
        name: user.fullName,
        department: user.department,
        position: user.position,
      });
    }
  }

  return result;
}

// Dropdown for leave-request form handover selector
export async function getUsersDropdown() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: {
      id: true,
      fullName: true,
      username: true,
      employeeCode: true,
      department: true,
      role: true,
    },
    orderBy: { fullName: 'asc' },
  });
}

// ─── Date helpers ────────────────────────────────────────────────────────────

function formatDDMMYYYY(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0');
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

function parseDDMMYYYY(value: string | Date): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  const s = String(value).trim();
  // DD/MM/YYYY
  const match = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, d, mo, y] = match;
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    return isNaN(date.getTime()) ? null : date;
  }
  // Fallback: ISO or other formats
  const fallback = new Date(s);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// ─── Export / Import column mapping ─────────────────────────────────────────

type UserImportRow = {
  id?: string;
  employee_code?: string;
  email?: string;
  username?: string;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  gender?: string;
  birthday?: string | Date;
  phone?: string;
  department?: string;
  position?: string;
  company_join_date?: string | Date;
  manager_username?: string;
  is_countable?: string | boolean;
  is_active?: string | boolean;
};

type UserColumnDefinition = {
  key: keyof UserImportRow;
  label: string;
  aliases: string[];
};

const USER_COLUMNS: UserColumnDefinition[] = [
  { key: 'id', label: 'ID', aliases: ['id', 'mã bản ghi', 'record id'] },
  { key: 'employee_code', label: 'Mã nhân viên', aliases: ['employee_code', 'employee code'] },
  { key: 'email', label: 'Email', aliases: ['email'] },
  { key: 'username', label: 'Tên đăng nhập', aliases: ['username', 'user name'] },
  { key: 'full_name', label: 'Họ và tên', aliases: ['full_name', 'full name', 'họ tên'] },
  { key: 'first_name', label: 'Tên', aliases: ['first_name', 'first name'] },
  { key: 'last_name', label: 'Họ', aliases: ['last_name', 'last name'] },
  { key: 'gender', label: 'Giới tính', aliases: ['gender'] },
  { key: 'birthday', label: 'Ngày sinh', aliases: ['birthday', 'date of birth'] },
  { key: 'phone', label: 'Số điện thoại', aliases: ['phone', 'phone number'] },
  { key: 'department', label: 'Phòng ban', aliases: ['department'] },
  { key: 'position', label: 'Chức vụ', aliases: ['position'] },
  {
    key: 'company_join_date',
    label: 'Ngày vào công ty',
    aliases: ['company_join_date', 'company join date', 'join date'],
  },
  {
    key: 'manager_username',
    label: 'Tên đăng nhập quản lý',
    aliases: ['manager_username', 'manager username', 'quản lý trực tiếp'],
  },
  {
    key: 'is_countable',
    label: 'Tính công',
    aliases: ['is_countable', 'countable', 'cham cong', 'tính công'],
  },
  {
    key: 'is_active',
    label: 'Đang hoạt động',
    aliases: ['is_active', 'active', 'trạng thái hoạt động'],
  },
];

const USER_EXPORT_HEADERS = USER_COLUMNS.map((column) => column.label);

function normalizeImportHeader(value: unknown) {
  return String(value ?? '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function remapSheetRows<T extends Record<string, unknown>>(
  rows: Record<string, unknown>[],
  columns: Array<{ key: keyof T; label: string; aliases: string[] }>,
) {
  const aliasMap = new Map<string, keyof T>();

  columns.forEach((column) => {
    [column.label, ...column.aliases].forEach((alias) => {
      aliasMap.set(normalizeImportHeader(alias), column.key);
    });
  });

  return rows.map((row) => {
    const mapped = {} as T;

    Object.entries(row).forEach(([rawKey, value]) => {
      const targetKey = aliasMap.get(normalizeImportHeader(rawKey));
      if (targetKey) {
        mapped[targetKey] = value as T[keyof T];
      }
    });

    return mapped;
  });
}

export async function exportUsersExcel(): Promise<Buffer> {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      fullName: true,
      firstName: true,
      lastName: true,
      department: true,
      position: true,
      isCountable: true,
      companyJoinDate: true,
      manager: { select: { username: true } },
      isActive: true,
      employeeCode: true,
      birthday: true,
      gender: true,
      phone: true,
    },
    orderBy: { id: 'asc' },
  });

  const rows = users.map((u) => ({
    ID: String(u.id),
    'Mã nhân viên': u.employeeCode ?? '',
    Email: u.email,
    'Tên đăng nhập': u.username,
    'Họ và tên': u.fullName,
    Tên: u.firstName ?? '',
    Họ: u.lastName ?? '',
    'Giới tính': u.gender ?? '',
    'Ngày sinh': u.birthday ? formatDDMMYYYY(u.birthday) : '',
    'Số điện thoại': u.phone ?? '',
    'Phòng ban': u.department ?? '',
    'Chức vụ': u.position ?? '',
    'Ngày vào công ty': u.companyJoinDate ? formatDDMMYYYY(u.companyJoinDate) : '',
    'Tên đăng nhập quản lý': u.manager?.username ?? '',
    'Tính công': u.isCountable,
    'Đang hoạt động': u.isActive,
  }));

  const ws = XLSX.utils.json_to_sheet(rows, { header: USER_EXPORT_HEADERS });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Employees');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ─── Import ──────────────────────────────────────────────────────────────────

export async function importUsersExcel(fileBuffer: Buffer): Promise<{
  created: number;
  updated: number;
  errors: { row: number; message: string }[];
}> {
  const wb = XLSX.read(fileBuffer, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const sourceRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });
  const rawRows = remapSheetRows<UserImportRow>(sourceRows, USER_COLUMNS);

  // Pre-load all users for manager username → id mapping
  const allUsers = await prisma.user.findMany({
    select: { id: true, username: true, email: true },
  });
  const usernameToId = new Map(allUsers.map((u) => [u.username, u.id]));
  const emailToId = new Map(allUsers.map((u) => [u.email, u.id]));

  let created = 0;
  let updated = 0;
  const errors: { row: number; message: string }[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const row = rawRows[i];
    const rowNum = i + 2; // 1-indexed + header

    try {
      if (!row.email) {
        errors.push({ row: rowNum, message: 'Email là bắt buộc' });
        continue;
      }

      // Resolve manager_id from username
      let managerId: bigint | null = null;
      if (row.manager_username) {
        const mid = usernameToId.get(String(row.manager_username));
        managerId = mid ?? null;
      }

      // Parse booleans
      const isCountable =
        row.is_countable === true || String(row.is_countable).trim().toLowerCase() === 'true';
      const isActive =
        row.is_active === '' || row.is_active === undefined
          ? true
          : row.is_active === true || String(row.is_active).trim().toLowerCase() === 'true';

      // Parse dates
      const companyJoinDate = row.company_join_date
        ? parseDDMMYYYY(String(row.company_join_date))
        : null;
      const birthday = row.birthday ? parseDDMMYYYY(String(row.birthday)) : null;

      // Validate gender
      const gender =
        row.gender && ['male', 'female', 'other'].includes(String(row.gender).toLowerCase())
          ? String(row.gender).toLowerCase()
          : null;

      const existingId = emailToId.get(String(row.email));

      const payload = {
        fullName: String(row.full_name || ''),
        firstName: row.first_name ? String(row.first_name) : null,
        lastName: row.last_name ? String(row.last_name) : null,
        username: row.username ? String(row.username) : undefined,
        employeeCode: row.employee_code ? String(row.employee_code) : null,
        department: row.department ? String(row.department) : null,
        position: row.position ? String(row.position) : null,
        isCountable,
        isActive,
        companyJoinDate,
        birthday,
        gender,
        phone: row.phone ? String(row.phone) : null,
      };

      if (existingId) {
        // Update existing user
        await prisma.user.update({
          where: { id: existingId },
          data: {
            ...payload,
            ...(managerId !== undefined && {
              manager: managerId === null ? { disconnect: true } : { connect: { id: managerId } },
            }),
          },
        });
        updated++;
      } else {
        // Create new user — password defaults to email, must be changed
        const hashedPassword = await hashPassword(String(row.email));
        const username =
          payload.username ||
          String(row.email)
            .split('@')[0]
            .replace(/[^a-z0-9._-]/gi, '.')
            .toLowerCase();

        await syncUsersIdSequence();
        await prisma.user.create({
          data: {
            email: String(row.email),
            username,
            password: hashedPassword,
            fullName: payload.fullName || username,
            firstName: payload.firstName ?? undefined,
            lastName: payload.lastName ?? undefined,
            employeeCode: payload.employeeCode ?? undefined,
            department: payload.department ?? undefined,
            position: payload.position ?? undefined,
            isCountable: payload.isCountable,
            isActive: payload.isActive,
            companyJoinDate: payload.companyJoinDate ?? undefined,
            birthday: payload.birthday ?? undefined,
            gender: payload.gender ?? undefined,
            phone: payload.phone ?? undefined,
            role: 'EMPLOYEE',
            ...(managerId && { manager: { connect: { id: managerId } } }),
          },
        });
        // Add to maps for subsequent rows
        const newUser = await prisma.user.findUnique({
          where: { email: String(row.email) },
          select: { id: true, username: true },
        });
        if (newUser) {
          usernameToId.set(newUser.username, newUser.id);
          emailToId.set(String(row.email), newUser.id);
        }
        created++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      errors.push({ row: rowNum, message: msg });
    }
  }

  return { created, updated, errors };
}
