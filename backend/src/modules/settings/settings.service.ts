import prisma from '../../config/prisma';

const SETTINGS_KEYS = {
  LEAVE_POLICY: 'leave_policy',
  APPROVAL_FLOW: 'approval_flow',
  ATTENDANCE: 'attendance',
} as const;

const DEFAULTS: Record<string, unknown> = {
  leave_policy: {
    annualLeaveRules: [
      { fromYear: 0, toYear: 1, days: 12 },
      { fromYear: 1, toYear: 5, days: 15 },
      { fromYear: 5, toYear: 999, days: 18 },
    ],
    carryOverLimit: 5,
    resetCarryOverDate: '03-31',
    advanceRequestDays: 1,
    maxConsecutiveDays: 30,
    showBirthdaysOnDashboard: true,
  },
  approval_flow: {
    levels: [
      { level: 1, approverRole: 'MANAGER', timeLimit: 48 },
      { level: 2, approverRole: 'HR', timeLimit: 24 },
    ],
    autoApproveWFH: false,
    requireDocumentTypes: ['SL', 'ML'],
  },
  attendance: {
    fulfillmentCase: 'case_1',
    hoursDisplayCase: 'case_1',
    showRanking: true,
  },
};

export async function getSetting(key: string) {
  const setting = await prisma.setting.findUnique({ where: { key } });
  return setting?.value ?? DEFAULTS[key] ?? null;
}

export async function updateSetting(key: string, value: unknown) {
  return prisma.setting.upsert({
    where: { key },
    create: { key, value: value as never },
    update: { value: value as never },
  });
}

export async function getLeavePolicy() {
  return getSetting(SETTINGS_KEYS.LEAVE_POLICY);
}

export async function updateLeavePolicy(value: unknown) {
  return updateSetting(SETTINGS_KEYS.LEAVE_POLICY, value);
}

export async function getApprovalFlow() {
  return getSetting(SETTINGS_KEYS.APPROVAL_FLOW);
}

export async function updateApprovalFlow(value: unknown) {
  return updateSetting(SETTINGS_KEYS.APPROVAL_FLOW, value);
}

export async function getAttendance() {
  return getSetting(SETTINGS_KEYS.ATTENDANCE);
}

export async function updateAttendance(value: unknown) {
  return updateSetting(SETTINGS_KEYS.ATTENDANCE, value);
}
