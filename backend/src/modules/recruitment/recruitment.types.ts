export type RecruitmentStatus =
  | 'NOT_STARTED'
  | 'IN_PROGRESS'
  | 'INTERVIEWING'
  | 'OFFER_SENT'
  | 'HIRED'
  | 'ON_HOLD'
  | 'CANCELLED';

export type CandidateStage =
  | 'APPLIED'
  | 'HR_SCREEN'
  | 'LEADER_INTERVIEW'
  | 'CEO_INTERVIEW'
  | 'OFFER'
  | 'HIRED'
  | 'REJECTED';

export type Priority = 'A' | 'B' | 'C';

export const VALID_STATUSES: RecruitmentStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'INTERVIEWING',
  'OFFER_SENT',
  'HIRED',
  'ON_HOLD',
  'CANCELLED',
];

export const VALID_STAGES: CandidateStage[] = [
  'APPLIED',
  'HR_SCREEN',
  'LEADER_INTERVIEW',
  'CEO_INTERVIEW',
  'OFFER',
  'HIRED',
  'REJECTED',
];

export const VALID_PRIORITIES: Priority[] = ['A', 'B', 'C'];

export const VALID_SOURCES = [
  'LINKEDIN',
  'REFERRAL',
  'HEADHUNT',
  'WEBSITE',
  'AGENCY',
  'OTHER',
] as const;

// ─── DTOs ────────────────────────────────────────────────────

export interface CreatePositionDto {
  title: string;
  level?: string;
  domain?: string;
  priority?: Priority;
  headcount?: number;
  note?: string;
  blocker?: string;
  openedAt?: string;
}

export interface UpdatePositionDto {
  title?: string;
  level?: string;
  domain?: string;
  priority?: Priority;
  headcount?: number;
  status?: RecruitmentStatus;
  note?: string;
  blocker?: string;
  closedAt?: string | null;
}

export interface GetPositionsQuery {
  year?: number;
  month?: number;
  domain?: string;
  priority?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CreateCandidateDto {
  fullName: string;
  email?: string;
  phone?: string;
  source?: string;
  currentStage?: CandidateStage;
  note?: string;
}

export interface UpdateCandidateDto {
  fullName?: string;
  email?: string;
  phone?: string;
  source?: string;
  currentStage?: CandidateStage;
  note?: string;
  cvUrl?: string;
}

export interface UpdateStageDto {
  stage: CandidateStage;
  note?: string;
}

export interface UpsertWeeklyKpiDto {
  week: number;
  stage: CandidateStage;
  kpiTarget?: number;
  actual?: number;
}
