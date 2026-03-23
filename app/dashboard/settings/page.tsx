'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Download,
  Edit2,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import SettingsHolidaysTab from '@/components/settings-holidays-tab';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { getRoleLabel } from '@/lib/hr-utils';
import { toast } from 'sonner';

interface AnnualLeaveRule {
  fromYear: number;
  toYear: number;
  days: number;
}

interface LeavePolicy {
  annualLeaveRules: AnnualLeaveRule[];
  carryOverLimit: number;
  resetCarryOverDate: string;
  advanceRequestDays: number;
  maxConsecutiveDays: number;
  showBirthdaysOnDashboard: boolean;
}

interface ApprovalLevel {
  level: number;
  approverRole: 'EMPLOYEE' | 'MANAGER' | 'HR' | 'ADMIN';
  timeLimit: number;
}

interface ApprovalFlow {
  levels: ApprovalLevel[];
  autoApproveWFH: boolean;
  requireDocumentTypes: string[];
}

interface LeaveTypeData {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  defaultDays: number;
  isPaid: boolean;
  color: string;
  isActive: boolean;
  maxConsecutiveDays?: number | null;
  usesAnnualBalance: boolean;
}

const TAB_ITEMS = [
  { id: 'leave', label: 'Thiết lập chung', icon: Calendar },
  // { id: 'approval', label: 'Luồng duyệt', icon: RotateCcw },
  { id: 'leave-types', label: 'Loại nghỉ phép', icon: Tag },
  { id: 'holidays', label: 'Ngày nghỉ lễ', icon: Calendar },
] as const;

const APPROVER_ROLE_OPTIONS: ApprovalLevel['approverRole'][] = [
  'MANAGER',
  'HR',
  'ADMIN',
  'EMPLOYEE',
];

const DEFAULT_LEAVE_POLICY: LeavePolicy = {
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
};

const DEFAULT_APPROVAL_FLOW: ApprovalFlow = {
  levels: [
    { level: 1, approverRole: 'MANAGER', timeLimit: 48 },
    { level: 2, approverRole: 'HR', timeLimit: 24 },
  ],
  autoApproveWFH: false,
  requireDocumentTypes: ['SL', 'ML'],
};

function toSafeNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function normalizeLeavePolicy(raw: Partial<LeavePolicy> | null | undefined): LeavePolicy {
  const rulesSource =
    Array.isArray(raw?.annualLeaveRules) && raw.annualLeaveRules.length
      ? raw.annualLeaveRules
      : DEFAULT_LEAVE_POLICY.annualLeaveRules;

  return {
    annualLeaveRules: rulesSource.map((rule, index) => ({
      fromYear: toSafeNumber(
        rule?.fromYear,
        DEFAULT_LEAVE_POLICY.annualLeaveRules[index]?.fromYear ?? 0,
      ),
      toYear: toSafeNumber(rule?.toYear, DEFAULT_LEAVE_POLICY.annualLeaveRules[index]?.toYear ?? 0),
      days: toSafeNumber(rule?.days, DEFAULT_LEAVE_POLICY.annualLeaveRules[index]?.days ?? 0),
    })),
    carryOverLimit: toSafeNumber(raw?.carryOverLimit, DEFAULT_LEAVE_POLICY.carryOverLimit),
    resetCarryOverDate:
      typeof raw?.resetCarryOverDate === 'string' && raw.resetCarryOverDate
        ? raw.resetCarryOverDate
        : DEFAULT_LEAVE_POLICY.resetCarryOverDate,
    advanceRequestDays: toSafeNumber(
      raw?.advanceRequestDays,
      DEFAULT_LEAVE_POLICY.advanceRequestDays,
    ),
    maxConsecutiveDays: toSafeNumber(
      raw?.maxConsecutiveDays,
      DEFAULT_LEAVE_POLICY.maxConsecutiveDays,
    ),
    showBirthdaysOnDashboard:
      typeof raw?.showBirthdaysOnDashboard === 'boolean'
        ? raw.showBirthdaysOnDashboard
        : DEFAULT_LEAVE_POLICY.showBirthdaysOnDashboard,
  };
}

