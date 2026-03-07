import { Router, IRouter } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { requireRoles } from "../../middlewares/role.middleware";
import * as ctrl from "./leave-types.controller";

export const leaveTypesRouter: IRouter = Router();

leaveTypesRouter.get("/", authMiddleware, ctrl.getAll);                                          // ALL roles
leaveTypesRouter.post("/", authMiddleware, requireRoles("HR", "ADMIN"), ctrl.create);
leaveTypesRouter.patch("/:id", authMiddleware, requireRoles("HR", "ADMIN"), ctrl.update);
leaveTypesRouter.delete("/:id", authMiddleware, requireRoles("ADMIN"), ctrl.remove);
