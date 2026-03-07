"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  Clock,
  Users,
  BarChart3,
  Smartphone,
  User,
  Lock,
  Eye,
  EyeOff,
  LogIn,
  Shield,
  CheckCircle2,
} from "lucide-react";
import {
  apiClient,
  getStoredToken,
  setAuthSession,
} from "@/lib/api-client";

type Role = "employee" | "manager" | "hr" | "admin";

const DEMO_ACCOUNTS = [
  {
    username: "employee",
    password: "123456",
    role: "employee" as Role,
    label: "Nhân viên",
  },
  {
    username: "manager",
    password: "123456",
    role: "manager" as Role,
    label: "Quản lý",
  },
  { username: "hr", password: "123456", role: "hr" as Role, label: "HR" },
  {
    username: "admin",
    password: "123456",
    role: "admin" as Role,
    label: "Admin",
  },
];

const FEATURES = [
  { icon: <CalendarCheck size={20} />, text: "Quản lý nghỉ phép thông minh" },
  { icon: <Clock size={20} />, text: "Theo dõi overtime & comp-off" },
  { icon: <Users size={20} />, text: "Quản lý nhân viên toàn diện" },
  { icon: <BarChart3 size={20} />, text: "Báo cáo và thống kê chi tiết" },
  { icon: <Smartphone size={20} />, text: "Tương thích mọi thiết bị" },
];

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [forgotOpen, setForgotOpen] = useState(false);

  const handleDemoClick = (account: (typeof DEMO_ACCOUNTS)[0], idx: number) => {
    setUsername(account.username);
    setPassword(account.password);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1200);
  };

  useEffect(() => {
    if (getStoredToken()) {
      router.replace("/dashboard");
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { data } = await apiClient.post<{
        accessToken: string;
        user: {
          id: string;
          username: string;
          email: string;
          fullName: string;
          role: string;
          department?: string | null;
          position?: string | null;
          avatar?: string | null;
        };
      }>("/api/auth/login", {
        username,
        password,
      });

      setAuthSession(
        {
          accessToken: data.accessToken,
          user: data.user,
        },
        rememberMe
      );

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "linear-gradient(135deg, #0E474E 0%, #1DB87A 100%)",
      }}
    >
      <div className="bg-white rounded-2xl shadow-2xl overflow-hidden w-full max-w-6xl flex min-h-[600px]">
        {/* Left panel - Branding */}
        <div
          className="hidden lg:flex flex-col justify-between p-12 w-1/2"
          style={{
            background: "linear-gradient(160deg, #0E474E 0%, #1DB87A 100%)",
          }}
        >
          <div>
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mb-8"
              style={{ background: "rgba(255,255,255,0.2)" }}
            >
              <Building2 size={32} className="text-white" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-4 leading-tight">
              Leave Management
              <br />
              System
            </h1>
            <p
              className="text-base mb-12 leading-relaxed"
              style={{ color: "rgba(255,255,255,0.85)" }}
            >
              Hệ thống quản lý nghỉ phép hiện đại, dễ sử dụng và hiệu quả cho
              doanh nghiệp
            </p>
          </div>

          <div className="space-y-4">
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className="flex items-center gap-4 text-white/90"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  {f.icon}
                </div>
                <span className="text-base">{f.text}</span>
              </div>
            ))}
          </div>

          <div className="text-white/60 text-sm">
            © 2026 Leave Management System
          </div>
        </div>

        {/* Right panel - Login Form */}
        <div className="flex-1 flex flex-col justify-center p-12 lg:p-16">
          <div className="max-w-md mx-auto w-full">
            <div className="mb-10">
              <div className="flex items-center gap-3 mb-3">
                <Shield size={28} style={{ color: "#1DB87A" }} />
                <h2
                  className="text-3xl font-bold"
                  style={{ color: "#0E474E" }}
                >
                  Đăng nhập
                </h2>
              </div>
              <p className="text-base" style={{ color: "#6b7f78" }}>
                Chào mừng bạn quay trở lại! Vui lòng đăng nhập để tiếp tục.
              </p>
            </div>

            {/* Login form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "#203430" }}
                >
                  Tên đăng nhập
                </label>
                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Nhập tên đăng nhập hoặc email"
                    required
                    className="w-full pl-12 pr-4 py-3.5 rounded-xl border-2 text-base outline-none transition-all"
                    style={{
                      borderColor: "#e2ede9",
                      background: "#fff",
                      color: "#203430",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#1DB87A")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#e2ede9")
                    }
                  />
                </div>
              </div>

              <div>
                <label
                  className="block text-sm font-semibold mb-2"
                  style={{ color: "#203430" }}
                >
                  Mật khẩu
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    required
                    className="w-full pl-12 pr-12 py-3.5 rounded-xl border-2 text-base outline-none transition-all"
                    style={{
                      borderColor: "#e2ede9",
                      background: "#fff",
                      color: "#203430",
                    }}
                    onFocus={(e) =>
                      (e.currentTarget.style.borderColor = "#1DB87A")
                    }
                    onBlur={(e) =>
                      (e.currentTarget.style.borderColor = "#e2ede9")
                    }
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "#1DB87A" }}
                  />
                  Ghi nhớ đăng nhập
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm font-semibold hover:underline"
                  style={{ color: "#1DB87A" }}
                >
                  Quên mật khẩu?
                </button>
              </div>

              {error && (
                <div
                  className="text-sm px-4 py-3.5 rounded-xl flex items-start gap-2"
                  style={{
                    background: "#fef2f2",
                    color: "#dc2626",
                    border: "2px solid #fecaca",
                  }}
                >
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed"
                style={{
                  background: "linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)",
                }}
              >
                {loading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    ĐĂNG NHẬP
                  </>
                )}
              </button>
            </form>

            {/* Demo accounts */}
            <div className="mt-8">
              <div
                className="text-xs font-semibold uppercase tracking-wider mb-3 flex items-center gap-2"
                style={{ color: "#6b7f78" }}
              >
                <div
                  className="h-px flex-1"
                  style={{ background: "#e2ede9" }}
                />
                <span>Tài khoản demo</span>
                <div
                  className="h-px flex-1"
                  style={{ background: "#e2ede9" }}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((account, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDemoClick(account, i)}
                    className="flex flex-col items-start px-3 py-2.5 rounded-lg text-left transition-all hover:shadow-md border-2"
                    style={{
                      borderColor:
                        copiedIndex === i ? "#1DB87A" : "#e2ede9",
                      background: copiedIndex === i ? "#f0f9f5" : "#fff",
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      {copiedIndex === i && (
                        <CheckCircle2 size={14} style={{ color: "#1DB87A" }} />
                      )}
                      <span
                        className="font-bold text-xs"
                        style={{ color: "#0E474E" }}
                      >
                        {account.label}
                      </span>
                    </div>
                    <span className="text-xs" style={{ color: "#6b7f78" }}>
                      {account.username}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(14,71,78,0.45)" }}
          onClick={() => setForgotOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-bold text-lg mb-2" style={{ color: "#203430" }}>
              Quên mật khẩu
            </h3>
            <p className="text-sm mb-5" style={{ color: "#6b7f78" }}>
              Vui lòng liên hệ Admin/HR để được hỗ trợ đặt lại mật khẩu.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setForgotOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border hover:bg-gray-50"
                style={{ borderColor: "#e2ede9", color: "#203430" }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
