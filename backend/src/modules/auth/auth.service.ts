import prisma from '../../config/prisma';
import { comparePassword, hashPassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import type { UpdateProfileDto, ChangePasswordDto } from './auth.validation';

// Login: find user by username or email, verify password, return tokens + user info
export async function login(username: string, password: string, rememberMe = false) {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username }, { email: username }],
      isActive: true,
    },
  });

  if (!user) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const valid = await comparePassword(password, user.password);
  if (!valid) throw Object.assign(new Error('Invalid credentials'), { status: 401 });

  const payload = {
    id: user.id.toString(),
    email: user.email,
    role: user.role,
    username: user.username,
  };
  const accessToken = signAccessToken(payload);
  // Default 30 days, remember me = 150 days (5 months)
  const refreshExpiresIn = rememberMe ? '150d' : '30d';
  const refreshToken = signRefreshToken(payload, refreshExpiresIn);

  return {
    accessToken,
    refreshToken,
    rememberMe,
    user: {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      systemRole: user.systemRole,
      department: user.department,
      position: user.position,
      avatar: user.avatar,
    },
  };
}

// Refresh: verify refresh token from cookie, issue new access token
export async function refreshAccessToken(refreshToken: string) {
  try {
    const payload = verifyRefreshToken(refreshToken);
    const accessToken = signAccessToken({
      id: payload.id,
      email: payload.email,
      role: payload.role,
      username: payload.username,
    });
    return { accessToken };
  } catch {
    throw Object.assign(new Error('Invalid refresh token'), { status: 401 });
  }
}

// Me: fetch full user profile by id
export async function getMe(userId: bigint) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      role: true,
      systemRole: true,
      department: true,
      position: true,
      avatar: true,
      companyJoinDate: true,
      birthday: true,
      hideBirthday: true,
      manager: { select: { id: true, fullName: true } },
    },
  });

  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  // Serialize BigInt to string for JSON
  return {
    ...user,
    id: user.id.toString(),
    manager: user.manager
      ? { id: user.manager.id.toString(), fullName: user.manager.fullName }
      : null,
  };
}

// Update own profile (avatar, fullName, position)
export async function updateProfile(userId: bigint, data: UpdateProfileDto) {
  const user = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      firstName: true,
      lastName: true,
      role: true,
      systemRole: true,
      department: true,
      position: true,
      avatar: true,
      companyJoinDate: true,
      birthday: true,
      hideBirthday: true,
      manager: { select: { id: true, fullName: true } },
    },
  });

  return {
    ...user,
    id: user.id.toString(),
    manager: user.manager
      ? { id: user.manager.id.toString(), fullName: user.manager.fullName }
      : null,
  };
}

// Change password
export async function changePassword(userId: bigint, data: ChangePasswordDto) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw Object.assign(new Error('User not found'), { status: 404 });

  const valid = await comparePassword(data.currentPassword, user.password);
  if (!valid) {
    throw Object.assign(new Error('Current password is incorrect'), { status: 400 });
  }

  const hashed = await hashPassword(data.newPassword);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });

  return { message: 'Password changed successfully' };
}

// Upload avatar - save filename to user record
export async function uploadAvatar(userId: bigint, filename: string) {
  const avatarUrl = `/uploads/avatars/${filename}`;

  const user = await prisma.user.update({
    where: { id: userId },
    data: { avatar: avatarUrl },
    select: {
      id: true,
      username: true,
      email: true,
      fullName: true,
      role: true,
      systemRole: true,
      department: true,
      position: true,
      avatar: true,
      companyJoinDate: true,
      birthday: true,
      hideBirthday: true,
      manager: { select: { id: true, fullName: true } },
    },
  });

  return {
    ...user,
    id: user.id.toString(),
    manager: user.manager
      ? { id: user.manager.id.toString(), fullName: user.manager.fullName }
      : null,
  };
}
