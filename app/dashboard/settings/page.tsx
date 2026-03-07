'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calendar,
  Check,
  Download,
  Edit2,
  Plus,
  RotateCcw,
  Save,
  Settings,
  Trash2,
  X,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiClient } from '@/lib/api-client';
import { getRoleLabel } from '@/lib/hr-utils';

interface AnnualLeaveRule {
  fromYear: number;
  toYear: number;
  days: number;
}

interface LeavePolicy {
  annualLeaveRules: AnnualLeaveRule[];
  carryOverLimit: number;
  advanceRequestDays: number;
  maxConsecutiveDays: number;
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

type AlertState = {
  type: 'success' | 'error';
  message: string;
};

const TAB_ITEMS = [
  { id: 'leave', label: 'Chính sách nghỉ phép', icon: Calendar },
  { id: 'approval', label: 'Luồng duyệt', icon: RotateCcw },
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
  advanceRequestDays: 1,
  maxConsecutiveDays: 30,
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
    advanceRequestDays: toSafeNumber(
      raw?.advanceRequestDays,
      DEFAULT_LEAVE_POLICY.advanceRequestDays,
    ),
    maxConsecutiveDays: toSafeNumber(
      raw?.maxConsecutiveDays,
      DEFAULT_LEAVE_POLICY.maxConsecutiveDays,
    ),
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
  const [alert, setAlert] = useState<AlertState | null>(null);
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
  const [carryOverExpiryDate, setCarryOverExpiryDate] = useState('2026-03-31');
  const [documentTypesInput, setDocumentTypesInput] = useState(
    DEFAULT_APPROVAL_FLOW.requireDocumentTypes.join(', '),
  );

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const [leaveResponse, flowResponse] = await Promise.all([
        apiClient.get<LeavePolicy>('/api/settings/leave-policy'),
        apiClient.get<ApprovalFlow>('/api/settings/approval-flow'),
      ]);
      const nextLeavePolicy = normalizeLeavePolicy(leaveResponse.data);
      const nextApprovalFlow = normalizeApprovalFlow(flowResponse.data);

      setLeavePolicy(nextLeavePolicy);
      setApprovalFlow(nextApprovalFlow);
      setDocumentTypesInput(nextApprovalFlow.requireDocumentTypes.join(', '));
      setEditingLeaveIndex(null);
      setEditingLevelIndex(null);
      setAlert(null);
    } catch (error) {
      setAlert({
        type: 'error',
        message: error instanceof Error ? error.message : 'Không thể tải cấu hình hệ thống.',
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

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
      setAlert({
        type: 'success',
        message: 'Cấu hình đã được lưu thành công.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu cấu hình.';
      setAlert({
        type: 'error',
        message: /insufficient permissions/i.test(message)
          ? 'Bạn không có quyền cập nhật cấu hình. Chỉ ADMIN mới có thể lưu thay đổi.'
          : message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    void loadSettings();
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

      {alert && (
        <div
          className="p-3 rounded-lg text-sm font-medium flex items-center gap-2"
          style={{
            background: alert.type === 'success' ? '#D3F2E7' : '#fee2e2',
            color: alert.type === 'success' ? '#0E474E' : '#991b1b',
          }}
        >
          {alert.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
          {alert.message}
        </div>
      )}

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
                          Hạn sử dụng
                        </label>
                        <div className="flex items-center gap-2">
                          <DatePicker
                            value={carryOverExpiryDate}
                            onChange={setCarryOverExpiryDate}
                            className="flex-1"
                          />
                        </div>
                        <p className="text-xs mt-1" style={{ color: '#6b7f78' }}>
                          Trường này hiện chưa có key tương ứng trong backend nên chỉ giữ ở UI.
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
                      </div>
                    </div>
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
            </>
          )}
        </div>
      </div>
    </div>
  );
}
