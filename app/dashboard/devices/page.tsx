'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Monitor,
  Laptop,
  Smartphone,
  Computer,
  Package,
  Plus,
  Search,
  RefreshCw,
  Pencil,
  Trash2,
  UserPlus,
  UserMinus,
  ArrowLeftRight,
  Wrench,
  ChevronLeft,
  ChevronRight,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  Archive,
  ImageIcon,
  Upload,
  Eye,
  ShieldCheck,
  ShieldOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { DatePicker } from '@/components/ui/date-picker';
import { toast } from 'sonner';
import { apiClient, getApiBaseUrl, USER_INFO_KEY } from '@/lib/api-client';

// ---------- Types ----------

type DeviceStatus = 'AVAILABLE' | 'IN_USE' | 'MAINTENANCE' | 'RETIRED';
type DeviceType = 'LAPTOP' | 'DESKTOP_PC' | 'MONITOR' | 'PHONE' | 'OTHER';
type AssignmentStatus = 'ACTIVE' | 'RETURNED';
type MaintenanceStatus = 'OPEN' | 'RESOLVED';

interface DeviceSpec {
  specKey: string;
  specValue: string;
  sortOrder: number;
}

interface DeviceImage {
  id: string;
  imageUrl: string;
  sortOrder: number;
}

interface UserRef {
  id: string;
  fullName: string;
  department?: string | null;
  employeeCode?: string | null;
}

interface ActorRef {
  id: string;
  fullName: string;
}

interface DeviceAssignment {
  id: string;
  deviceId: string;
  userId: string;
  status: AssignmentStatus;
  assignedAt: string;
  returnedAt: string | null;
  note: string | null;
  user: UserRef;
  assignedBy?: ActorRef | null;
  returnedBy?: ActorRef | null;
}

interface MaintenanceLog {
  id: string;
  deviceId: string;
  issue: string;
  resolution: string | null;
  cost: string | null;
  note: string | null;
  status: MaintenanceStatus;
  startDate: string;
  resolvedAt: string | null;
  reportedBy?: ActorRef | null;
  assignedTo?: ActorRef | null;
}

interface AuditLog {
  id: string;
  action: string;
  note: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor: ActorRef;
}

interface Device {
  id: string;
  code: string;
  name: string;
  type: DeviceType;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
  status: DeviceStatus;
  purchaseDate: string | null;
  purchasePrice: string | null;
  warrantyUntil: string | null;
  location: string | null;
  note: string | null;
  imageUrl: string | null;
  images: DeviceImage[];
  specs: DeviceSpec[];
  assignments: DeviceAssignment[];
  maintenanceLogs?: MaintenanceLog[];
  createdAt: string;
}

interface UserDropdown {
  id: string;
  fullName?: string | null;
  employeeCode?: string | null;
  department?: string | null;
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Ảnh trong form: existing (id + url) hoặc pending (file mới)
interface FormImage {
  id?: string;       // existing image id
  url?: string;      // existing image url
  file?: File;       // new file pending upload
  preview: string;   // objectURL for preview (or resolved url for existing)
  markedDelete?: boolean;
}

interface DeviceFormState {
  code: string;
  name: string;
  type: DeviceType | '';
  brand: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  purchasePrice: string;
  hasWarranty: boolean;
  warrantyUntil: string;
  location: string;
  note: string;
  specs: { specKey: string; specValue: string }[];
  images: FormImage[];
}

// ---------- Constants ----------

const DEVICE_TYPE_CONFIG: Record<DeviceType, { label: string; Icon: React.ElementType }> = {
  LAPTOP: { label: 'Laptop', Icon: Laptop },
  DESKTOP_PC: { label: 'Desktop PC', Icon: Computer },
  MONITOR: { label: 'Monitor', Icon: Monitor },
  PHONE: { label: 'Điện thoại', Icon: Smartphone },
  OTHER: { label: 'Khác', Icon: Package },
};

const STATUS_CONFIG: Record<
  DeviceStatus,
  { label: string; badge: string; Icon: React.ElementType }
> = {
  AVAILABLE: {
    label: 'Sẵn sàng',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    Icon: CheckCircle2,
  },
  IN_USE: {
    label: 'Đang dùng',
    badge: 'bg-blue-100 text-blue-700 border border-blue-200',
    Icon: Clock,
  },
  MAINTENANCE: {
    label: 'Bảo trì',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    Icon: AlertCircle,
  },
  RETIRED: {
    label: 'Thanh lý',
    badge: 'bg-gray-100 text-gray-500 border border-gray-200',
    Icon: Archive,
  },
};

const EMPTY_FORM: DeviceFormState = {
  code: '',
  name: '',
  type: '',
  brand: '',
  model: '',
  serialNumber: '',
  purchaseDate: '',
  purchasePrice: '',
  hasWarranty: false,
  warrantyUntil: '',
  location: '',
  note: '',
  specs: [],
  images: [],
};

// ---------- Helpers ----------

function getStoredUserInfo(): { role: string; systemRole?: string | null } {
  if (typeof window === 'undefined') return { role: 'EMPLOYEE' };
  try {
    const raw = localStorage.getItem(USER_INFO_KEY) || sessionStorage.getItem(USER_INFO_KEY);
    if (!raw) return { role: 'EMPLOYEE' };
    const parsed = JSON.parse(raw);
    return { role: parsed?.role ?? 'EMPLOYEE', systemRole: parsed?.systemRole };
  } catch {
    return { role: 'EMPLOYEE' };
  }
}

function getImageSrc(url: string): string {
  if (!url) return '';
  if (url.startsWith('blob:') || url.startsWith('http')) return url;
  return `${getApiBaseUrl()}/uploads/device-images/${url}`;
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('vi-VN');
}

function formatCurrency(val: string | null | undefined) {
  if (!val) return '—';
  const n = parseFloat(val);
  if (isNaN(n)) return '—';
  return n.toLocaleString('vi-VN') + ' đ';
}

function isWarrantyActive(warrantyUntil: string | null | undefined): boolean {
  if (!warrantyUntil) return false;
  return new Date(warrantyUntil) >= new Date();
}

// ---------- Page Component ----------

export default function DevicesPage() {
  const { role: userRole, systemRole } = getStoredUserInfo();
  const isAdmin = userRole === 'ADMIN' || userRole === 'HR' || systemRole === 'ADMIN';
  const isAdminOrHr = isAdmin;

  // Core state
  const [devices, setDevices] = useState<Device[]>([]);
  const [meta, setMeta] = useState<PaginationMeta | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Users dropdown
  const [userOptions, setUserOptions] = useState<UserDropdown[]>([]);

  // Detail sheet
  const [detailDevice, setDetailDevice] = useState<Device | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState('info');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Gallery dialog (full image viewer)
  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [galleryIndex, setGalleryIndex] = useState(0);
  const [galleryOpen, setGalleryOpen] = useState(false);

  // Form dialog
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [form, setForm] = useState<DeviceFormState>(EMPTY_FORM);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Action dialogs
  const [assignDevice, setAssignDevice] = useState<Device | null>(null);
  const [assignUserId, setAssignUserId] = useState('');
  const [assignNote, setAssignNote] = useState('');

  const [unassignDevice, setUnassignDevice] = useState<Device | null>(null);
  const [unassignNote, setUnassignNote] = useState('');

  const [transferDevice, setTransferDevice] = useState<Device | null>(null);
  const [transferUserId, setTransferUserId] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const [maintenanceDevice, setMaintenanceDevice] = useState<Device | null>(null);
  const [maintenanceIssue, setMaintenanceIssue] = useState('');
  const [maintenanceCost, setMaintenanceCost] = useState('');
  const [maintenanceNote, setMaintenanceNote] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);

