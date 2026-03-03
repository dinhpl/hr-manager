"use client";

import { useState } from "react";
import {
  Settings, Save, RotateCcw, Download,
  Calendar, Clock, Route, Bell, Server,
  Plus, Trash2, Edit2, Check, X,
  Lock, Mail, Phone, Zap, AlertTriangle,
  HardDrive, Activity, Info, Eye, EyeOff,
} from "lucide-react";

interface AnnualLeaveRule {
  fromYear: number;
  toYear: number;
  days: number;
}

interface EscalationRule {
  condition: string;
  timeLimit: number;
  escalateTo: string;
  status: "active" | "inactive";
}

interface NotificationTemplate {
  event: string;
  email: boolean;
  sms: boolean;
  inApp: boolean;
  recipients: string;
  template: string;
  enabled: boolean;
}

const TAB_ITEMS = [
  { id: "leave", label: "Chính sách nghỉ phép", icon: Calendar },
  { id: "overtime", label: "Chính sách Overtime", icon: Clock },
  { id: "approval", label: "Luồng duyệt", icon: RotateCcw },
  { id: "notification", label: "Thông báo", icon: Bell },
  { id: "system", label: "Hệ thống", icon: Server },
];

const LEAVE_RULES: AnnualLeaveRule[] = [
  { fromYear: 0, toYear: 1, days: 12 },
  { fromYear: 1, toYear: 5, days: 15 },
  { fromYear: 5, toYear: 999, days: 18 },
];

const ESCALATION_RULES: EscalationRule[] = [
  { condition: "OT < 2 giờ (ngày thường)", timeLimit: 0, escalateTo: "Tự động", status: "active" },
  { condition: "OT 2-4 giờ (ngày thường)", timeLimit: 24, escalateTo: "Manager", status: "active" },
  { condition: "OT > 4 giờ hoặc cuối tuần", timeLimit: 48, escalateTo: "Manager + HR", status: "active" },
];