function normalizeApprovalFlow(raw: Partial<ApprovalFlow> | null | undefined): ApprovalFlow {
  const levelsSource =
    Array.isArray(raw?.levels) && raw.levels.length ? raw.levels : DEFAULT_APPROVAL_FLOW.levels;

  return {
    levels: levelsSource.map((level, index) => ({
      level: index + 1,
      approverRole: APPROVER_ROLE_OPTIONS.includes(
        level?.approverRole as ApprovalLevel['approverRole'],
      )
        ? (level?.approverRole as ApprovalLevel['approverRole'])
        : (DEFAULT_APPROVAL_FLOW.levels[index]?.approverRole ?? 'MANAGER'),
      timeLimit: toSafeNumber(
        level?.timeLimit,
        DEFAULT_APPROVAL_FLOW.levels[index]?.timeLimit ?? 24,
      ),
    })),
    autoApproveWFH: Boolean(raw?.autoApproveWFH),
    requireDocumentTypes:
      Array.isArray(raw?.requireDocumentTypes) && raw.requireDocumentTypes.length
        ? raw.requireDocumentTypes.map((item) => String(item).trim()).filter(Boolean)
        : DEFAULT_APPROVAL_FLOW.requireDocumentTypes,
  };
}

function renumberLevels(levels: ApprovalLevel[]) {
  return levels.map((level, index) => ({
    ...level,
    level: index + 1,
  }));
}