  // ---------- Fetch ----------

  const fetchDevices = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) setIsLoading(true);
      else setIsRefreshing(true);
      try {
        const params: Record<string, string> = { page: String(page), limit: '20' };
        if (typeFilter) params.type = typeFilter;
        if (statusFilter) params.status = statusFilter;
        if (searchQuery) params.search = searchQuery;
        const qs = new URLSearchParams(params).toString();
        const res = await apiClient.get<Device[]>(`/api/devices?${qs}`);
        setDevices(res.data ?? []);
        if (res.meta) setMeta(res.meta as PaginationMeta);
      } catch {
        toast.error('Không thể tải danh sách thiết bị');
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [page, typeFilter, statusFilter, searchQuery],
  );

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiClient.get<UserDropdown[]>('/api/users/dropdown');
      setUserOptions(res.data ?? []);
    } catch {
      setUserOptions([]);
    }
  }, []);

  useEffect(() => { void fetchDevices(); }, [fetchDevices]);
  useEffect(() => { if (isAdmin) void fetchUsers(); }, [isAdmin, fetchUsers]);

  const handleSearchChange = (val: string) => {
    setSearchInput(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => { setSearchQuery(val); setPage(1); }, 400);
  };

  // ---------- Stats ----------

  const stats = {
    total: meta?.total ?? devices.length,
    available: devices.filter((d) => d.status === 'AVAILABLE').length,
    inUse: devices.filter((d) => d.status === 'IN_USE').length,
    maintenance: devices.filter((d) => d.status === 'MAINTENANCE').length,
  };

  // ---------- Detail ----------

  const openDetail = async (device: Device) => {
    setDetailOpen(true);
    setDetailTab('info');
    setAuditLogs([]);
    setDetailDevice(null);
    setDetailLoading(true);
    try {
      const res = await apiClient.get<Device>(`/api/devices/${device.id}`);
      setDetailDevice(res.data ?? device);
    } catch {
      setDetailDevice(device);
      toast.error('Không thể tải chi tiết thiết bị');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadAuditLogs = useCallback(
    async (deviceId: string) => {
      if (!isAdminOrHr) return;
      setAuditLoading(true);
      try {
        const res = await apiClient.get<AuditLog[]>(`/api/devices/${deviceId}/audit-logs`);
        setAuditLogs(res.data ?? []);
      } catch {
        setAuditLogs([]);
      } finally {
        setAuditLoading(false);
      }
    },
    [isAdminOrHr],
  );

  useEffect(() => {
    if (detailDevice && detailTab === 'audit') void loadAuditLogs(detailDevice.id);
  }, [detailDevice, detailTab, loadAuditLogs]);

  // ---------- Gallery ----------

  const openGallery = (images: string[], startIndex = 0) => {
    setGalleryImages(images);
    setGalleryIndex(startIndex);
    setGalleryOpen(true);
  };

  useEffect(() => {
    if (!galleryOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length);
      if (e.key === 'ArrowRight') setGalleryIndex((i) => (i + 1) % galleryImages.length);
      if (e.key === 'Escape') setGalleryOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [galleryOpen, galleryImages.length]);

  // ---------- Form ----------

  const openCreate = () => {
    setEditingDevice(null);
    // Cleanup previous object URLs
    form.images.forEach((img) => { if (img.file && img.preview) URL.revokeObjectURL(img.preview); });
    setForm(EMPTY_FORM);
    setIsFormOpen(true);
  };

  const openEdit = (device: Device) => {
    setEditingDevice(device);
    form.images.forEach((img) => { if (img.file && img.preview) URL.revokeObjectURL(img.preview); });
    const hasWarranty = !!device.warrantyUntil && isWarrantyActive(device.warrantyUntil);
    setForm({
      code: device.code,
      name: device.name,
      type: device.type,
      brand: device.brand ?? '',
      model: device.model ?? '',
      serialNumber: device.serialNumber ?? '',
      purchaseDate: device.purchaseDate ? device.purchaseDate.slice(0, 10) : '',
      purchasePrice: device.purchasePrice ?? '',
      hasWarranty,
      warrantyUntil: device.warrantyUntil ? device.warrantyUntil.slice(0, 10) : '',
      location: device.location ?? '',
      note: device.note ?? '',
      specs: device.specs.map((s) => ({ specKey: s.specKey, specValue: s.specValue })),
      images: (device.images ?? []).map((img) => ({
        id: img.id,
        url: img.imageUrl,
        preview: getImageSrc(img.imageUrl),
      })),
    });
    setIsFormOpen(true);
  };

  // Image handlers
  const handleImageFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const newImages: FormImage[] = Array.from(files).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setForm((f) => ({ ...f, images: [...f.images, ...newImages] }));
  };

  const markImageDelete = (index: number) => {
    setForm((f) => {
      const images = [...f.images];
      const img = images[index];
      if (img.file) {
        // Pending image: revoke and remove
        URL.revokeObjectURL(img.preview);
        images.splice(index, 1);
      } else {
        // Existing image: mark for deletion
        images[index] = { ...img, markedDelete: !img.markedDelete };
      }
      return { ...f, images };
    });
  };

  const handleFormSubmit = async () => {
    if (!form.code || !form.name || !form.type) {
      toast.error('Vui lòng điền đầy đủ: Mã thiết bị, Tên, Loại');
      return;
    }
    setIsMutating(true);
    try {
      const payload = {
        code: form.code,
        name: form.name,
        type: form.type,
        brand: form.brand || undefined,
        model: form.model || undefined,
        serialNumber: form.serialNumber || undefined,
        purchaseDate: form.purchaseDate || undefined,
        purchasePrice: form.purchasePrice ? parseFloat(form.purchasePrice) : undefined,
        warrantyUntil: form.hasWarranty && form.warrantyUntil ? form.warrantyUntil : undefined,
        location: form.location || undefined,
        note: form.note || undefined,
        specs: form.specs.filter((s) => s.specKey && s.specValue),
      };

      let deviceId: string;
      if (editingDevice) {
        await apiClient.patch(`/api/devices/${editingDevice.id}`, payload);
        deviceId = editingDevice.id;
        toast.success('Cập nhật thiết bị thành công');
      } else {
        const res = await apiClient.post<Device>('/api/devices', payload);
        deviceId = res.data.id;
        toast.success('Tạo thiết bị thành công');
      }

      // Upload new images
      const pendingImages = form.images.filter((img) => img.file);
      if (pendingImages.length > 0) {
        const fd = new FormData();
        pendingImages.forEach((img) => fd.append('images', img.file!));
        await apiClient.post(`/api/devices/${deviceId}/images`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      // Delete removed existing images
      const removedImages = form.images.filter((img) => img.id && img.markedDelete);
      await Promise.all(
        removedImages.map((img) =>
          apiClient.delete(`/api/devices/${deviceId}/images/${img.id}`),
        ),
      );

      // Cleanup object URLs
      form.images.forEach((img) => { if (img.file) URL.revokeObjectURL(img.preview); });
      setIsFormOpen(false);
      void fetchDevices({ silent: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi khi lưu thiết bị';
      toast.error(msg);
    } finally {
      setIsMutating(false);
    }
  };

  // Spec helpers
  const addSpec = () => setForm((f) => ({ ...f, specs: [...f.specs, { specKey: '', specValue: '' }] }));
  const removeSpec = (i: number) => setForm((f) => ({ ...f, specs: f.specs.filter((_, idx) => idx !== i) }));
  const updateSpec = (i: number, field: 'specKey' | 'specValue', val: string) =>
    setForm((f) => {
      const specs = [...f.specs];
      specs[i] = { ...specs[i], [field]: val };
      return { ...f, specs };
    });

  // ---------- Actions ----------

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsMutating(true);
    try {
      await apiClient.delete(`/api/devices/${deleteTarget.id}`);
      toast.success('Đã xóa thiết bị');
      setDeleteTarget(null);
      void fetchDevices({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi xóa');
    } finally {
      setIsMutating(false);
    }
  };

  const handleAssign = async () => {
    if (!assignDevice || !assignUserId) { toast.error('Vui lòng chọn nhân viên'); return; }
    setIsMutating(true);
    try {
      await apiClient.post(`/api/devices/${assignDevice.id}/assign`, { userId: assignUserId, note: assignNote || undefined });
      toast.success('Gán thiết bị thành công');
      setAssignDevice(null); setAssignUserId(''); setAssignNote('');
      void fetchDevices({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi gán thiết bị');
    } finally { setIsMutating(false); }
  };

  const handleUnassign = async () => {
    if (!unassignDevice) return;
    setIsMutating(true);
    try {
      await apiClient.post(`/api/devices/${unassignDevice.id}/unassign`, { note: unassignNote || undefined });
      toast.success('Thu hồi thiết bị thành công');
      setUnassignDevice(null); setUnassignNote('');
      void fetchDevices({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi thu hồi');
    } finally { setIsMutating(false); }
  };

  const handleTransfer = async () => {
    if (!transferDevice || !transferUserId) { toast.error('Vui lòng chọn nhân viên nhận'); return; }
    setIsMutating(true);
    try {
      await apiClient.post(`/api/devices/${transferDevice.id}/transfer`, { toUserId: transferUserId, note: transferNote || undefined });
      toast.success('Chuyển giao thiết bị thành công');
      setTransferDevice(null); setTransferUserId(''); setTransferNote('');
      void fetchDevices({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi chuyển giao');
    } finally { setIsMutating(false); }
  };

  const handleMaintenance = async () => {
    if (!maintenanceDevice || !maintenanceIssue.trim()) { toast.error('Vui lòng nhập mô tả sự cố'); return; }
    setIsMutating(true);
    try {
      await apiClient.post(`/api/devices/${maintenanceDevice.id}/maintenance`, {
        issue: maintenanceIssue,
        cost: maintenanceCost ? parseFloat(maintenanceCost) : undefined,
        note: maintenanceNote || undefined,
      });
      toast.success('Ghi nhận bảo trì thành công');
      setMaintenanceDevice(null); setMaintenanceIssue(''); setMaintenanceCost(''); setMaintenanceNote('');
      void fetchDevices({ silent: true });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Lỗi khi ghi nhận bảo trì');
    } finally { setIsMutating(false); }
  };

  const activeAssignment = (device: Device) => device.assignments?.find((a) => a.status === 'ACTIVE');

  const visibleImages = form.images.filter((img) => !img.markedDelete);

  // ---------- Render ----------

  if (!isAdmin) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: '#fee2e2' }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <p className="text-sm font-semibold" style={{ color: '#203430' }}>Bạn không có quyền truy cập trang này</p>
        <p className="text-xs" style={{ color: '#9eb5ae' }}>Chỉ HR và Admin mới có thể quản lý thiết bị</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Quản lý thiết bị</h1>
          <p className="mt-1 text-sm text-gray-500">Laptop, Monitor, Phone, Desktop PC</p>
        </div>
        {isAdmin && (
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Thêm thiết bị
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Tổng thiết bị', value: stats.total, color: 'text-gray-900' },
          { label: 'Đang dùng', value: stats.inUse, color: 'text-blue-600' },
          { label: 'Bảo trì', value: stats.maintenance, color: 'text-amber-600' },
          { label: 'Sẵn sàng', value: stats.available, color: 'text-emerald-600' },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border bg-white p-4">
            <p className="text-xs text-gray-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input className="pl-9" placeholder="Tìm theo mã, tên, serial..." value={searchInput} onChange={(e) => handleSearchChange(e.target.value)} />
        </div>
        <Select value={typeFilter || 'all'} onValueChange={(v) => { setTypeFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Loại thiết bị" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả loại</SelectItem>
            {Object.entries(DEVICE_TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter || 'all'} onValueChange={(v) => { setStatusFilter(v === 'all' ? '' : v); setPage(1); }}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Trạng thái" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tất cả trạng thái</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => fetchDevices({ silent: true })} disabled={isRefreshing}>
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <RefreshCw className="mr-2 h-5 w-5 animate-spin" />Đang tải...
          </div>
        ) : devices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Package className="mb-3 h-10 w-10 opacity-30" /><p>Không có thiết bị nào</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs text-gray-500">
                <th className="px-4 py-3 text-left font-medium">Thiết bị</th>
                <th className="px-4 py-3 text-left font-medium">Loại</th>
                <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
                <th className="px-4 py-3 text-left font-medium">Đang dùng bởi</th>
                <th className="px-4 py-3 text-left font-medium">Bảo hành</th>
                <th className="px-4 py-3 text-right font-medium">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devices.map((device) => {
                const { Icon: TypeIcon } = DEVICE_TYPE_CONFIG[device.type] ?? { Icon: Package };
                const { label: statusLabel, badge: statusBadge } = STATUS_CONFIG[device.status];
                const currentUser = activeAssignment(device);
                const firstImage = device.images?.[0];
                const warrantyOk = isWarrantyActive(device.warrantyUntil);
                return (
                  <tr key={device.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => openDetail(device)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {firstImage ? (
                          <img
                            src={getImageSrc(firstImage.imageUrl)}
                            alt={device.name}
                            className="h-8 w-8 rounded-lg object-cover border"
                            onClick={(e) => {
                              e.stopPropagation();
                              openGallery(device.images.map((img) => getImageSrc(img.imageUrl)), 0);
                            }}
                          />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-400">
                            <TypeIcon className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium text-gray-900">{device.name}</p>
                          <p className="text-xs text-gray-400">{device.code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{DEVICE_TYPE_CONFIG[device.type]?.label ?? device.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge}`}>{statusLabel}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {currentUser ? (
                        <div>
                          <p className="font-medium">{currentUser.user.fullName}</p>
                          <p className="text-xs text-gray-400">{currentUser.user.department ?? ''}</p>
                        </div>
                      ) : <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {device.warrantyUntil ? (
                        <div className="flex items-center gap-1">
                          {warrantyOk
                            ? <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                            : <ShieldOff className="h-3.5 w-3.5 text-gray-400" />}
                          <span className={`text-xs ${warrantyOk ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {formatDate(device.warrantyUntil)}
                          </span>
                        </div>
                      ) : <span className="text-gray-400 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" title="Sửa" onClick={() => openEdit(device)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {device.status === 'AVAILABLE' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-blue-600 hover:text-blue-700" title="Gán thiết bị" onClick={() => { setAssignDevice(device); setAssignUserId(''); setAssignNote(''); }}>
                                <UserPlus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {device.status === 'IN_USE' && (
                              <>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-amber-600 hover:text-amber-700" title="Thu hồi" onClick={() => { setUnassignDevice(device); setUnassignNote(''); }}>
                                  <UserMinus className="h-3.5 w-3.5" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-indigo-600 hover:text-indigo-700" title="Chuyển giao" onClick={() => { setTransferDevice(device); setTransferUserId(''); setTransferNote(''); }}>
                                  <ArrowLeftRight className="h-3.5 w-3.5" />
                                </Button>
                              </>
                            )}
                            {device.status !== 'RETIRED' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 hover:text-orange-600" title="Bảo trì" onClick={() => { setMaintenanceDevice(device); setMaintenanceIssue(''); setMaintenanceCost(''); setMaintenanceNote(''); }}>
                                <Wrench className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {device.status !== 'IN_USE' && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500 hover:text-red-600" title="Xóa" onClick={() => setDeleteTarget(device)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Tổng {meta.total} thiết bị · Trang {meta.page}/{meta.totalPages}</span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="sm" disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {/* ====== Detail Sheet ====== */}
      <Sheet
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open);
          if (!open) {
            setDetailDevice(null);
            setDetailLoading(false);
          }
        }}
      >
        <SheetContent className="w-full border-0 p-0 sm:max-w-[48rem]">
          {detailLoading && !detailDevice ? (
            <div className="flex h-full min-h-64 flex-col items-center justify-center gap-3 bg-[#f8faf9]">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#1DB87A] border-t-transparent" />
              <span className="text-sm" style={{ color: '#9eb5ae' }}>Đang tải chi tiết thiết bị...</span>
            </div>
          ) : detailDevice ? (
            <div className="flex h-full max-h-[100dvh] flex-col overflow-hidden">

              {/* ── HEADER ── */}
              <div className="relative flex shrink-0 items-center gap-4 border-b bg-white px-6 py-4" style={{ borderColor: '#e2ede9' }}>
                {/* Brand accent bar */}
                <div className="absolute left-0 top-0 h-full w-1 rounded-r-sm" style={{ background: 'linear-gradient(to bottom, #1DB87A, #0E474E)' }} />

                {/* Device type icon */}
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"
                  style={{ background: 'linear-gradient(135deg, #eaf5f0 0%, #d4eae0 100%)', border: '1.5px solid #c4ddd4' }}
                >
                  {(() => {
                    const { Icon } = DEVICE_TYPE_CONFIG[detailDevice.type] ?? { Icon: Package };
                    return <Icon className="h-5 w-5" style={{ color: '#0E474E' }} />;
                  })()}
                </div>

                {/* Name + meta */}
                <div className="min-w-0 flex-1">
                  <SheetHeader className="space-y-0 text-left">
                    <SheetTitle className="truncate text-base font-bold leading-tight" style={{ color: '#0f2420' }}>
                      {detailDevice.name}
                    </SheetTitle>
                  </SheetHeader>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-xs" style={{ color: '#8ba89f' }}>{detailDevice.code}</span>
                    {(detailDevice.brand || detailDevice.model) && (
                      <>
                        <span style={{ color: '#c4d6d0' }}>·</span>
                        <span className="text-xs" style={{ color: '#8ba89f' }}>
                          {[detailDevice.brand, detailDevice.model].filter(Boolean).join(' ')}
                        </span>
                      </>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CONFIG[detailDevice.status].badge}`}
                    >
                      {(() => {
                        const { Icon } = STATUS_CONFIG[detailDevice.status];
                        return <Icon className="h-3 w-3" />;
                      })()}
                      {STATUS_CONFIG[detailDevice.status].label}
                    </span>
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium"
                      style={{ background: '#f0f7f4', color: '#2a7a5a', border: '1px solid #c4ddd4' }}
                    >
                      {DEVICE_TYPE_CONFIG[detailDevice.type]?.label ?? 'Khác'}
                    </span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex shrink-0 items-center gap-2">
                  {isAdmin && (
                    <>
                      <button
                        onClick={() => { setDetailOpen(false); openEdit(detailDevice); }}
                        className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-[#f0f7f4]"
                        style={{ borderColor: '#d4e8de', color: '#2a7a5a', background: '#fff' }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Sửa
                      </button>
                      {detailDevice.status === 'AVAILABLE' && (
                        <button
                          onClick={() => { setDetailOpen(false); setAssignDevice(detailDevice); setAssignUserId(''); setAssignNote(''); }}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-opacity hover:opacity-90"
                          style={{ background: '#1DB87A', color: '#fff' }}
                        >
                          <UserPlus className="h-3.5 w-3.5" />
                          Gán thiết bị
                        </button>
                      )}
                      {detailDevice.status === 'IN_USE' && (
                        <>
                          <button
                            onClick={() => { setDetailOpen(false); setUnassignDevice(detailDevice); setUnassignNote(''); }}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-amber-50"
                            style={{ borderColor: '#fcd34d', color: '#92400e', background: '#fff' }}
                          >
                            <UserMinus className="h-3.5 w-3.5" />
                            Thu hồi
                          </button>
                          <button
                            onClick={() => { setDetailOpen(false); setTransferDevice(detailDevice); setTransferUserId(''); setTransferNote(''); }}
                            className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-indigo-50"
                            style={{ borderColor: '#a5b4fc', color: '#3730a3', background: '#fff' }}
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5" />
                            Chuyển
                          </button>
                        </>
                      )}
                      {detailDevice.status !== 'RETIRED' && (
                        <button
                          onClick={() => { setDetailOpen(false); setMaintenanceDevice(detailDevice); setMaintenanceIssue(''); setMaintenanceCost(''); setMaintenanceNote(''); }}
                          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-3 text-xs font-medium transition-colors hover:bg-orange-50"
                          style={{ borderColor: '#fdba74', color: '#c2410c', background: '#fff' }}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Bảo trì
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* ── BODY: 2-column layout ── */}
              <div className="flex flex-1 overflow-hidden">

                {/* LEFT SIDEBAR */}
                <div
                  className="flex w-[300px] shrink-0 flex-col overflow-y-auto border-r"
                  style={{ borderColor: '#e2ede9', background: '#f8faf9' }}
                >
                  {/* Device image */}
                  <div className="bg-white">
                    {detailDevice.images?.length ? (
                      <>
                        <button
                          className="group relative block w-full cursor-pointer overflow-hidden"
                          style={{ aspectRatio: '4/3' }}
                          onClick={() => openGallery(detailDevice.images.map((img) => getImageSrc(img.imageUrl)), 0)}
                        >
                          <img
                            src={getImageSrc(detailDevice.images[0].imageUrl)}
                            alt={detailDevice.name}
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/10">
                            <Eye className="h-6 w-6 text-white opacity-0 drop-shadow-lg transition-opacity group-hover:opacity-100" />
                          </div>
                        </button>
                        {detailDevice.images.length > 1 && (
                          <div className="flex gap-2 overflow-x-auto border-t p-3" style={{ borderColor: '#e2ede9' }}>
                            {detailDevice.images.map((img, i) => (
                              <button
                                key={img.id}
                                className="h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 transition-all"
                                style={{ borderColor: i === 0 ? '#1DB87A' : '#e2ede9' }}
                                onClick={() => openGallery(detailDevice.images.map((x) => getImageSrc(x.imageUrl)), i)}
                              >
                                <img src={getImageSrc(img.imageUrl)} alt="" className="h-full w-full object-cover" />
                              </button>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <div
                        className="flex flex-col items-center justify-center"
                        style={{ aspectRatio: '4/3', background: '#f0f7f4' }}
                      >
                        <ImageIcon className="h-10 w-10" style={{ color: '#b8d4ca' }} />
                        <p className="mt-2 text-xs" style={{ color: '#9eb5ae' }}>Chưa có hình ảnh</p>
                      </div>
                    )}
                  </div>

                  {/* Key metrics */}
                  <div className="flex-1 space-y-3 p-4">
                    <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#e2ede9' }}>
                      {[
                        {
                          label: 'Tình trạng',
                          value: (
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_CONFIG[detailDevice.status].badge}`}>
                              {STATUS_CONFIG[detailDevice.status].label}
                            </span>
                          ),
                        },
                        { label: 'Serial', value: detailDevice.serialNumber ?? '—' },
                        { label: 'Ngày mua', value: formatDate(detailDevice.purchaseDate) },
                        { label: 'Giá mua', value: formatCurrency(detailDevice.purchasePrice) },
                        {
                          label: 'Bảo hành',
                          value: detailDevice.warrantyUntil
                            ? isWarrantyActive(detailDevice.warrantyUntil)
                              ? <span className="font-semibold text-emerald-600">Còn đến {formatDate(detailDevice.warrantyUntil)}</span>
                              : <span style={{ color: '#9eb5ae' }}>Hết {formatDate(detailDevice.warrantyUntil)}</span>
                            : <span style={{ color: '#9eb5ae' }}>Không có</span>,
                        },
                      ].map((item, idx, arr) => (
                        <div
                          key={item.label}
                          className={`flex items-center justify-between gap-3 px-4 py-2.5 ${idx < arr.length - 1 ? 'border-b' : ''}`}
                          style={{ borderColor: '#f0f7f4' }}
                        >
                          <span className="shrink-0 text-xs" style={{ color: '#8ba89f' }}>{item.label}</span>
                          <span className="text-right text-xs font-semibold" style={{ color: '#203430' }}>{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Note */}
                    {detailDevice.note && (
                      <div className="rounded-xl border bg-white px-4 py-3" style={{ borderColor: '#e2ede9' }}>
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Ghi chú</p>
                        <p className="text-xs leading-relaxed" style={{ color: '#48635b' }}>{detailDevice.note}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* RIGHT MAIN */}
                <div className="flex flex-1 flex-col overflow-hidden bg-[#f5faf8]">
                  <Tabs value={detailTab} onValueChange={setDetailTab} className="flex flex-1 flex-col overflow-hidden">

                    {/* Tab bar */}
                    <div className="shrink-0 border-b bg-white px-6" style={{ borderColor: '#e2ede9' }}>
                      <TabsList className="h-auto gap-0 rounded-none bg-transparent p-0">
                        {[
                          { value: 'info', label: 'Thông tin', count: null },
                          { value: 'assignments', label: 'Lịch sử gán', count: detailDevice.assignments?.length || null },
                          { value: 'maintenance', label: 'Bảo trì', count: detailDevice.maintenanceLogs?.length || null },
                          ...(isAdminOrHr ? [{ value: 'audit', label: 'Audit', count: null }] : []),
                        ].map((tab) => (
                          <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="relative h-auto rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 text-sm font-medium shadow-none transition-colors data-[state=active]:border-[#1DB87A] data-[state=active]:text-[#0E474E] data-[state=inactive]:text-gray-400 data-[state=inactive]:hover:text-gray-600"
                          >
                            {tab.label}
                            {tab.count ? (
                              <span
                                className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold"
                                style={{
                                  background: tab.value === 'maintenance' ? '#fef9ec' : '#eef6f3',
                                  color: tab.value === 'maintenance' ? '#92400e' : '#2a7a5a',
                                }}
                              >
                                {tab.count}
                              </span>
                            ) : null}
                          </TabsTrigger>
                        ))}
                      </TabsList>
                    </div>

                    {/* Tab content area */}
                    <div className="flex-1 overflow-y-auto">

                      {/* ── Tab: Thông tin ── */}
                      <TabsContent value="info" className="mt-0 space-y-4 p-6">
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {[
                            { label: 'Mã thiết bị', value: detailDevice.code },
                            { label: 'Loại', value: DEVICE_TYPE_CONFIG[detailDevice.type]?.label },
                            { label: 'Hãng', value: detailDevice.brand },
                            { label: 'Model', value: detailDevice.model },
                            { label: 'Serial Number', value: detailDevice.serialNumber },
                            { label: 'Vị trí lưu trữ', value: detailDevice.location },
                          ].map((item) => (
                            <div
                              key={item.label}
                              className="rounded-xl border bg-white px-4 py-3"
                              style={{ borderColor: '#e2ede9' }}
                            >
                              <p className="text-[11px] font-medium uppercase tracking-wider" style={{ color: '#9eb5ae' }}>
                                {item.label}
                              </p>
                              <p className="mt-1 text-sm font-semibold" style={{ color: item.value ? '#203430' : '#c4d6d0' }}>
                                {item.value ?? '—'}
                              </p>
                            </div>
                          ))}
                        </div>

                        {detailDevice.specs.length > 0 && (
                          <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#e2ede9' }}>
                            <div className="border-b px-5 py-3" style={{ borderColor: '#f0f7f4', background: '#f8faf9' }}>
                              <h4 className="text-sm font-semibold" style={{ color: '#203430' }}>Thông số kỹ thuật</h4>
                            </div>
                            {detailDevice.specs.map((s, i) => (
                              <div
                                key={s.specKey}
                                className="flex items-center justify-between gap-4 px-5 py-3"
                                style={{ background: i % 2 === 0 ? '#fff' : '#f8faf9', borderTop: i > 0 ? '1px solid #f0f7f4' : 'none' }}
                              >
                                <span className="text-sm" style={{ color: '#6b7f78' }}>{s.specKey}</span>
                                <span className="text-right text-sm font-semibold" style={{ color: '#203430' }}>{s.specValue}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* ── Tab: Lịch sử gán ── */}
                      <TabsContent value="assignments" className="mt-0 p-6">
                        {!detailDevice.assignments?.length ? (
                          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center" style={{ borderColor: '#d6e5df' }}>
                            <UserMinus className="mb-3 h-8 w-8" style={{ color: '#c4d6d0' }} />
                            <p className="text-sm font-medium" style={{ color: '#9eb5ae' }}>Chưa có lịch sử gán</p>
                            <p className="mt-1 text-xs" style={{ color: '#b8d4ca' }}>Thiết bị chưa từng được phân bổ cho ai</p>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="absolute bottom-4 left-[19px] top-4 w-0.5" style={{ background: '#e2ede9' }} />
                            {detailDevice.assignments.map((a) => (
                              <div key={a.id} className="relative mb-4 flex gap-4 last:mb-0">
                                <div
                                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                                  style={{ borderColor: a.status === 'ACTIVE' ? '#1DB87A' : '#d6e5df' }}
                                >
                                  {a.status === 'ACTIVE'
                                    ? <UserPlus className="h-4 w-4" style={{ color: '#1DB87A' }} />
                                    : <UserMinus className="h-4 w-4" style={{ color: '#9eb5ae' }} />
                                  }
                                </div>
                                <div className="flex-1 rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold" style={{ color: '#203430' }}>{a.user.fullName}</p>
                                      <p className="text-xs" style={{ color: '#8ba89f' }}>
                                        {a.user.department ?? 'Chưa có phòng ban'}
                                        {a.user.employeeCode ? ` · ${a.user.employeeCode}` : ''}
                                      </p>
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${a.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                                      {a.status === 'ACTIVE' ? 'Đang dùng' : 'Đã trả'}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                    <div className="rounded-lg px-3 py-2" style={{ background: '#f8faf9' }}>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Gán thiết bị</p>
                                      <p className="mt-0.5 text-xs font-semibold" style={{ color: '#203430' }}>{formatDate(a.assignedAt)}</p>
                                      {a.assignedBy?.fullName && (
                                        <p className="text-[10px]" style={{ color: '#8ba89f' }}>bởi {a.assignedBy.fullName}</p>
                                      )}
                                    </div>
                                    <div className="rounded-lg px-3 py-2" style={{ background: '#f8faf9' }}>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Thu hồi</p>
                                      <p className="mt-0.5 text-xs font-semibold" style={{ color: a.returnedAt ? '#203430' : '#9eb5ae' }}>
                                        {a.returnedAt ? formatDate(a.returnedAt) : 'Chưa trả'}
                                      </p>
                                      {a.returnedAt && a.returnedBy?.fullName && (
                                        <p className="text-[10px]" style={{ color: '#8ba89f' }}>bởi {a.returnedBy.fullName}</p>
                                      )}
                                    </div>
                                  </div>
                                  {a.note && (
                                    <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#f8faf9', color: '#48635b' }}>
                                      {a.note}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* ── Tab: Bảo trì ── */}
                      <TabsContent value="maintenance" className="mt-0 p-6">
                        {!detailDevice.maintenanceLogs?.length ? (
                          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center" style={{ borderColor: '#d6e5df' }}>
                            <Wrench className="mb-3 h-8 w-8" style={{ color: '#c4d6d0' }} />
                            <p className="text-sm font-medium" style={{ color: '#9eb5ae' }}>Chưa có lịch sử bảo trì</p>
                            <p className="mt-1 text-xs" style={{ color: '#b8d4ca' }}>Ghi nhận bảo trì sẽ hiển thị ở đây</p>
                          </div>
                        ) : (
                          <div className="relative">
                            <div className="absolute bottom-4 left-[19px] top-4 w-0.5" style={{ background: '#e2ede9' }} />
                            {detailDevice.maintenanceLogs.map((m) => (
                              <div key={m.id} className="relative mb-4 flex gap-4 last:mb-0">
                                <div
                                  className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                                  style={{ borderColor: m.status === 'OPEN' ? '#fcd34d' : '#6ee7b7' }}
                                >
                                  <Wrench className="h-4 w-4" style={{ color: m.status === 'OPEN' ? '#d97706' : '#059669' }} />
                                </div>
                                <div className="flex-1 rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold" style={{ color: '#203430' }}>{m.issue}</p>
                                      {m.reportedBy?.fullName && (
                                        <p className="text-xs" style={{ color: '#8ba89f' }}>Ghi nhận bởi {m.reportedBy.fullName}</p>
                                      )}
                                    </div>
                                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${m.status === 'OPEN' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                                      {m.status === 'OPEN' ? 'Đang xử lý' : 'Đã xong'}
                                    </span>
                                  </div>
                                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                                    <div className="rounded-lg px-3 py-2" style={{ background: '#f8faf9' }}>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Bắt đầu</p>
                                      <p className="mt-0.5 text-xs font-semibold" style={{ color: '#203430' }}>{formatDate(m.startDate)}</p>
                                    </div>
                                    <div className="rounded-lg px-3 py-2" style={{ background: '#f8faf9' }}>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Chi phí</p>
                                      <p className="mt-0.5 text-xs font-semibold" style={{ color: '#203430' }}>
                                        {m.cost ? formatCurrency(m.cost) : '—'}
                                      </p>
                                    </div>
                                    <div className="rounded-lg px-3 py-2" style={{ background: '#f8faf9' }}>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>Hoàn tất</p>
                                      <p className="mt-0.5 text-xs font-semibold" style={{ color: m.resolvedAt ? '#203430' : '#9eb5ae' }}>
                                        {m.resolvedAt ? formatDate(m.resolvedAt) : 'Đang xử lý'}
                                      </p>
                                    </div>
                                  </div>
                                  {m.resolution && (
                                    <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#f0fdf4', color: '#166534' }}>
                                      <span className="font-semibold">Kết quả:</span> {m.resolution}
                                    </div>
                                  )}
                                  {m.note && (
                                    <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#f8faf9', color: '#48635b' }}>
                                      {m.note}
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </TabsContent>

                      {/* ── Tab: Audit ── */}
                      {isAdminOrHr ? (
                        <TabsContent value="audit" className="mt-0 p-6">
                          {auditLoading ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#1DB87A] border-t-transparent" />
                              <p className="text-xs" style={{ color: '#9eb5ae' }}>Đang tải audit log...</p>
                            </div>
                          ) : !auditLogs.length ? (
                            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center" style={{ borderColor: '#d6e5df' }}>
                              <ShieldCheck className="mb-3 h-8 w-8" style={{ color: '#c4d6d0' }} />
                              <p className="text-sm font-medium" style={{ color: '#9eb5ae' }}>Chưa có audit log</p>
                            </div>
                          ) : (
                            <div className="relative">
                              <div className="absolute bottom-4 left-[19px] top-4 w-0.5" style={{ background: '#e2ede9' }} />
                              {auditLogs.map((log) => (
                                <div key={log.id} className="relative mb-4 flex gap-4 last:mb-0">
                                  <div
                                    className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-white"
                                    style={{ borderColor: '#d6e5df' }}
                                  >
                                    <ShieldCheck className="h-4 w-4" style={{ color: '#9eb5ae' }} />
                                  </div>
                                  <div className="flex-1 rounded-xl border bg-white p-4" style={{ borderColor: '#e2ede9' }}>
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-sm font-semibold" style={{ color: '#203430' }}>{log.action}</p>
                                        <p className="text-xs" style={{ color: '#8ba89f' }}>{log.actor.fullName}</p>
                                      </div>
                                      <span className="shrink-0 text-[11px]" style={{ color: '#9eb5ae' }}>{formatDate(log.createdAt)}</span>
                                    </div>
                                    {log.note && (
                                      <div className="mt-2 rounded-lg px-3 py-2 text-xs" style={{ background: '#f8faf9', color: '#48635b' }}>
                                        {log.note}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      ) : null}

                    </div>

                    {/* ── Người dùng hiện tại (below tabs) ── */}
                    <div className="shrink-0 border-t bg-white px-5 py-4" style={{ borderColor: '#e2ede9' }}>
                      <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider" style={{ color: '#9eb5ae' }}>
                        Người dùng hiện tại
                      </p>
                      {detailDevice.assignments?.[0]?.status === 'ACTIVE' ? (
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                              style={{ background: 'linear-gradient(135deg, #d4eae0, #b8d4c8)', color: '#0E474E' }}
                            >
                              {detailDevice.assignments[0].user.fullName.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold" style={{ color: '#203430' }}>
                                {detailDevice.assignments[0].user.fullName}
                              </p>
                              <p className="truncate text-xs" style={{ color: '#8ba89f' }}>
                                {detailDevice.assignments[0].user.department ?? 'Chưa có phòng ban'}
                                {detailDevice.assignments[0].user.employeeCode ? ` · ${detailDevice.assignments[0].user.employeeCode}` : ''}
                              </p>
                            </div>
                          </div>
                          <div className="shrink-0 rounded-lg px-3 py-1.5 text-right" style={{ background: '#f0f7f4' }}>
                            <p className="text-[11px]" style={{ color: '#6b7f78' }}>
                              Gán từ {formatDate(detailDevice.assignments[0].assignedAt)}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: '#f0f7f4' }}>
                            <UserMinus className="h-4 w-4" style={{ color: '#c4d6d0' }} />
                          </div>
                          <p className="text-sm" style={{ color: '#9eb5ae' }}>Thiết bị chưa được gán</p>
                        </div>
                      )}
                    </div>

                  </Tabs>
                </div>

              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* ====== Create / Edit Dialog ====== */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) { form.images.filter((i) => i.file).forEach((i) => URL.revokeObjectURL(i.preview)); } setIsFormOpen(open); }}>
        <DialogContent className="max-h-[92vh] max-w-[48rem] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDevice ? 'Cập nhật thiết bị' : 'Thêm thiết bị mới'}</DialogTitle>
          </DialogHeader>

          {/* ── Basic info ── */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Mã thiết bị *</label>
              <Input placeholder="VD: LPT-0042" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} disabled={!!editingDevice} />
            </div>
            <div className="space-y-1 col-span-2">
              <label className="text-xs font-medium text-gray-700">Tên thiết bị *</label>
              <Input placeholder="VD: MacBook Pro 14" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Loại *</label>
              <Select value={form.type || 'none'} onValueChange={(v) => setForm((f) => ({ ...f, type: v === 'none' ? '' : (v as DeviceType) }))}>
                <SelectTrigger><SelectValue placeholder="Chọn loại" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Chọn loại</SelectItem>
                  {Object.entries(DEVICE_TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Hãng</label>
              <Input placeholder="VD: Apple" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Model</label>
              <Input placeholder="VD: MK183SA/A" value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Serial Number</label>
              <Input placeholder="VD: FVFXH1234567" value={form.serialNumber} onChange={(e) => setForm((f) => ({ ...f, serialNumber: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Ngày mua</label>
              <DatePicker value={form.purchaseDate} onChange={(v) => setForm((f) => ({ ...f, purchaseDate: v }))} placeholder="Chọn ngày mua" captionLayout="dropdown" fromYear={2000} toYear={new Date().getFullYear() + 1} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Giá mua (VNĐ)</label>
              <Input type="number" placeholder="VD: 45000000" value={form.purchasePrice} onChange={(e) => setForm((f) => ({ ...f, purchasePrice: e.target.value }))} />
            </div>
          </div>

          {/* ── Warranty ── */}
          <div className="rounded-lg border p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <Checkbox
                  id="hasWarranty"
                  checked={form.hasWarranty}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, hasWarranty: !!checked, warrantyUntil: checked ? f.warrantyUntil : '' }))
                  }
                />
                <label htmlFor="hasWarranty" className="flex items-center gap-2 cursor-pointer text-sm font-medium text-gray-700 select-none">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Thiết bị còn bảo hành
                </label>
              </div>
              {form.hasWarranty && (
                <div className="flex items-center gap-3 md:min-w-[320px] md:justify-end">
                  <label className="whitespace-nowrap text-xs font-medium text-gray-700">
                    Ngày hết bảo hành
                  </label>
                  <div className="w-full md:w-56">
                    <DatePicker value={form.warrantyUntil} onChange={(v) => setForm((f) => ({ ...f, warrantyUntil: v }))} placeholder="Chọn ngày hết bảo hành" captionLayout="dropdown" fromYear={new Date().getFullYear()} toYear={new Date().getFullYear() + 10} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Note ── */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-700">Ghi chú</label>
            <Textarea rows={2} value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>

          {/* ── Specs ── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">Thông số kỹ thuật</label>
              <Button type="button" variant="outline" size="sm" onClick={addSpec}>
                <Plus className="mr-1 h-3 w-3" />Thêm
              </Button>
            </div>
            {form.specs.map((s, i) => (
              <div key={i} className="flex gap-2">
                <Input placeholder="Key (VD: ram)" value={s.specKey} onChange={(e) => updateSpec(i, 'specKey', e.target.value)} className="flex-1" />
                <Input placeholder="Value (VD: 16GB)" value={s.specValue} onChange={(e) => updateSpec(i, 'specValue', e.target.value)} className="flex-1" />
                <Button type="button" variant="ghost" size="icon" onClick={() => removeSpec(i)} className="shrink-0"><X className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>

          {/* ── Images ── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700">
                Hình ảnh thiết bị
                {visibleImages.length > 0 && (
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{visibleImages.length} ảnh</span>
                )}
              </label>
              <div className="flex gap-2">
                {visibleImages.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openGallery(visibleImages.map((img) => img.preview))}
                  >
                    <Eye className="mr-1 h-3 w-3" />Xem tất cả
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-1 h-3 w-3" />Thêm ảnh
                </Button>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              className="hidden"
              onChange={(e) => handleImageFilesSelected(e.target.files)}
              onClick={(e) => { (e.target as HTMLInputElement).value = ''; }}
            />

            {/* Drop zone when empty */}
            {visibleImages.length === 0 && (
              <button
                type="button"
                className="w-full rounded-lg border-2 border-dashed border-gray-200 p-8 text-center text-sm text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-30" />
                <p>Nhấn để chọn ảnh hoặc kéo thả vào đây</p>
                <p className="text-xs mt-1">Hỗ trợ JPG, PNG, GIF, WEBP · Tối đa 5MB/ảnh</p>
              </button>
            )}

            {/* Image grid */}
            {visibleImages.length > 0 && (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                {form.images.map((img, i) => {
                  if (img.markedDelete) return null;
                  return (
                    <div key={i} className="group relative aspect-square">
                      <img
                        src={img.preview}
                        alt=""
                        className="h-full w-full rounded-lg object-cover border cursor-pointer"
                        onClick={() => openGallery(visibleImages.map((x) => x.preview), visibleImages.indexOf(img))}
                      />
                      {img.file && (
                        <span className="absolute bottom-1 left-1 rounded bg-blue-500 px-1 py-0.5 text-[9px] text-white font-medium">MỚI</span>
                      )}
                      <button
                        type="button"
                        className="absolute right-1 top-1 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                        onClick={() => markImageDelete(i)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
                {/* Add more button */}
                <button
                  type="button"
                  className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 hover:border-gray-300 hover:text-gray-500 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Plus className="h-4 w-4" />
                  <span className="text-[10px] mt-0.5">Thêm</span>
                </button>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsFormOpen(false)}>Hủy</Button>
            <Button onClick={handleFormSubmit} disabled={isMutating}>
              {isMutating ? 'Đang lưu...' : editingDevice ? 'Cập nhật' : 'Tạo thiết bị'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Gallery Dialog ====== */}
      <Dialog open={galleryOpen} onOpenChange={setGalleryOpen}>
        <DialogContent className="max-w-none w-screen h-screen max-h-screen border-0 p-0 rounded-none bg-transparent shadow-none [&>button]:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-0 bg-black/92 backdrop-blur-sm"
            onClick={() => setGalleryOpen(false)}
          />

          {/* Layout */}
          <div className="relative z-10 flex h-full flex-col">

            {/* Top bar */}
            <div className="flex shrink-0 items-center justify-between px-6 py-4">
              {/* Counter */}
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/80">
                  {galleryIndex + 1} / {galleryImages.length}
                </span>
              </div>
              {/* Close */}
              <button
                onClick={() => setGalleryOpen(false)}
                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Main image area */}
            <div className="relative flex flex-1 items-center justify-center px-16">
              {/* Prev button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={() => setGalleryIndex((i) => (i - 1 + galleryImages.length) % galleryImages.length)}
                  className="absolute left-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white hover:scale-110"
                >
                  <ChevronLeft className="h-6 w-6" />
                </button>
              )}

              {/* Image */}
              {galleryImages[galleryIndex] && (
                <img
                  key={galleryIndex}
                  src={galleryImages[galleryIndex]}
                  alt=""
                  className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
                  style={{ maxHeight: 'calc(100vh - 200px)' }}
                />
              )}

              {/* Next button */}
              {galleryImages.length > 1 && (
                <button
                  onClick={() => setGalleryIndex((i) => (i + 1) % galleryImages.length)}
                  className="absolute right-4 flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white/80 transition-all hover:bg-white/20 hover:text-white hover:scale-110"
                >
                  <ChevronRight className="h-6 w-6" />
                </button>
              )}
            </div>

            {/* Thumbnail strip */}
            {galleryImages.length > 1 && (
              <div className="shrink-0 py-4">
                <div className="flex justify-center gap-2 overflow-x-auto px-6">
                  {galleryImages.map((src, i) => (
                    <button
                      key={i}
                      onClick={() => setGalleryIndex(i)}
                      className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-lg transition-all"
                      style={{
                        outline: i === galleryIndex ? '2px solid #1DB87A' : '2px solid transparent',
                        outlineOffset: '2px',
                        opacity: i === galleryIndex ? 1 : 0.45,
                      }}
                    >
                      <img src={src} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard hint */}
            <div className="shrink-0 pb-4 text-center">
              <span className="text-[11px] text-white/25">← → để điều hướng · Esc để đóng</span>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* ====== Assign Dialog ====== */}
      <Dialog open={!!assignDevice} onOpenChange={(open) => !open && setAssignDevice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Gán thiết bị</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 -mt-2">Thiết bị: <strong>{assignDevice?.name}</strong> ({assignDevice?.code})</p>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Nhân viên nhận *</label>
              <Select value={assignUserId || 'none'} onValueChange={(v) => setAssignUserId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân viên" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Chọn nhân viên</SelectItem>
                  {userOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName ?? u.id}{u.employeeCode ? ` (${u.employeeCode})` : ''}{u.department ? ` - ${u.department}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Ghi chú</label>
              <Textarea rows={2} value={assignNote} onChange={(e) => setAssignNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDevice(null)}>Hủy</Button>
            <Button onClick={handleAssign} disabled={isMutating}>{isMutating ? 'Đang xử lý...' : 'Gán thiết bị'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Unassign Dialog ====== */}
      <Dialog open={!!unassignDevice} onOpenChange={(open) => !open && setUnassignDevice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Thu hồi thiết bị</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 -mt-2">Thiết bị: <strong>{unassignDevice?.name}</strong> ({unassignDevice?.code})</p>
          {unassignDevice && activeAssignment(unassignDevice) && (
            <p className="text-sm text-gray-500">Đang gán cho: <strong>{activeAssignment(unassignDevice)?.user.fullName}</strong></p>
          )}
          <div className="space-y-1 py-2">
            <label className="text-xs font-medium text-gray-700">Lý do thu hồi</label>
            <Textarea rows={2} value={unassignNote} onChange={(e) => setUnassignNote(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnassignDevice(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleUnassign} disabled={isMutating}>{isMutating ? 'Đang xử lý...' : 'Thu hồi'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Transfer Dialog ====== */}
      <Dialog open={!!transferDevice} onOpenChange={(open) => !open && setTransferDevice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Chuyển giao thiết bị</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 -mt-2">Thiết bị: <strong>{transferDevice?.name}</strong> ({transferDevice?.code})</p>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Nhân viên nhận *</label>
              <Select value={transferUserId || 'none'} onValueChange={(v) => setTransferUserId(v === 'none' ? '' : v)}>
                <SelectTrigger><SelectValue placeholder="Chọn nhân viên nhận" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" disabled>Chọn nhân viên</SelectItem>
                  {userOptions.map((u) => <SelectItem key={u.id} value={u.id}>{u.fullName ?? u.id}{u.employeeCode ? ` (${u.employeeCode})` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Ghi chú</label>
              <Textarea rows={2} value={transferNote} onChange={(e) => setTransferNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransferDevice(null)}>Hủy</Button>
            <Button onClick={handleTransfer} disabled={isMutating}>{isMutating ? 'Đang xử lý...' : 'Chuyển giao'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Maintenance Dialog ====== */}
      <Dialog open={!!maintenanceDevice} onOpenChange={(open) => !open && setMaintenanceDevice(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Ghi nhận bảo trì</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-500 -mt-2">Thiết bị: <strong>{maintenanceDevice?.name}</strong> ({maintenanceDevice?.code})</p>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Mô tả sự cố *</label>
              <Textarea rows={3} placeholder="Mô tả chi tiết sự cố..." value={maintenanceIssue} onChange={(e) => setMaintenanceIssue(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Chi phí dự kiến (VNĐ)</label>
              <Input type="number" placeholder="0" value={maintenanceCost} onChange={(e) => setMaintenanceCost(e.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-gray-700">Ghi chú thêm</label>
              <Textarea rows={2} value={maintenanceNote} onChange={(e) => setMaintenanceNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMaintenanceDevice(null)}>Hủy</Button>
            <Button onClick={handleMaintenance} disabled={isMutating}>{isMutating ? 'Đang lưu...' : 'Ghi nhận'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== Delete Confirm ====== */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Xác nhận xóa thiết bị</DialogTitle></DialogHeader>
          <p className="text-sm text-gray-600">
            Bạn có chắc muốn xóa thiết bị <strong>{deleteTarget?.name}</strong> ({deleteTarget?.code})? Hành động này không thể hoàn tác.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Hủy</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isMutating}>{isMutating ? 'Đang xóa...' : 'Xóa'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
