'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff } from 'lucide-react';
import BrandLogo from '@/components/brand-logo';
import { apiClient, ApiError, getStoredToken, setAuthSession } from '@/lib/api-client';

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  useEffect(() => {
    if (getStoredToken()) {
      router.replace('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
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
      }>('/api/auth/login', { username, password, rememberMe });

      setAuthSession({ accessToken: data.accessToken, user: data.user }, rememberMe);
      router.push('/dashboard');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 401 || err.status === 400) {
          setError('Tên đăng nhập hoặc mật khẩu không đúng.');
        } else {
          setError(err.message || 'Đăng nhập thất bại.');
        }
      } else {
        setError('Đăng nhập thất bại.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: '#dce5e2' }}>
      <div className="w-full max-w-[1050px] flex rounded-2xl overflow-hidden shadow-xl" style={{ minHeight: 580 }}>
        {/* Left panel - Hero image */}
        <div
          className="hidden lg:flex relative w-[480px] shrink-0 flex-col justify-between p-10 overflow-hidden"
          style={{ background: '#2a9d6e' }}
        >
          {/* Background image overlay */}
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: 'url(/assets/image.png)',
              mixBlendMode: 'multiply',
              opacity: 0.4,
            }}
          />
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(14,71,78,0.7) 0%, rgba(29,184,122,0.6) 100%)' }} />

          {/* Content */}
          <div className="relative z-10">
            <BrandLogo
              size={50}
              priority
              title="Leave Management"
              subtitle="HR operations workspace"
              imageClassName="p-1.5"
              titleClassName="text-lg text-white"
              subtitleClassName="mt-1 uppercase tracking-[0.22em] text-white/65"
              wrapperClassName="mb-16"
            />
            <h1 className="text-[2.5rem] leading-tight font-bold text-white mb-3">
              Welcome to<br />Leave Management
            </h1>
            <p className="text-white/80 text-base leading-relaxed max-w-[340px]">
              Quản lý nghỉ phép thông minh, nhanh chóng và dễ dàng — tất cả trong một nền tảng
            </p>
          </div>

          <div className="relative z-10 text-white/50 text-xs">
            © 2026 Leave Management System
          </div>
        </div>

        {/* Right panel - Login form */}
        <div className="flex-1 bg-white flex flex-col justify-center px-10 py-12 lg:px-16">
          <div className="max-w-[380px] mx-auto w-full">
            <BrandLogo
              align="center"
              size={74}
              title="Leave Management"
              subtitle="Smart HR portal"
              imageClassName="p-2"
              titleClassName="text-base text-[#203430]"
              subtitleClassName="mt-1 tracking-[0.18em] uppercase text-[#6b7f78]"
              wrapperClassName="mb-6 flex-col gap-3"
            />

            <div className="text-center mb-8">
              <h2 className="text-xl font-bold text-[#203430] mb-1.5">Chào mừng trở lại</h2>
              <p className="text-sm text-[#6b7f78]">
                Đăng nhập để tiếp tục quản lý nhân sự
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#203430] mb-1.5">
                  Email / Tên đăng nhập
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="hr@onetech.vn"
                  required
                  className="w-full px-4 py-3 rounded-lg border text-sm outline-none transition-colors focus:border-[#1DB87A] focus:ring-2 focus:ring-[#1DB87A]/20"
                  style={{ borderColor: '#e2ede9', color: '#203430' }}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-[#203430] mb-1.5">
                  Mật khẩu
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    required
                    className="w-full px-4 py-3 pr-11 rounded-lg border text-sm outline-none transition-colors focus:border-[#1DB87A] focus:ring-2 focus:ring-[#1DB87A]/20"
                    style={{ borderColor: '#e2ede9', color: '#203430' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6b7f78] hover:text-[#203430] transition-colors"
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#6b7f78]">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-[#e2ede9]"
                    style={{ accentColor: '#1DB87A' }}
                  />
                  Ghi nhớ đăng nhập
                </label>
                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm font-semibold text-[#1DB87A] hover:underline"
                >
                  Quên mật khẩu?
                </button>
              </div>

              {error && (
                <div className="text-sm px-4 py-3 rounded-lg bg-red-50 text-red-600 border border-red-200 flex items-center gap-2">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-lg text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ background: '#1DB87A' }}
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Đang đăng nhập...
                  </>
                ) : (
                  'Đăng nhập'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Forgot password modal */}
      {forgotOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(14,71,78,0.45)' }}
          onClick={() => setForgotOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-2 text-[#203430]">Quên mật khẩu</h3>
            <p className="text-sm mb-5 text-[#6b7f78]">
              Vui lòng liên hệ Admin/HR để được hỗ trợ đặt lại mật khẩu.
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setForgotOpen(false)}
                className="px-4 py-2 rounded-lg text-sm font-semibold border border-[#e2ede9] text-[#203430] hover:bg-gray-50"
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
