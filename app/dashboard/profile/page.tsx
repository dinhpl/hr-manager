'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { User, Lock, Camera, Upload, Eye, EyeOff, Save, Loader2, X, Check } from 'lucide-react';
import { apiClient, clearAuthSession, getApiBaseUrl } from '@/lib/api-client';
import { getRoleLabel } from '@/lib/hr-utils';

interface UserProfile {
  id: string;
  username: string;
  email: string;
  fullName: string;
  firstName?: string;
  lastName?: string;
  role: string;
  department?: string;
  position?: string;
  avatar?: string;
  companyJoinDate?: string;
  manager?: { id: string; fullName: string } | null;
}

const PRESET_AVATARS = [
  '/assets/avatars/bluey_1.png',
  '/assets/avatars/bluey_2.png',
  '/assets/avatars/bluey_3.png',
  '/assets/avatars/bluey_4.png',
  '/assets/avatars/bluey_5.png',
  '/assets/avatars/bluey_6.png',
  '/assets/avatars/bluey_7.png',
  '/assets/avatars/bluey_8.png',
  '/assets/avatars/bluey_9.png',
  '/assets/avatars/bluey_10.png',
];

export default function ProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'password'>('profile');
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showAvatarList, setShowAvatarList] = useState(false);

  // Profile form
  const [fullName, setFullName] = useState('');
  const [position, setPosition] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const loadUser = useCallback(async () => {
    try {
      const { data } = await apiClient.get<UserProfile>('/api/auth/me');
      setUser(data);
      setFullName(data.fullName || '');
      setPosition(data.position || '');
      setSelectedAvatar(data.avatar || '');
    } catch {
      clearAuthSession();
      router.replace('/');
    }
  }, [router]);

  useEffect(() => {
    void loadUser();
  }, [loadUser]);

  const handleProfileSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const { data } = await apiClient.patch<UserProfile>('/api/auth/profile', {
        fullName,
        position,
        avatar: selectedAvatar,
      });
      setUser(data);
      setSuccess('Cập nhật thông tin thành công!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cập nhật thất bại');
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    setError(null);

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const { data } = await apiClient.post<UserProfile>('/api/auth/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUser(data);
      setSelectedAvatar(data.avatar || '');
      setSuccess('Upload avatar thành công!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload thất bại');
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp');
      return;
    }

    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await apiClient.patch('/api/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setSuccess('Đổi mật khẩu thành công!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại');
    } finally {
      setSaving(false);
    }
  };

  const getAvatarUrl = (avatar?: string) => {
    if (!avatar) return null;
    // External URL: use as-is
    if (avatar.startsWith('http')) return avatar;
    // Preset avatars (same origin): /assets/...
    if (avatar.startsWith('/assets')) return avatar;
    // Uploaded avatars: backend phục vụ file → dùng full URL backend để tránh lỗi 500 khi chạy Docker (rewrite /uploads từ container frontend không tới được backend qua localhost)
    if (avatar.startsWith('/uploads')) return getApiBaseUrl() + avatar;
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold mb-6" style={{ color: '#203430' }}>
        Thông tin cá nhân
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl bg-gray-100 w-fit">
        <button
          onClick={() => setActiveTab('profile')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'profile'
              ? 'bg-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <User size={16} />
          Thông tin
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'password'
              ? 'bg-white shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lock size={16} />
          Đổi mật khẩu
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-4 p-3 rounded-lg bg-green-50 text-green-700 text-sm flex items-center gap-2">
          <Check size={16} />
          {success}
        </div>
      )}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-center gap-2">
          <X size={16} />
          {error}
        </div>
      )}

      {activeTab === 'profile' && (
        <div className="bg-white rounded-xl p-6 shadow-sm" style={{ border: '1px solid #e2ede9' }}>
          {/* Avatar Section */}
          <div className="flex flex-col items-center mb-8">
            <div className="relative mb-4">
              {getAvatarUrl(selectedAvatar) ? (
                <img
                  src={getAvatarUrl(selectedAvatar) || ''}
                  alt="Avatar"
                  className="w-24 h-24 rounded-full object-cover border-4"
                  style={{ borderColor: '#D3F2E7' }}
                />
              ) : (
                <div
                  className="w-24 h-24 rounded-full flex items-center justify-center text-3xl font-bold text-white"
                  style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
                >
                  {user?.fullName?.charAt(0) || 'U'}
                </div>
              )}
              {/* Toggle avatar list button */}
              <button
                onClick={() => setShowAvatarList(!showAvatarList)}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white border-2 flex items-center justify-center shadow-md hover:bg-gray-50"
                style={{ borderColor: '#1DB87A' }}
                title="Chọn avatar"
              >
                <Camera size={14} style={{ color: '#1DB87A' }} />
              </button>
            </div>

            {/* Preset Avatars - collapsible */}
            {showAvatarList && (
              <div className="w-full animate-in fade-in slide-in-from-top-2">
                <p className="text-xs text-center text-muted-foreground mb-3">
                  Chọn avatar có sẵn hoặc upload ảnh của bạn
                </p>
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {PRESET_AVATARS.map((avatar) => (
                    <button
                      key={avatar}
                      onClick={() => handleAvatarSelect(avatar)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                        selectedAvatar === avatar
                          ? 'border-[#1DB87A] ring-2 ring-[#1DB87A]/20'
                          : 'border-transparent'
                      }`}
                    >
                      <img
                        src={avatar}
                        alt="Preset avatar"
                        className="w-full h-full object-cover"
                      />
                      {selectedAvatar === avatar && (
                        <div className="absolute inset-0 bg-[#1DB87A]/20 flex items-center justify-center">
                          <Check size={16} className="text-white" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {/* Upload button */}
                <div className="flex justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-all hover:bg-gray-50 disabled:opacity-50"
                    style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
                  >
                    <Upload size={14} />
                    Upload ảnh mới
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              </div>
            )}
          </div>

          {/* User Info Display */}
          <div className="space-y-4 mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-muted-foreground">Tên đăng nhập</label>
                <p className="font-medium" style={{ color: '#203430' }}>
                  {user?.username}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="font-medium" style={{ color: '#203430' }}>
                  {user?.email}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Vai trò</label>
                <p className="font-medium" style={{ color: '#203430' }}>
                  {user?.role && getRoleLabel(user.role)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Phòng ban</label>
                <p className="font-medium" style={{ color: '#203430' }}>
                  {user?.department || '-'}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Ngày vào công ty</label>
                <p className="font-medium" style={{ color: '#203430' }}>
                  {user?.companyJoinDate
                    ? new Date(user.companyJoinDate).toLocaleDateString('vi-VN')
                    : '-'}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Quản lý</label>
                <p className="font-medium" style={{ color: '#203430' }}>
                  {user?.manager?.fullName || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Editable Fields */}
          <div className="space-y-4 pt-4 border-t" style={{ borderColor: '#e2ede9' }}>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#203430' }}>
                Họ và tên
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#e2ede9' }}
                placeholder="Nhập họ và tên"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#203430' }}>
                Chức vụ
              </label>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border text-sm"
                style={{ borderColor: '#e2ede9' }}
                placeholder="Nhập chức vụ"
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleProfileSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              Lưu thay đổi
            </button>
          </div>
        </div>
      )}

      {activeTab === 'password' && (
        <div className="bg-white rounded-xl p-6 shadow-sm" style={{ border: '1px solid #e2ede9' }}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#203430' }}>
                Mật khẩu hiện tại
              </label>
              <div className="relative">
                <input
                  type={showPasswords.current ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm pr-10"
                  style={{ borderColor: '#e2ede9' }}
                  placeholder="Nhập mật khẩu hiện tại"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, current: !p.current }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.current ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#203430' }}>
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showPasswords.new ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm pr-10"
                  style={{ borderColor: '#e2ede9' }}
                  placeholder="Nhập mật khẩu mới (ít nhất 6 ký tự)"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, new: !p.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.new ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: '#203430' }}>
                Xác nhận mật khẩu mới
              </label>
              <div className="relative">
                <input
                  type={showPasswords.confirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border text-sm pr-10"
                  style={{ borderColor: '#e2ede9' }}
                  placeholder="Nhập lại mật khẩu mới"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords((p) => ({ ...p, confirm: !p.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPasswords.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-red-500 mt-1">Mật khẩu không khớp</p>
              )}
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handlePasswordChange}
              disabled={
                saving ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword
              }
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
              Đổi mật khẩu
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
