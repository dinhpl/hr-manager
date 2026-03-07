import { Router, IRouter } from "express";
import {
  loginController,
  refreshController,
  logoutController,
  meController,
} from "./auth.controller";
import { authMiddleware } from "../../middlewares/auth.middleware";

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
authRouter.post("/login", loginController);

/**
 * @swagger
 * /api/auth/refresh-token:
 *   post:
 *     summary: Làm mới access token từ refresh token cookie
 *     tags: [Auth]
 */
authRouter.post("/refresh-token", refreshController);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Đăng xuất, xóa refresh token cookie
 *     tags: [Auth]
 */
authRouter.post("/logout", logoutController);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Lấy thông tin user hiện tại
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 */
authRouter.get("/me", authMiddleware, meController);
