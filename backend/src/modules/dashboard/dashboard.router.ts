import { Router, IRouter } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import * as ctrl from "./dashboard.controller";

export const dashboardRouter: IRouter = Router();

dashboardRouter.use(authMiddleware);

dashboardRouter.get("/summary", ctrl.getSummary);
dashboardRouter.get("/calendar", ctrl.getCalendar);
dashboardRouter.get("/recent-requests", ctrl.getRecentRequests);
