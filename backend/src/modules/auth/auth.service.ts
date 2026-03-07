import prisma from '../../config/prisma';
import { comparePassword } from '../../utils/hash';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';

// Login: find user by username or email, verify password, return tokens + user info
export async function login(username: string, password: string) {
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
  const refreshToken = signRefreshToken(payload);

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id.toString(),
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
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
      department: true,
      position: true,
      avatar: true,
      companyJoinDate: true,
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
