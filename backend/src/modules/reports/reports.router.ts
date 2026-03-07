import { Router, IRouter } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import * as ctrl from "./reports.controller";

export const reportsRouter: IRouter = Router();

reportsRouter.use(authMiddleware, requireRoles("HR", "ADMIN", "MANAGER"));

reportsRouter.get("/leave", ctrl.getLeaveReport);
reportsRouter.get("/overtime", ctrl.getOvertimeReport);
reportsRouter.get("/department", ctrl.getDepartmentReport);
reportsRouter.get("/top-users", ctrl.getTopUsers);
reportsRouter.get("/export", ctrl.exportReport);
