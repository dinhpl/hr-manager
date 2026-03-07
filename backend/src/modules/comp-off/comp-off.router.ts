import { Router, IRouter } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import * as ctrl from "./comp-off.controller";

export const compOffRouter: IRouter = Router();

compOffRouter.use(authMiddleware);

compOffRouter.get("/", ctrl.getAll);
compOffRouter.get("/summary", ctrl.getSummary);
compOffRouter.get("/:id", ctrl.getOne);
compOffRouter.post("/", ctrl.create);
compOffRouter.patch("/:id/approve", requireRoles("MANAGER", "HR", "ADMIN"), ctrl.approve);
compOffRouter.patch("/:id/reject", requireRoles("MANAGER", "HR", "ADMIN"), ctrl.reject);