const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  { event: "Yêu cầu nghỉ phép mới", email: true, sms: false, inApp: true, recipients: "Manager, HR", template: "Sửa", enabled: true },
  { event: "Yêu cầu được duyệt", email: true, sms: true, inApp: true, recipients: "Nhân viên", template: "Sửa", enabled: true },
  { event: "Yêu cầu bị từ chối", email: true, sms: true, inApp: true, recipients: "Nhân viên", template: "Sửa", enabled: true },
  { event: "Phép sắp hết hạn", email: true, sms: false, inApp: true, recipients: "Nhân viên", template: "Sửa", enabled: true },
  { event: "Comp-off sắp hết hạn", email: true, sms: false, inApp: true, recipients: "Nhân viên", template: "Sửa", enabled: true },
  { event: "Sinh nhật nhân viên", email: true, sms: false, inApp: false, recipients: "Nhân viên, Manager", template: "Sửa", enabled: true },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("leave");
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "#D3F2E7" }}>
            <Settings size={18} style={{ color: "#0E474E" }} />
          </div>
          <h1 className="text-xl font-bold" style={{ color: "#203430" }}>Cấu hình hệ thống</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{ background: "#1DB87A" }}>
            <Save size={14} /> Lưu tất cả
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <RotateCcw size={14} /> Reset
          </button>
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
            style={{ borderColor: "#e2ede9", color: "#203430" }}>
            <Download size={14} /> Export cấu hình
          </button>
        </div>
      </div>

      {/* Save confirmation */}
      {saved && (
        <div className="p-3 rounded-lg text-sm font-medium flex items-center gap-2"
          style={{ background: "#D3F2E7", color: "#0E474E" }}>
          <Check size={16} /> Cấu hình đã được lưu thành công
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: "#e2ede9" }}>
        <div className="flex border-b overflow-x-auto" style={{ borderColor: "#e2ede9" }}>
          {TAB_ITEMS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors"
                style={{
                  borderColor: activeTab === tab.id ? "#1DB87A" : "transparent",
                  color: activeTab === tab.id ? "#1DB87A" : "#6b7f78",
                }}>
                <Icon size={16} /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-6">
          {/* TAB 1: Leave Policy */}
          {activeTab === "leave" && (
            <div className="space-y-6">
              {/* Annual Leave */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Cấu hình phép năm (Annual Leave)
                </h3>
                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Phép năm mặc định</label>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="12" min="0" max="30"
                        className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }} />
                      <span className="text-sm" style={{ color: "#6b7f78" }}>ngày</span>
                    </div>
                    <p className="text-xs mt-1" style={{ color: "#6b7f78" }}>Số ngày phép cho nhân viên mới</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Phép tăng theo thâm niên</label>
                    <select className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }}>
                      <option>Không tăng</option>
                      <option selected>Tăng theo năm</option>
                      <option>Tăng theo mốc</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Phép tối đa</label>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="20" min="12"
                        className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }} />
                      <span className="text-sm" style={{ color: "#6b7f78" }}>ngày</span>
                    </div>
                  </div>
                </div>

                {/* Seniority rules table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#f7f7f7" }}>
                        {["Từ năm", "Đến năm", "Số ngày phép", "Thao tác"].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "#6b7f78" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {LEAVE_RULES.map((rule, i) => (
                        <tr key={i} className="border-b last:border-0" style={{ borderColor: "#f0f4f2" }}>
                          <td className="px-3 py-3"><input type="number" defaultValue={rule.fromYear} className="w-full px-2 py-1 rounded border text-sm" style={{ borderColor: "#e2ede9" }} /></td>
                          <td className="px-3 py-3"><input type="number" defaultValue={rule.toYear} className="w-full px-2 py-1 rounded border text-sm" style={{ borderColor: "#e2ede9" }} /></td>
                          <td className="px-3 py-3"><input type="number" defaultValue={rule.days} className="w-full px-2 py-1 rounded border text-sm" style={{ borderColor: "#e2ede9" }} /></td>
                          <td className="px-3 py-3">
                            <button className="w-7 h-7 rounded flex items-center justify-center hover:bg-red-50" style={{ color: "#ef4444" }}>
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: "#1DB87A", color: "#1DB87A" }}>
                  <Plus size={14} /> Thêm quy tắc
                </button>
              </div>

              {/* Carry Over */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Cấu hình chuyển phép (Carry Over)
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: "#203430" }}>Cho phép chuyển phép</p>
                      <p className="text-xs" style={{ color: "#6b7f78" }}>Nhân viên có thể chuyển phép sang năm tiếp theo</p>
                    </div>
                    <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-500" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Số ngày tối đa có thể chuyển</label>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="5" className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }} />
                      <span className="text-sm" style={{ color: "#6b7f78" }}>ngày</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Hạn sử dụng</label>
                    <div className="flex items-center gap-2">
                      <input type="date" defaultValue="2026-03-31" className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Thời gian báo trước</label>
                    <div className="flex items-center gap-2">
                      <input type="number" defaultValue="30" className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }} />
                      <span className="text-sm" style={{ color: "#6b7f78" }}>ngày</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Overtime Policy */}
          {activeTab === "overtime" && (
            <div className="space-y-6">
              {/* Overtime Rules */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Quy tắc tính Overtime
                </h3>
                <div className="grid md:grid-cols-4 gap-4">
                  {[
                    { label: "Giờ làm chuẩn/ngày", value: "8", unit: "giờ" },
                    { label: "Ngưỡng OT tối thiểu", value: "0.5", unit: "giờ" },
                    { label: "OT tối đa/ngày", value: "4", unit: "giờ" },
                    { label: "OT tối đa/tháng", value: "40", unit: "giờ" },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>{item.label}</label>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={item.value} step="0.5"
                          className="flex-1 px-3 py-2 rounded-lg border text-sm"
                          style={{ borderColor: "#e2ede9", color: "#203430" }} />
                        <span className="text-sm" style={{ color: "#6b7f78" }}>{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comp-off Conversion */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Tỷ lệ quy đổi Comp-off
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { label: "Ngày thường", formula: "1h OT =", value: "1", unit: "h nghỉ bù" },
                    { label: "Cuối tuần", formula: "1h OT =", value: "1.5", unit: "h nghỉ bù" },
                    { label: "Ngày lễ", formula: "1h OT =", value: "2", unit: "h nghỉ bù" },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="block text-xs font-semibold mb-2" style={{ color: "#203430" }}>{item.label}</label>
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: "#6b7f78" }}>{item.formula}</span>
                        <input type="number" defaultValue={item.value} step="0.1"
                          className="flex-1 px-3 py-2 rounded-lg border text-sm text-center"
                          style={{ borderColor: "#e2ede9", color: "#203430" }} />
                        <span className="text-xs" style={{ color: "#6b7f78" }}>{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Comp-off Expiry */}
              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Quy tắc hết hạn Comp-off
                </h3>
                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    { label: "Thời hạn sử dụng", value: "90", unit: "ngày" },
                    { label: "Báo trước", value: "7", unit: "ngày" },
                    { label: "Thời gian timeout", value: "30", unit: "phút" },
                  ].map((item) => (
                    <div key={item.label}>
                      <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>{item.label}</label>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={item.value}
                          className="flex-1 px-3 py-2 rounded-lg border text-sm"
                          style={{ borderColor: "#e2ede9", color: "#203430" }} />
                        <span className="text-sm" style={{ color: "#6b7f78" }}>{item.unit}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Approval Workflow */}
          {activeTab === "approval" && (
            <div className="space-y-6">
              {/* Workflow diagram */}
              <div className="flex justify-center gap-3 py-6 px-4 rounded-lg overflow-x-auto" style={{ background: "#f0f4f2" }}>
                {[
                  { label: "Nháp", color: "#6b7280" },
                  { label: "Chờ duyệt", color: "#f59e0b" },
                  { label: "Đã duyệt", color: "#1DB87A" },
                  { label: "HR xác nhận", color: "#06b6d4" },
                ].map((step, i) => (
                  <div key={step.label} className="flex items-center gap-3 flex-shrink-0">
                    <div className="px-3 py-2 rounded-lg text-white text-xs font-bold text-center min-w-[80px]"
                      style={{ background: step.color }}>
                      {step.label}
                    </div>
                    {i < 3 && <div className="text-xl" style={{ color: step.color }}>→</div>}
                  </div>
                ))}
              </div>

              {/* Approval thresholds */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Thời hạn duyệt
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  {[
                    { role: "Manager duyệt trong", hours: "24" },
                    { role: "HR xác nhận trong", hours: "48" },
                  ].map((item) => (
                    <div key={item.role}>
                      <label className="block text-sm font-medium mb-2" style={{ color: "#203430" }}>{item.role}</label>
                      <div className="flex items-center gap-2">
                        <input type="number" defaultValue={item.hours}
                          className="flex-1 px-3 py-2 rounded-lg border text-sm"
                          style={{ borderColor: "#e2ede9", color: "#203430" }} />
                        <span className="text-sm" style={{ color: "#6b7f78" }}>giờ</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Escalation rules */}
              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Quy tắc Escalation
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#f7f7f7" }}>
                        {["Điều kiện", "Thời gian chờ", "Escalate đến", "Hành động", "Trạng thái", "Thao tác"].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "#6b7f78" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {ESCALATION_RULES.map((rule, i) => (
                        <tr key={i} className="border-b last:border-0" style={{ borderColor: "#f0f4f2" }}>
                          <td className="px-3 py-3 text-xs" style={{ color: "#203430" }}>{rule.condition}</td>
                          <td className="px-3 py-3 text-xs" style={{ color: "#203430" }}>{rule.timeLimit > 0 ? `${rule.timeLimit}h` : "Tự động"}</td>
                          <td className="px-3 py-3 text-xs" style={{ color: "#203430" }}>{rule.escalateTo}</td>
                          <td className="px-3 py-3">
                            <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: "#D3F2E7", color: "#0E474E" }}>
                              Hoạt động
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <input type="checkbox" defaultChecked className="w-4 h-4 accent-blue-500" />
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1">
                              <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-amber-50">
                                <Edit2 size={13} style={{ color: "#f59e0b" }} />
                              </button>
                              <button className="w-6 h-6 rounded flex items-center justify-center hover:bg-red-50">
                                <Trash2 size={13} style={{ color: "#ef4444" }} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button className="mt-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: "#1DB87A", color: "#1DB87A" }}>
                  <Plus size={14} /> Thêm quy tắc escalation
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: Notifications */}
          {activeTab === "notification" && (
            <div className="space-y-6">
              {/* Email config */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: "#203430" }}>
                  <Mail size={16} /> Cấu hình Email
                </h3>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>SMTP Server</label>
                    <input type="text" defaultValue="smtp.company.com"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Port</label>
                    <input type="number" defaultValue="587"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Username</label>
                    <input type="email" defaultValue="noreply@company.com"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Password</label>
                    <div className="flex gap-2">
                      <input type={showPassword ? "text" : "password"} defaultValue="••••••••"
                        className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }} />
                      <button onClick={() => setShowPassword(!showPassword)} className="px-2 flex items-center" style={{ color: "#6b7f78" }}>
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-semibold border"
                  style={{ borderColor: "#3b82f6", color: "#3b82f6" }}>
                  <Zap size={14} /> Test kết nối
                </button>
              </div>

              {/* Notification templates */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Cấu hình loại thông báo
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#f7f7f7" }}>
                        {["Sự kiện", "Email", "SMS", "In-app", "Người nhận", "Template", "Thao tác"].map((h) => (
                          <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold" style={{ color: "#6b7f78" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {NOTIFICATION_TEMPLATES.map((t, i) => (
                        <tr key={i} className="border-b last:border-0" style={{ borderColor: "#f0f4f2" }}>
                          <td className="px-3 py-3 text-xs" style={{ color: "#203430" }}>{t.event}</td>
                          <td className="px-3 py-3"><input type="checkbox" defaultChecked={t.email} className="w-4 h-4 accent-blue-500" /></td>
                          <td className="px-3 py-3"><input type="checkbox" defaultChecked={t.sms} className="w-4 h-4 accent-blue-500" /></td>
                          <td className="px-3 py-3"><input type="checkbox" defaultChecked={t.inApp} className="w-4 h-4 accent-blue-500" /></td>
                          <td className="px-3 py-3 text-xs" style={{ color: "#6b7f78" }}>{t.recipients}</td>
                          <td className="px-3 py-3">
                            <button className="text-xs font-semibold" style={{ color: "#3b82f6" }}>Sửa</button>
                          </td>
                          <td className="px-3 py-3">
                            <input type="checkbox" defaultChecked={t.enabled} className="w-4 h-4 accent-blue-500" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Notification schedule */}
              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="font-semibold text-sm mb-4" style={{ color: "#203430" }}>
                  Lịch trình thông báo
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "#203430" }}>Thông báo hàng ngày</label>
                    <div className="flex items-center gap-3">
                      <input type="time" defaultValue="08:00"
                        className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }} />
                      <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2" style={{ color: "#203430" }}>Thông báo hàng tuần</label>
                    <div className="flex items-center gap-3">
                      <select className="flex-1 px-3 py-2 rounded-lg border text-sm"
                        style={{ borderColor: "#e2ede9", color: "#203430" }}>
                        <option>Thứ 2</option>
                        <option selected>Thứ 5</option>
                        <option>Thứ 6</option>
                      </select>
                      <input type="checkbox" defaultChecked className="w-5 h-5 accent-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: System */}
          {activeTab === "system" && (
            <div className="space-y-6">
              {/* Company info */}
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: "#203430" }}>
                  <Info size={16} /> Cấu hình công ty
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Tên công ty</label>
                    <input type="text" defaultValue="Công ty TNHH ABC"
                      className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Múi giờ</label>
                    <select className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }}>
                      <option selected>GMT+7 (Việt Nam)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Ngôn ngữ mặc định</label>
                    <select className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }}>
                      <option selected>Tiếng Việt</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Định dạng ngày</label>
                    <select className="w-full px-3 py-2 rounded-lg border text-sm"
                      style={{ borderColor: "#e2ede9", color: "#203430" }}>
                      <option selected>DD/MM/YYYY</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Security */}
              <div className="p-3 rounded-lg" style={{ background: "#fef2f2", borderLeft: "4px solid #ef4444" }}>
                <div className="flex items-start gap-2">
                  <AlertTriangle size={16} style={{ color: "#ef4444", marginTop: "2px", flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: "#991b1b" }}>
                    Cảnh báo: Thay đổi cấu hình bảo mật có thể ảnh hưởng đến tất cả người dùng trong hệ thống.
                  </p>
                </div>
              </div>

              <div className="border-l-4 border-red-500 pl-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: "#203430" }}>
                  <Lock size={16} /> Cài đặt bảo mật
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Yêu cầu xác thực 2 lớp (MFA)", enabled: true },
                    { label: "Tự động đăng xuất khi không hoạt động", enabled: true },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between">
                      <label className="text-sm" style={{ color: "#203430" }}>{item.label}</label>
                      <input type="checkbox" defaultChecked={item.enabled} className="w-5 h-5 accent-blue-500" />
                    </div>
                  ))}
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: "#6b7f78" }}>Thời gian timeout (phút)</label>
                    <input type="number" defaultValue="30"
                      className="w-full px-3 py-2 rounded-lg border text-sm max-w-xs"
                      style={{ borderColor: "#e2ede9", color: "#203430" }} />
                  </div>
                </div>
              </div>

              {/* Backup */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: "#203430" }}>
                  <HardDrive size={16} /> Sao lưu &amp; Bảo trì
                </h3>
                <div className="p-4 rounded-lg mb-4" style={{ background: "#D3F2E7" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold" style={{ color: "#0E474E" }}>Trạng thái backup</p>
                      <p className="text-xs mt-1" style={{ color: "#0E474E" }}>Backup gần nhất: 28/02/2026 02:00:00</p>
                      <p className="text-xs mt-1" style={{ color: "#0E474E" }}>Kích thước: 245.6 MB</p>
                      <p className="text-xs font-bold mt-2" style={{ color: "#1DB87A" }}>Thành công</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button className="px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "#1DB87A", color: "white" }}>
                        Tải backup
                      </button>
                      <button className="px-3 py-1.5 rounded-lg text-xs font-semibold border" style={{ borderColor: "#1DB87A", color: "#1DB87A" }}>
                        Backup ngay
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* System info */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold text-sm mb-4 flex items-center gap-2" style={{ color: "#203430" }}>
                  <Activity size={16} /> Thông tin hệ thống
                </h3>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    {[
                      { label: "Phiên bản hệ thống:", value: "v2.1.0" },
                      { label: "Cơ sở dữ liệu:", value: "PostgreSQL 14.2" },
                      { label: "Server:", value: "AWS EC2 t3.medium" },
                      { label: "Uptime:", value: "15 ngày 8 giờ 32 phút" },
                      { label: "Tổng người dùng:", value: "156 người" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between text-xs">
                        <span style={{ color: "#6b7f78" }}>{item.label}</span>
                        <span className="font-medium" style={{ color: "#203430" }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: "CPU sử dụng:", value: "25%" },
                      { label: "RAM sử dụng:", value: "60%" },
                      { label: "Disk sử dụng:", value: "43%" },
                      { label: "Network I/O:", value: "2.3 MB/s ↑ 1.8 MB/s ↓" },
                    ].map((item) => (
                      <div key={item.label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color: "#6b7f78" }}>{item.label}</span>
                          <span className="font-medium" style={{ color: "#203430" }}>{item.value}</span>
                        </div>
                        {item.label !== "Network I/O:" && (
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "#f0f4f2" }}>
                            <div className="h-full rounded-full" style={{
                              width: item.label.includes("CPU") ? "25%" : item.label.includes("RAM") ? "60%" : "43%",
                              background: item.label.includes("CPU") ? "#1DB87A" : item.label.includes("RAM") ? "#3b82f6" : "#f59e0b",
                            }} />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
