import { UserRole } from '@prisma/client';

export type AuthenticatedUserLike = {
  role?: UserRole | string | null;
  systemRole?: string | null;
};

export function isSystemSuperAdmin(user?: AuthenticatedUserLike | null) {
  return user?.systemRole?.toUpperCase() === 'ADMIN';
}

export function hasAppRole(user: AuthenticatedUserLike | null | undefined, ...roles: UserRole[]) {
  if (!user) return false;
  return roles.includes(user.role as UserRole);
}

export function canViewAllBirthdays(user?: AuthenticatedUserLike | null) {
  return hasAppRole(user, 'HR', 'ADMIN') || isSystemSuperAdmin(user);
}
