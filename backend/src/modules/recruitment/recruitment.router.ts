import { Router, IRouter } from 'express';
import { authMiddleware } from '../../middlewares/auth.middleware';
import { requireRoles } from '../../middlewares/role.middleware';
import { uploadCv } from '../../utils/upload';
import * as ctrl from './recruitment.controller';

export const recruitmentRouter: IRouter = Router();

// All endpoints require authentication
recruitmentRouter.use(authMiddleware);

// ─── Dashboard stats (read: all authenticated) ───────────────
recruitmentRouter.get('/stats', ctrl.getStats);

// ─── Positions ───────────────────────────────────────────────

// Read: all authenticated roles
recruitmentRouter.get('/positions',      ctrl.getPositions);
recruitmentRouter.get('/positions/:id',  ctrl.getPositionById);

// Write: HR and ADMIN only
recruitmentRouter.post(  '/positions',     requireRoles('HR', 'ADMIN'), ctrl.postPosition);
recruitmentRouter.patch( '/positions/:id', requireRoles('HR', 'ADMIN'), ctrl.patchPosition);
recruitmentRouter.delete('/positions/:id', requireRoles('HR', 'ADMIN'), ctrl.removePosition);

// ─── Weekly KPI (per position) ───────────────────────────────
recruitmentRouter.get('/positions/:id/weekly', ctrl.getWeeklyKpi);
recruitmentRouter.put('/positions/:id/weekly', requireRoles('HR', 'ADMIN'), ctrl.putWeeklyKpi);

// ─── Candidates (nested under position) ─────────────────────
recruitmentRouter.get(  '/positions/:id/candidates',    ctrl.getCandidates);
recruitmentRouter.post( '/positions/:id/candidates',    requireRoles('HR', 'ADMIN'), ctrl.postCandidate);

// ─── Candidates (flat access by candidateId) ────────────────
recruitmentRouter.get(   '/candidates/:candidateId',         ctrl.getCandidateById);
recruitmentRouter.patch( '/candidates/:candidateId',         requireRoles('HR', 'ADMIN'), ctrl.patchCandidate);
recruitmentRouter.delete('/candidates/:candidateId',         requireRoles('HR', 'ADMIN'), ctrl.removeCandidate);
recruitmentRouter.patch( '/candidates/:candidateId/stage',   requireRoles('HR', 'ADMIN'), ctrl.patchCandidateStage);
recruitmentRouter.post(  '/candidates/:candidateId/cv',      requireRoles('HR', 'ADMIN'), uploadCv.single('cv'), ctrl.postCandidateCv);
