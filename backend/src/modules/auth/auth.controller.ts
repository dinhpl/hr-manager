import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { loginSchema, updateProfileSchema, changePasswordSchema } from './auth.validation';
import { sendSuccess } from '../../utils/response';

const REFRESH_COOKIE_BASE = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
};

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const FIVE_MONTHS_MS = 150 * 24 * 60 * 60 * 1000;

export async function loginController(req: Request, res: Response, next: NextFunction) {
  try {
    const { username, password, rememberMe } = loginSchema.parse(req.body);
    const result = await authService.login(username, password, rememberMe);

    const cookieMaxAge = rememberMe ? FIVE_MONTHS_MS : THIRTY_DAYS_MS;
    res.cookie('refreshToken', result.refreshToken, {
      ...REFRESH_COOKIE_BASE,
      maxAge: cookieMaxAge,
    });

    sendSuccess(res, { accessToken: result.accessToken, user: result.user });
  } catch (err) {
    next(err);
  }
}

export async function refreshController(req: Request, res: Response, next: NextFunction) {
  try {
    const refreshToken = req.cookies?.refreshToken as string | undefined;
    if (!refreshToken) {
      return res
        .status(401)
        .json({ success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token' } });
    }
    const result = await authService.refreshAccessToken(refreshToken);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function logoutController(_req: Request, res: Response) {
  res.clearCookie('refreshToken');
  sendSuccess(res, { message: 'Logged out successfully' });
}

export async function meController(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await authService.getMe(req.user!.id);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function updateProfileController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = updateProfileSchema.parse(req.body);
    const user = await authService.updateProfile(req.user!.id, data);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}

export async function changePasswordController(req: Request, res: Response, next: NextFunction) {
  try {
    const data = changePasswordSchema.parse(req.body);
    const result = await authService.changePassword(req.user!.id, data);
    sendSuccess(res, result);
  } catch (err) {
    next(err);
  }
}

export async function uploadAvatarController(req: Request, res: Response, next: NextFunction) {
  try {
    // req.file is set by multer middleware
    if (!req.file) {
      return res.status(400).json({ success: false, error: { message: 'No file uploaded' } });
    }
    const user = await authService.uploadAvatar(req.user!.id, req.file.filename);
    sendSuccess(res, user);
  } catch (err) {
    next(err);
  }
}
