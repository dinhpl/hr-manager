import { Router, IRouter } from 'express';
import {
  loginController,
  refreshController,
  logoutController,
  meController,
  updateProfileController,
  changePasswordController,
  uploadAvatarController,
} from './auth.controller';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { uploadAvatar } from '../../utils/upload';

export const authRouter: IRouter = Router();

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Đăng nhập
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username: { type: string, example: admin@company.com }
 *               password: { type: string, example: password123 }
 *     responses:
 *       200:
 *         description: Đăng nhập thành công, trả accessToken + user info
 *       401:
 *         description: Sai credentials
 */
authRouter.post('/login', loginController);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Làm mới access token từ refresh token cookie
 *     tags: [Auth]
 */
authRouter.post('/refresh-token', refreshController);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất, xóa refresh token cookie
 *     tags: [Auth]
 */
authRouter.post('/logout', logoutController);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin user hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
authRouter.get('/me', authMiddleware, meController);

/**
 * @swagger
 * /api/auth/profile:
 *   patch:
 *     summary: Cập nhật thông tin cá nhân
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
authRouter.patch('/profile', authMiddleware, updateProfileController);

/**
 * @swagger
 * /api/auth/change-password:
 *   patch:
 *     summary: Đổi mật khẩu
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
authRouter.patch('/change-password', authMiddleware, changePasswordController);

/**
 * @swagger
 * /api/auth/avatar:
 *   post:
 *     summary: Upload avatar
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 */
authRouter.post('/avatar', authMiddleware, uploadAvatar.single('avatar'), uploadAvatarController);