function parseDocumentTypes(input: string) {
  return Array.from(
    new Set(
      input
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
    ),
  );
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<(typeof TAB_ITEMS)[number]['id']>('leave');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [leavePolicy, setLeavePolicy] = useState<LeavePolicy>(DEFAULT_LEAVE_POLICY);
  const [approvalFlow, setApprovalFlow] = useState<ApprovalFlow>(DEFAULT_APPROVAL_FLOW);
  const [editingLeaveIndex, setEditingLeaveIndex] = useState<number | null>(null);
  const [editingLevelIndex, setEditingLevelIndex] = useState<number | null>(null);
  const [leaveDraft, setLeaveDraft] = useState<AnnualLeaveRule>({
    fromYear: 0,
    toYear: 0,
    days: 0,
  });
  const [levelDraft, setLevelDraft] = useState<ApprovalLevel>({
    level: 1,
    approverRole: 'MANAGER',
    timeLimit: 24,
  });
  const [documentTypesInput, setDocumentTypesInput] = useState(
    DEFAULT_APPROVAL_FLOW.requireDocumentTypes.join(', '),
  );

  // Leave Types state
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeData[]>([]);
  const [editingLeaveType, setEditingLeaveType] = useState<LeaveTypeData | null>(null);
  const [isLeaveTypeModalOpen, setIsLeaveTypeModalOpen] = useState(false);
  const [leaveTypeForm, setLeaveTypeForm] = useState<Partial<LeaveTypeData>>({});

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [leaveResponse, flowResponse, leaveTypesResponse] = await Promise.all([
        apiClient.get<LeavePolicy>('/api/settings/leave-policy'),
        apiClient.get<ApprovalFlow>('/api/settings/approval-flow'),
        apiClient.get<LeaveTypeData[]>('/api/leave-types?activeOnly=false'),
      ]);
      const nextLeavePolicy = normalizeLeavePolicy(leaveResponse.data);
      const nextApprovalFlow = normalizeApprovalFlow(flowResponse.data);

      setLeavePolicy(nextLeavePolicy);
      setApprovalFlow(nextApprovalFlow);
      setDocumentTypesInput(nextApprovalFlow.requireDocumentTypes.join(', '));
      setLeaveTypes(leaveTypesResponse.data);
      setEditingLeaveIndex(null);
      setEditingLevelIndex(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải cấu hình hệ thống.';
      scrollToTop();
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, [scrollToTop]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const workflowSteps = useMemo(
    () =>
      approvalFlow.levels.map((level) => ({ ...level, label: getRoleLabel(level.approverRole) })),
    [approvalFlow.levels],
  );

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const nextApprovalFlow = {
        ...approvalFlow,
        levels: renumberLevels(approvalFlow.levels),
        requireDocumentTypes: parseDocumentTypes(documentTypesInput),
      };

      await Promise.all([
        apiClient.patch('/api/settings/leave-policy', leavePolicy),
        apiClient.patch('/api/settings/approval-flow', nextApprovalFlow),
      ]);

      setApprovalFlow(nextApprovalFlow);
      toast.success('Cấu hình đã được lưu thành công.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu cấu hình.';
      scrollToTop();
      toast.error(
        /insufficient permissions/i.test(message)
          ? 'Bạn không có quyền cập nhật cấu hình. Chỉ ADMIN mới có thể lưu thay đổi.'
          : message,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    void loadSettings();
    toast.success('Đã tải lại cấu hình từ hệ thống.');
  };

  const handleExportConfig = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      leavePolicy,
      approvalFlow: {
        ...approvalFlow,
        requireDocumentTypes: parseDocumentTypes(documentTypesInput),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `hr-settings-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success('Đã export cấu hình.');
  };

  const handleAddLeaveRule = () => {
    const nextRule = { fromYear: 0, toYear: 0, days: 0 };
    setLeavePolicy((prev) => ({
      ...prev,
      annualLeaveRules: [...prev.annualLeaveRules, nextRule],
    }));
    setEditingLeaveIndex(leavePolicy.annualLeaveRules.length);
    setLeaveDraft(nextRule);
  };

  const handleEditLeaveRule = (index: number) => {
    setEditingLeaveIndex(index);
    setLeaveDraft(leavePolicy.annualLeaveRules[index]);
  };

  const handleSaveLeaveRule = (index: number) => {
    setLeavePolicy((prev) => ({
      ...prev,
      annualLeaveRules: prev.annualLeaveRules.map((rule, ruleIndex) =>
        ruleIndex === index ? leaveDraft : rule,
      ),
    }));
    setEditingLeaveIndex(null);
  };

  const handleCancelLeaveRule = (index: number) => {
    const target = leavePolicy.annualLeaveRules[index];
    const isNewRule = target?.fromYear === 0 && target?.toYear === 0 && target?.days === 0;
    if (isNewRule) {
      setLeavePolicy((prev) => ({
        ...prev,
        annualLeaveRules: prev.annualLeaveRules.filter((_, ruleIndex) => ruleIndex !== index),
      }));
    }
    setEditingLeaveIndex(null);
  };

  const handleDeleteLeaveRule = (index: number) => {
    setLeavePolicy((prev) => ({
      ...prev,
      annualLeaveRules: prev.annualLeaveRules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
    if (editingLeaveIndex === index) setEditingLeaveIndex(null);
  };

  const handleAddApprovalLevel = () => {
    const nextLevel: ApprovalLevel = {
      level: approvalFlow.levels.length + 1,
      approverRole: 'MANAGER',
      timeLimit: 24,
    };
    setApprovalFlow((prev) => ({
      ...prev,
      levels: [...prev.levels, nextLevel],
    }));
    setEditingLevelIndex(approvalFlow.levels.length);
    setLevelDraft(nextLevel);
  };

  const handleEditApprovalLevel = (index: number) => {
    setEditingLevelIndex(index);
    setLevelDraft(approvalFlow.levels[index]);
  };

  const handleSaveApprovalLevel = (index: number) => {
    setApprovalFlow((prev) => ({
      ...prev,
      levels: renumberLevels(
        prev.levels.map((level, levelIndex) => (levelIndex === index ? levelDraft : level)),
      ),
    }));
    setEditingLevelIndex(null);
  };

  const handleCancelApprovalLevel = (index: number) => {
    const target = approvalFlow.levels[index];
    const isNewLevel =
      target?.timeLimit === 24 &&
      target?.approverRole === 'MANAGER' &&
      target?.level === approvalFlow.levels.length;
    if (isNewLevel) {
      setApprovalFlow((prev) => ({
        ...prev,
        levels: renumberLevels(prev.levels.filter((_, levelIndex) => levelIndex !== index)),
      }));
    }
    setEditingLevelIndex(null);
  };

  const handleDeleteApprovalLevel = (index: number) => {
    setApprovalFlow((prev) => ({
      ...prev,
      levels: renumberLevels(prev.levels.filter((_, levelIndex) => levelIndex !== index)),
    }));
    if (editingLevelIndex === index) setEditingLevelIndex(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#D3F2E7' }}
          >
            <Settings size={18} style={{ color: '#0E474E' }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Cấu hình hệ thống
          </h1>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void handleSave()}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            style={{ background: '#1DB87A' }}
          >
            <Save size={14} /> {isSaving ? 'Đang lưu...' : 'Lưu tất cả'}
          </button>
          <button
            onClick={handleReset}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-70"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <RotateCcw size={14} /> Reset
          </button>
          <button
            onClick={handleExportConfig}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: '#e2ede9', color: '#203430' }}
          >
            <Download size={14} /> Export cấu hình
          </button>
        </div>
      </div>

      <div
        className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: '#e2ede9' }}
      >
        <div className="flex border-b overflow-x-auto" style={{ borderColor: '#e2ede9' }}>
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                style={{
                  borderColor: activeTab === tab.id ? '#1DB87A' : 'transparent',
                  color: activeTab === tab.id ? '#1DB87A' : '#6b7f78',
                }}
              >
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {isLoading ? (
            <div
              className="rounded-xl border border-dashed p-8 text-center text-sm"
              style={{ borderColor: '#d6e5df', color: '#6b7f78' }}
            >
              Đang tải cấu hình từ backend...
            </div>
          ) : (
            <>
              {activeTab === 'leave' && (
                <div className="space-y-6">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold text-sm mb-4" style={{ color: '#203430' }}>
                      Cấu hình phép năm (Annual Leave)
                    </h3>
                    <div className="grid md:grid-cols-3 gap-4 mb-6">
                      <div>
                        <label
                          className="block text-xs font-semibold mb-2"
                          style={{ color: '#6b7f78' }}
                        >
                          Phép năm mặc định
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="30"
                            value={leavePolicy.annualLeaveRules[0]?.days ?? 0}
                            onChange={(event) =>
                              setLeavePolicy((prev) => ({
                                ...prev,
                                annualLeaveRules: prev.annualLeaveRules.map((rule, index) =>
                                  index === 0
                                    ? { ...rule, days: Number(event.target.value) }
                                    : rule,
                                ),
                              }))
                            }
                            className="flex-1 px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#e2ede9', color: '#203430' }}
                          />
                          <span className="text-sm" style={{ color: '#6b7f78' }}>
                            ngày
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>
                          Số ngày phép cho nhân viên mới
                        </p>
                      </div>
                      <div>
                        <label
                          className="block text-xs font-semibold mb-2"
                          style={{ color: '#6b7f78' }}
                        >
                          Phép tăng theo thâm niên
                        </label>
                        <Select
                          value={leavePolicy.annualLeaveRules.length > 1 ? 'milestone' : 'none'}
                          disabled
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Quy tắc tăng phép" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Không tăng</SelectItem>
                            <SelectItem value="milestone">Theo các mốc bên dưới</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>
                          Backend lưu chi tiết theo bảng quy tắc bên dưới.
                        </p>
                      </div>
                      <div>
                        <label
                          className="block text-xs font-semibold mb-2"
                          style={{ color: '#6b7f78' }}
                        >
                          Nghỉ liên tục tối đa
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={leavePolicy.maxConsecutiveDays}
                            onChange={(event) =>
                              setLeavePolicy((prev) => ({
                                ...prev,
                                maxConsecutiveDays: Number(event.target.value),
                              }))
                            }
                            className="flex-1 px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#e2ede9', color: '#203430' }}
                          />
                          <span className="text-sm" style={{ color: '#6b7f78' }}>
                            ngày
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#f7f7f7' }}>
                            {['Từ năm', 'Đến năm', 'Số ngày phép', 'Thao tác'].map((heading) => (
                              <th
                                key={heading}
                                className="px-3 py-2.5 text-left text-xs font-semibold"
                                style={{ color: '#6b7f78' }}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {leavePolicy.annualLeaveRules.map((rule, index) => (
                            <tr
                              key={`${rule.fromYear}-${rule.toYear}-${index}`}
                              className="border-b last:border-0"
                              style={{ borderColor: '#f0f4f2' }}
                            >
                              <td className="px-3 py-3">
                                {editingLeaveIndex === index ? (
                                  <input
                                    type="number"
                                    value={leaveDraft.fromYear}
                                    onChange={(event) =>
                                      setLeaveDraft((prev) => ({
                                        ...prev,
                                        fromYear: Number(event.target.value),
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm"
                                    style={{ borderColor: '#e2ede9' }}
                                  />
                                ) : (
                                  <span style={{ color: '#203430' }}>{rule.fromYear}</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {editingLeaveIndex === index ? (
                                  <input
                                    type="number"
                                    value={leaveDraft.toYear}
                                    onChange={(event) =>
                                      setLeaveDraft((prev) => ({
                                        ...prev,
                                        toYear: Number(event.target.value),
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm"
                                    style={{ borderColor: '#e2ede9' }}
                                  />
                                ) : (
                                  <span style={{ color: '#203430' }}>{rule.toYear}</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                {editingLeaveIndex === index ? (
                                  <input
                                    type="number"
                                    value={leaveDraft.days}
                                    onChange={(event) =>
                                      setLeaveDraft((prev) => ({
                                        ...prev,
                                        days: Number(event.target.value),
                                      }))
                                    }
                                    className="w-full px-2 py-1 rounded border text-sm"
                                    style={{ borderColor: '#e2ede9' }}
                                  />
                                ) : (
                                  <span style={{ color: '#203430' }}>{rule.days}</span>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex items-center gap-1">
                                  {editingLeaveIndex === index ? (
                                    <>
                                      <button
                                        onClick={() => handleSaveLeaveRule(index)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-emerald-50"
                                      >
                                        <Check size={14} style={{ color: '#1DB87A' }} />
                                      </button>
                                      <button
                                        onClick={() => handleCancelLeaveRule(index)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-gray-100"
                                      >
                                        <X size={14} style={{ color: '#6b7f78' }} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleEditLeaveRule(index)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-amber-50"
                                      >
                                        <Edit2 size={14} style={{ color: '#f59e0b' }} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteLeaveRule(index)}
                                        className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50"
                                      >
                                        <Trash2 size={14} style={{ color: '#ef4444' }} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleAddLeaveRule}
                      className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
                      style={{ borderColor: '#1DB87A', color: '#1DB87A' }}
                    >
                      <Plus size={14} /> Thêm quy tắc
                    </button>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-semibold text-sm mb-4" style={{ color: '#203430' }}>
                      Cấu hình chuyển phép (Carry Over)
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#203430' }}>
                            Cho phép chuyển phép
                          </p>
                          <p className="text-xs" style={{ color: '#6b7f78' }}>
                            Nhân viên có thể chuyển phép sang năm tiếp theo
                          </p>
                        </div>
                        <Checkbox
                          checked={leavePolicy.carryOverLimit > 0}
                          onCheckedChange={(checked) =>
                            setLeavePolicy((prev) => ({
                              ...prev,
                              carryOverLimit:
                                checked === true ? Math.max(prev.carryOverLimit, 1) : 0,
                            }))
                          }
                          aria-label="Cho phép chuyển phép"
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs font-semibold mb-2"
                          style={{ color: '#6b7f78' }}
                        >
                          Số ngày tối đa có thể chuyển
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={leavePolicy.carryOverLimit}
                            onChange={(event) =>
                              setLeavePolicy((prev) => ({
                                ...prev,
                                carryOverLimit: Number(event.target.value),
                              }))
                            }
                            className="flex-1 px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#e2ede9', color: '#203430' }}
                          />
                          <span className="text-sm" style={{ color: '#6b7f78' }}>
                            ngày
                          </span>
                        </div>
                      </div>
                      <div>
                        <label
                          className="block text-xs font-semibold mb-2"
                          style={{ color: '#6b7f78' }}
                        >
                          Ngày reset carry-over
                        </label>
                        <div className="flex items-center gap-2">
                          <DatePicker
                            value={`2000-${leavePolicy.resetCarryOverDate}`}
                            onChange={(val) =>
                              setLeavePolicy((prev) => ({
                                ...prev,
                                resetCarryOverDate: val.slice(5),
                              }))
                            }
                            className="flex-1"
                          />
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>
                          Ngày reset hàng năm (chỉ dùng tháng/ngày). Phép chuyển tiếp hết hạn sau ngày này.
                        </p>
                      </div>
                      <div>
                        <label
                          className="block text-xs font-semibold mb-2"
                          style={{ color: '#6b7f78' }}
                        >
                          Thời gian báo trước
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            value={leavePolicy.advanceRequestDays}
                            onChange={(event) =>
                              setLeavePolicy((prev) => ({
                                ...prev,
                                advanceRequestDays: Number(event.target.value),
                              }))
                            }
                            className="flex-1 px-3 py-2 rounded-lg border text-sm"
                            style={{ borderColor: '#e2ede9', color: '#203430' }}
                          />
                          <span className="text-sm" style={{ color: '#6b7f78' }}>
                            ngày
                          </span>
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>
                          Chỉ áp dụng cho đơn có ngày bắt đầu trong tương lai. Đơn bổ sung cho ngày đã qua vẫn có thể tạo.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-l-4 border-pink-500 pl-4">
                    <h3 className="font-semibold text-sm mb-4" style={{ color: '#203430' }}>
                      Thiết lập hiển thị dashboard
                    </h3>
                    <div
                      className="flex items-center justify-between gap-4 rounded-xl border px-4 py-3"
                      style={{ borderColor: '#f5d0e6', background: '#fff7fb' }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: '#203430' }}>
                          Hiển thị sinh nhật toàn nhân viên trên dashboard
                        </p>
                        <p className="text-xs" style={{ color: '#6b7f78' }}>
                          Khi tắt, dashboard sẽ ẩn danh sách sinh nhật, marker sinh nhật trên lịch và
                          không tải dữ liệu birthday.
                        </p>
                      </div>
                      <Checkbox
                        checked={leavePolicy.showBirthdaysOnDashboard}
                        onCheckedChange={(checked) =>
                          setLeavePolicy((prev) => ({
                            ...prev,
                            showBirthdaysOnDashboard: checked === true,
                          }))
                        }
                        aria-label="Hiển thị sinh nhật trên dashboard"
                      />
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'leave-types' && (
                <div className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold" style={{ color: '#203430' }}>
                      Quản lý loại nghỉ phép
                    </h3>
                    <button
                      onClick={() => {
                        setEditingLeaveType(null);
                        setLeaveTypeForm({
                          isPaid: true,
                          usesAnnualBalance: false,
                          maxConsecutiveDays: 5,
                        });
                        setIsLeaveTypeModalOpen(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
                    >
                      <Plus size={16} /> Thêm loại nghỉ
                    </button>
                  </div>

                  <div
                    className="overflow-x-auto rounded-lg border"
                    style={{ borderColor: '#e2ede9' }}
                  >
                    <table className="w-full text-sm">
                      <thead>
                        <tr style={{ background: '#f7f7f7' }}>
                          <th
                            className="px-3 py-2.5 text-left text-xs font-semibold"
                            style={{ color: '#6b7f78' }}
                          >
                            Mã
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-xs font-semibold"
                            style={{ color: '#6b7f78' }}
                          >
                            Tên
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-xs font-semibold"
                            style={{ color: '#6b7f78' }}
                          >
                            Max ngày liên tiếp
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-xs font-semibold"
                            style={{ color: '#6b7f78' }}
                          >
                            Tính phép năm
                          </th>
                          <th
                            className="px-3 py-2.5 text-left text-xs font-semibold"
                            style={{ color: '#6b7f78' }}
                          >
                            Trạng thái
                          </th>
                          <th
                            className="px-3 py-2.5 text-right text-xs font-semibold"
                            style={{ color: '#6b7f78' }}
                          >
                            Thao tác
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {leaveTypes.map((lt) => (
                          <tr key={lt.id} className="border-t" style={{ borderColor: '#e2ede9' }}>
                            <td className="px-3 py-2.5 font-medium" style={{ color: '#203430' }}>
                              {lt.code}
                            </td>
                            <td className="px-3 py-2.5" style={{ color: '#203430' }}>
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-3 h-3 rounded-full"
                                  style={{ background: lt.color }}
                                />
                                {lt.name}
                              </div>
                            </td>
                            <td className="px-3 py-2.5" style={{ color: '#6b7f78' }}>
                              {lt.maxConsecutiveDays ?? '-'}
                            </td>
                            <td className="px-3 py-2.5">
                              {lt.usesAnnualBalance ? (
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium"
                                  style={{ background: '#dcfce7', color: '#166534' }}
                                >
                                  Có
                                </span>
                              ) : (
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium"
                                  style={{ background: '#f3f4f6', color: '#6b7280' }}
                                >
                                  Không
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              {lt.isActive ? (
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium"
                                  style={{ background: '#dcfce7', color: '#166534' }}
                                >
                                  Hoạt động
                                </span>
                              ) : (
                                <span
                                  className="px-2 py-1 rounded text-xs font-medium"
                                  style={{ background: '#fef2f2', color: '#dc2626' }}
                                >
                                  Không hoạt động
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                onClick={() => {
                                  setEditingLeaveType(lt);
                                  setLeaveTypeForm(lt);
                                  setIsLeaveTypeModalOpen(true);
                                }}
                                className="p-1.5 rounded hover:bg-gray-100"
                                style={{ color: '#6b7f78' }}
                              >
                                <Edit2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {activeTab === 'approval' && (
                <div className="space-y-6">
                  <div
                    className="flex justify-center gap-3 py-6 px-4 rounded-lg overflow-x-auto"
                    style={{ background: '#f0f4f2' }}
                  >
                    {workflowSteps.map((step, index) => (
                      <div
                        key={`${step.level}-${step.approverRole}`}
                        className="flex items-center gap-3 shrink-0"
                      >
                        <div
                          className="px-3 py-2 rounded-lg text-white text-xs font-bold text-center min-w-[96px]"
                          style={{ background: index % 2 === 0 ? '#1DB87A' : '#06b6d4' }}
                        >
                          Cấp {step.level}: {step.label}
                        </div>
                        {index < workflowSteps.length - 1 && (
                          <div className="text-xl" style={{ color: '#6b7f78' }}>
                            →
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="border-l-4 border-blue-500 pl-4">
                    <h3 className="font-semibold text-sm mb-4" style={{ color: '#203430' }}>
                      Thời hạn duyệt
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      {approvalFlow.levels.map((level, index) => (
                        <div key={`${level.level}-${level.approverRole}`}>
                          <label
                            className="block text-sm font-medium mb-2"
                            style={{ color: '#203430' }}
                          >
                            Cấp {index + 1} - {getRoleLabel(level.approverRole)}
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              min="0"
                              value={level.timeLimit}
                              onChange={(event) =>
                                setApprovalFlow((prev) => ({
                                  ...prev,
                                  levels: prev.levels.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, timeLimit: Number(event.target.value) }
                                      : item,
                                  ),
                                }))
                              }
                              className="flex-1 px-3 py-2 rounded-lg border text-sm"
                              style={{ borderColor: '#e2ede9', color: '#203430' }}
                            />
                            <span className="text-sm" style={{ color: '#6b7f78' }}>
                              giờ
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-l-4 border-red-500 pl-4">
                    <h3 className="font-semibold text-sm mb-4" style={{ color: '#203430' }}>
                      Các cấp duyệt
                    </h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ background: '#f7f7f7' }}>
                            {[
                              'Cấp',
                              'Vai trò duyệt',
                              'Thời gian chờ',
                              'Trạng thái',
                              'Thao tác',
                            ].map((heading) => (
                              <th
                                key={heading}
                                className="px-3 py-2.5 text-left text-xs font-semibold"
                                style={{ color: '#6b7f78' }}
                              >
                                {heading}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {approvalFlow.levels.map((level, index) => (
                            <tr
                              key={`${level.level}-${level.approverRole}-${index}`}
                              className="border-b last:border-0"
                              style={{ borderColor: '#f0f4f2' }}
                            >
                              <td
                                className="px-3 py-3 text-xs font-medium"
                                style={{ color: '#203430' }}
                              >
                                Cấp {index + 1}
                              </td>
                              <td className="px-3 py-3 text-xs" style={{ color: '#203430' }}>
                                {editingLevelIndex === index ? (
                                  <Select
                                    value={levelDraft.approverRole}
                                    onValueChange={(value) =>
                                      setLevelDraft((prev) => ({
                                        ...prev,
                                        approverRole: value as ApprovalLevel['approverRole'],
                                      }))
                                    }
                                  >
                                    <SelectTrigger className="h-8 text-xs">
                                      <SelectValue placeholder="Chọn vai trò" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {APPROVER_ROLE_OPTIONS.map((role) => (
                                        <SelectItem key={role} value={role}>
                                          {getRoleLabel(role)}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  getRoleLabel(level.approverRole)
                                )}
                              </td>
                              <td className="px-3 py-3 text-xs" style={{ color: '#203430' }}>
                                {editingLevelIndex === index ? (
                                  <input
                                    type="number"
                                    min="0"
                                    value={levelDraft.timeLimit}
                                    onChange={(event) =>
                                      setLevelDraft((prev) => ({
                                        ...prev,
                                        timeLimit: Number(event.target.value),
                                      }))
                                    }
                                    className="w-24 px-2 py-1 rounded border text-xs"
                                    style={{ borderColor: '#e2ede9' }}
                                  />
                                ) : (
                                  `${level.timeLimit}h`
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{ background: '#D3F2E7', color: '#0E474E' }}
                                >
                                  Hoạt động
                                </span>
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex gap-1">
                                  {editingLevelIndex === index ? (
                                    <>
                                      <button
                                        onClick={() => handleSaveApprovalLevel(index)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-emerald-50"
                                      >
                                        <Check size={13} style={{ color: '#1DB87A' }} />
                                      </button>
                                      <button
                                        onClick={() => handleCancelApprovalLevel(index)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-gray-100"
                                      >
                                        <X size={13} style={{ color: '#6b7f78' }} />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => handleEditApprovalLevel(index)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-50"
                                      >
                                        <Edit2 size={13} style={{ color: '#f59e0b' }} />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteApprovalLevel(index)}
                                        className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50"
                                      >
                                        <Trash2 size={13} style={{ color: '#ef4444' }} />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <button
                      onClick={handleAddApprovalLevel}
                      className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
                      style={{ borderColor: '#1DB87A', color: '#1DB87A' }}
                    >
                      <Plus size={14} /> Thêm cấp duyệt
                    </button>
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h3 className="font-semibold text-sm mb-4" style={{ color: '#203430' }}>
                      Tùy chọn luồng duyệt
                    </h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-medium" style={{ color: '#203430' }}>
                            Tự động duyệt WFH
                          </p>
                          <p className="text-xs" style={{ color: '#6b7f78' }}>
                            Map trực tiếp tới trường `autoApproveWFH`
                          </p>
                        </div>
                        <Checkbox
                          checked={approvalFlow.autoApproveWFH}
                          onCheckedChange={(checked) =>
                            setApprovalFlow((prev) => ({
                              ...prev,
                              autoApproveWFH: checked === true,
                            }))
                          }
                          aria-label="Tự động duyệt WFH"
                        />
                      </div>
                      <div>
                        <label
                          className="block text-xs font-semibold mb-2"
                          style={{ color: '#6b7f78' }}
                        >
                          Loại phép yêu cầu giấy tờ
                        </label>
                        <Input
                          value={documentTypesInput}
                          onChange={(event) => setDocumentTypesInput(event.target.value)}
                          placeholder="Ví dụ: SL, ML"
                        />
                        <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>
                          Nhập danh sách mã, phân tách bằng dấu phẩy.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'holidays' && <SettingsHolidaysTab />}
            </>
          )}
        </div>
      </div>

      {/* Leave Type Modal */}
      <Dialog open={isLeaveTypeModalOpen} onOpenChange={setIsLeaveTypeModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingLeaveType ? 'Chỉnh sửa loại nghỉ' : 'Thêm loại nghỉ mới'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7f78' }}>
                Mã *
              </label>
              <Input
                value={leaveTypeForm.code || ''}
                onChange={(e) =>
                  setLeaveTypeForm({ ...leaveTypeForm, code: e.target.value.toUpperCase() })
                }
                placeholder="VD: AL, SL"
                disabled={!!editingLeaveType}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7f78' }}>
                Tên *
              </label>
              <Input
                value={leaveTypeForm.name || ''}
                onChange={(e) => setLeaveTypeForm({ ...leaveTypeForm, name: e.target.value })}
                placeholder="VD: Nghỉ phép năm"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {/* Hidden: defaultDays is managed by leave-balances service */}
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7f78' }}>
                  Max ngày liên tiếp
                </label>
                <Input
                  type="number"
                  value={leaveTypeForm.maxConsecutiveDays ?? ''}
                  onChange={(e) =>
                    setLeaveTypeForm({
                      ...leaveTypeForm,
                      maxConsecutiveDays: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="5"
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={leaveTypeForm.isPaid === true}
                  onCheckedChange={(checked) =>
                    setLeaveTypeForm({ ...leaveTypeForm, isPaid: checked === true })
                  }
                />
                <span className="text-sm" style={{ color: '#203430' }}>
                  Có lương
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={leaveTypeForm.usesAnnualBalance === true}
                  onCheckedChange={(checked) =>
                    setLeaveTypeForm({ ...leaveTypeForm, usesAnnualBalance: checked === true })
                  }
                />
                <span className="text-sm" style={{ color: '#203430' }}>
                  Tính vào phép năm
                </span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: '#6b7f78' }}>
                Màu sắc
              </label>
              <div className="flex gap-2">
                {[
                  '#1DB87A',
                  '#ef4444',
                  '#3b82f6',
                  '#8b5cf6',
                  '#f59e0b',
                  '#06b6d4',
                  '#6b7280',
                  '#374151',
                ].map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setLeaveTypeForm({ ...leaveTypeForm, color })}
                    className={`w-8 h-8 rounded-full border-2 ${leaveTypeForm.color === color ? 'border-gray-800' : 'border-transparent'}`}
                    style={{ background: color }}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <button
                onClick={() => setIsLeaveTypeModalOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ background: '#f7f7f7', color: '#6b7f78' }}
              >
                Hủy
              </button>
              <button
                onClick={async () => {
                  if (!leaveTypeForm.code || !leaveTypeForm.name) {
                    toast.error('Vui lòng nhập mã và tên loại nghỉ.');
                    return;
                  }
                  try {
                    if (editingLeaveType) {
                      await apiClient.patch(`/api/leave-types/${editingLeaveType.id}`, {
                        name: leaveTypeForm.name,
                        defaultDays: leaveTypeForm.defaultDays,
                        isPaid: leaveTypeForm.isPaid,
                        color: leaveTypeForm.color,
                        maxConsecutiveDays: leaveTypeForm.maxConsecutiveDays,
                        usesAnnualBalance: leaveTypeForm.usesAnnualBalance,
                      });
                      toast.success('Cập nhật thành công.');
                    } else {
                      await apiClient.post('/api/leave-types', {
                        code: leaveTypeForm.code,
                        name: leaveTypeForm.name,
                        defaultDays: leaveTypeForm.defaultDays ?? 0,
                        isPaid: leaveTypeForm.isPaid ?? true,
                        color: leaveTypeForm.color ?? '#1DB87A',
                        maxConsecutiveDays: leaveTypeForm.maxConsecutiveDays,
                        usesAnnualBalance: leaveTypeForm.usesAnnualBalance ?? false,
                      });
                      toast.success('Thêm mới thành công.');
                    }
                    setIsLeaveTypeModalOpen(false);
                    loadSettings();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Lỗi khi lưu.');
                  }
                }}
                className="px-4 py-2 rounded-lg text-sm font-semibold text-white"
                style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
              >
                Lưu
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
