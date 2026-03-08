export type FrontendRole = 'employee' | 'manager' | 'hr' | 'admin';

export function toFrontendRole(role?: string | null): FrontendRole {
  switch ((role ?? '').toUpperCase()) {
    case 'MANAGER':
      return 'manager';
    case 'HR':
      return 'hr';
    case 'ADMIN':
      return 'admin';
    default:
      return 'employee';
  }
}

export function toBackendRole(role?: string | null): string {
  return (role ?? '').toUpperCase();
}

export function getRoleLabel(role?: string | null) {
  switch (toBackendRole(role)) {
    case 'MANAGER':
      return 'Quản lý';
    case 'HR':
      return 'HR';
    case 'ADMIN':
      return 'Admin';
    default:
      return 'Nhân viên';
  }
}

export function getStatusLabel(status?: string | null) {
  switch ((status ?? '').toUpperCase()) {
    case 'PENDING':
      return 'pending';
    case 'APPROVED':
      return 'approved';
    case 'REJECTED':
      return 'rejected';
    case 'CANCELLED':
      return 'cancelled';
    default:
      return 'draft';
  }
}

// Format date as "HH:mm D/M/YYYY" — e.g. "09:30 8/3/2026"
function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

export function formatDateVN(value?: string | Date | null) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  return `${hh}:${mm} ${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
}

export function formatDateTimeVN(value?: string | Date | null) {
  return formatDateVN(value);
}

export function toDateInputValue(value?: string | Date | null) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

export function toIsoDateTime(value: string, endOfDay = false) {
  if (!value) return '';
  const suffix = endOfDay ? 'T23:59:59.999Z' : 'T00:00:00.000Z';
  return new Date(`${value}${suffix}`).toISOString();
}

export function numberValue(value: unknown) {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') return Number(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    return Number(String(value));
  }
  return 0;
}

export function getFullName(user: {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  username?: string | null;
}) {
  return (
    user.fullName ??
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ??
    user.username ??
    'Người dùng'
  );
}

export function buildQuery(params: Record<string, string | number | undefined | null>) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  return searchParams.toString();
}
