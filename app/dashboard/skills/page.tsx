'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, X, Plus, Settings, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiClient, apiRequest } from '@/lib/api-client';

// ── Types ──────────────────────────────────────────────────────
interface SkillLevel {
  id: string;
  level: number;
  name: string;
  description?: string | null;
}
interface SkillCategory {
  id: string;
  name: string;
  skills: Skill[];
}
interface Skill {
  id: string;
  name: string;
  categoryId: string;
  category: { id: string; name: string };
}
interface UserSkill {
  id: string;
  skillId: string;
  levelId: string;
  skill: { id: string; name: string; category: { id: string; name: string } };
  level: { id: string; level: number; name: string };
}
interface UserRow {
  id: string;
  fullName: string;
  username: string;
  email: string;
  department?: string | null;
  position?: string | null;
  yoe?: number | null;
  otaRanking?: string | null;
  userSkills: UserSkill[];
}
interface Meta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const OTA_RANKINGS = [
  'Level 1 – Fresher/Junior',
  'Level 2 – Engineer',
  'Level 3 – Senior',
  'Level 4 – Tech Lead',
  'Level 5 – Architect',
];

const OTA_DESCRIPTIONS: Record<string, string> = {
  'Level 1 – Fresher/Junior': 'Mới ra trường, cần kèm cặp sát sao.',
  'Level 2 – Engineer': 'Làm được việc độc lập, đảm bảo tiến độ.',
  'Level 3 – Senior': 'Làm tốt, thiết kế module, review code.',
  'Level 4 – Tech Lead': 'Dẫn dắt kỹ thuật cả team.',
  'Level 5 – Architect': 'Thiết kế cấu trúc hệ thống lớn cho công ty.',
};

// ── Skill Badge ────────────────────────────────────────────────
function SkillBadge({ us }: { us: UserSkill }) {
  const colors = [
    { bg: '#e8f5ee', text: '#1DB87A' },
    { bg: '#fff3cd', text: '#d97706' },
    { bg: '#fde8e8', text: '#dc2626' },
  ];
  const c = colors[Math.min(us.level.level - 1, 2)];
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: c.bg, color: c.text }}
      title={`${us.skill.category.name} · Level ${us.level.level}: ${us.level.name}`}
    >
      {us.skill.name}
      <span className="opacity-60">L{us.level.level}</span>
    </span>
  );
}

// ── Edit Skills Modal ──────────────────────────────────────────
function EditSkillsModal({
  user,
  categories,
  levels,
  onClose,
  onSaved,
}: {
  user: UserRow;
  categories: SkillCategory[];
  levels: SkillLevel[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [skillMap, setSkillMap] = useState<Record<string, string>>(() => {
    const m: Record<string, string> = {};
    user.userSkills.forEach((us) => {
      m[us.skillId] = us.levelId;
    });
    return m;
  });
  const [yoe, setYoe] = useState(user.yoe?.toString() ?? '');
  const [otaRanking, setOtaRanking] = useState(user.otaRanking ?? '');
  const [saving, setSaving] = useState(false);

  const toggleSkill = (skillId: string) => {
    setSkillMap((prev) => {
      const next = { ...prev };
      if (next[skillId]) {
        delete next[skillId];
      } else {
        next[skillId] = levels[0]?.id ?? '';
      }
      return next;
    });
  };

  const setLevel = (skillId: string, levelId: string) => {
    setSkillMap((prev) => ({ ...prev, [skillId]: levelId }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const skills = Object.entries(skillMap).map(([skillId, levelId]) => ({
        skillId: Number(skillId),
        levelId: Number(levelId),
      }));
      await apiRequest({ url: `/api/user-skills/user/${user.id}/bulk`, method: 'PUT', data: { skills } });
      await apiClient.patch(`/api/user-skills/user/${user.id}/profile`, {
        yoe: yoe ? Number(yoe) : null,
        otaRanking: otaRanking || null,
      });
      toast.success('Đã lưu thông tin kỹ năng');
      onSaved();
      onClose();
    } catch {
      toast.error('Lỗi khi lưu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b"
          style={{ borderColor: '#e2ede9' }}
        >
          <div>
            <p className="font-bold text-base" style={{ color: '#203430' }}>
              {user.fullName}
            </p>
            <p className="text-xs" style={{ color: '#6b7f78' }}>
              {[user.department, user.position].filter(Boolean).join(' · ')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {/* YoE + OTA Ranking */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b7f78' }}>
                Số năm kinh nghiệm (YoE)
              </label>
              <input
                type="number"
                min={0}
                max={50}
                value={yoe}
                onChange={(e) => setYoe(e.target.value)}
                placeholder="VD: 3"
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
                style={{ borderColor: '#e2ede9' }}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: '#6b7f78' }}>
                OTA Ranking
              </label>
              <select
                value={otaRanking}
                onChange={(e) => setOtaRanking(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
                style={{ borderColor: '#e2ede9' }}
              >
                <option value="">-- Chọn ranking --</option>
                {OTA_RANKINGS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              {otaRanking && OTA_DESCRIPTIONS[otaRanking] && (
                <p className="text-xs mt-1 px-1" style={{ color: '#6b7f78' }}>
                  {OTA_DESCRIPTIONS[otaRanking]}
                </p>
              )}
            </div>
          </div>

          {/* Skills by category */}
          {categories.map((cat) => (
            <div key={cat.id}>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: '#6b7f78' }}
              >
                {cat.name}
              </p>
              {cat.skills.length === 0 ? (
                <p className="text-xs italic px-2" style={{ color: '#b0bfba' }}>
                  Chưa có kỹ năng — thêm trong Cài đặt
                </p>
              ) : (
                <div className="space-y-1">
                  {cat.skills.map((skill) => {
                    const selected = !!skillMap[skill.id];
                    const currentLevelId = skillMap[skill.id];
                    return (
                      <div
                        key={skill.id}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
                        style={{
                          borderColor: selected ? '#1DB87A' : '#e2ede9',
                          background: selected ? '#f8fdfb' : '#fff',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSkill(skill.id)}
                          className="w-4 h-4 rounded accent-[#1DB87A] cursor-pointer"
                        />
                        <span className="flex-1 text-sm" style={{ color: '#203430' }}>
                          {skill.name}
                        </span>
                        {selected && (
                          <select
                            value={currentLevelId}
                            onChange={(e) => setLevel(skill.id, e.target.value)}
                            className="border rounded-md px-2 py-1 text-xs outline-none"
                            style={{ borderColor: '#e2ede9' }}
                          >
                            {levels.map((lv) => (
                              <option key={lv.id} value={lv.id}>
                                L{lv.level} – {lv.name}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-4 border-t"
          style={{ borderColor: '#e2ede9' }}
        >
          <p className="text-xs" style={{ color: '#6b7f78' }}>
            {Object.keys(skillMap).length} kỹ năng được chọn
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ color: '#6b7f78', background: '#f0f9f5' }}
            >
              Huỷ
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 rounded-lg text-sm font-medium text-white flex items-center gap-2 disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              Lưu thay đổi
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SkillManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSkillId, setFilterSkillId] = useState('');
  const [filterLevelId, setFilterLevelId] = useState('');
  const [page, setPage] = useState(1);

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [levels, setLevels] = useState<SkillLevel[]>([]);

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load master data once
  useEffect(() => {
    Promise.all([
      apiClient.get<SkillCategory[]>('/api/skills/categories'),
      apiClient.get<Skill[]>('/api/skills'),
      apiClient.get<SkillLevel[]>('/api/skills/levels'),
    ])
      .then(([cats, skills, lvls]) => {
        setCategories(cats.data);
        setAllSkills(skills.data);
        setLevels(lvls.data);
      })
      .catch(() => toast.error('Không tải được dữ liệu cài đặt'));
  }, []);

  const loadUsers = useCallback(
    async (params: {
      page: number;
      search: string;
      categoryId: string;
      skillId: string;
      levelId: string;
    }) => {
      setLoading(true);
      try {
        const q = new URLSearchParams({ page: params.page.toString(), limit: '20' });
        if (params.search) q.set('search', params.search);
        if (params.categoryId) q.set('categoryId', params.categoryId);
        if (params.skillId) q.set('skillId', params.skillId);
        if (params.levelId) q.set('levelId', params.levelId);

        const result = await apiClient.get<UserRow[]>(`/api/user-skills?${q}`);
        setUsers(result.data);
        if (result.meta) {
          setMeta({
            total: result.meta.total ?? 0,
            page: result.meta.page ?? 1,
            limit: result.meta.limit ?? 20,
            totalPages: result.meta.totalPages ?? 1,
          });
        }
      } catch {
        toast.error('Không tải được danh sách');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      loadUsers({
        page,
        search,
        categoryId: filterCategoryId,
        skillId: filterSkillId,
        levelId: filterLevelId,
      });
    }, 300);
  }, [page, search, filterCategoryId, filterSkillId, filterLevelId, loadUsers]);

  const filteredSkills = filterCategoryId
    ? allSkills.filter((s) => s.categoryId === filterCategoryId)
    : allSkills;

  const hasFilter = !!(search || filterCategoryId || filterSkillId || filterLevelId);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
            Quản lý Kỹ Năng
          </h1>
          <p className="text-sm mt-1" style={{ color: '#6b7f78' }}>
            {meta.total} thành viên
          </p>
        </div>
        <Link
          href="/dashboard/skills/settings"
          className="flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium hover:bg-[#f0f9f5] transition-colors"
          style={{ borderColor: '#e2ede9', color: '#203430' }}
        >
          <Settings size={15} />
          Cài đặt
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Tìm theo tên, email..."
            className="w-full pl-9 pr-3 py-2 border rounded-xl text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
            style={{ borderColor: '#e2ede9' }}
          />
        </div>

        <select
          value={filterCategoryId}
          onChange={(e) => {
            setFilterCategoryId(e.target.value);
            setFilterSkillId('');
            setPage(1);
          }}
          className="border rounded-xl px-3 py-2 text-sm outline-none min-w-40 bg-white"
          style={{ borderColor: '#e2ede9' }}
        >
          <option value="">Tất cả nhóm</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        <select
          value={filterSkillId}
          onChange={(e) => {
            setFilterSkillId(e.target.value);
            setPage(1);
          }}
          className="border rounded-xl px-3 py-2 text-sm outline-none min-w-40 bg-white"
          style={{ borderColor: '#e2ede9' }}
        >
          <option value="">Tất cả kỹ năng</option>
          {filteredSkills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={filterLevelId}
          onChange={(e) => {
            setFilterLevelId(e.target.value);
            setPage(1);
          }}
          className="border rounded-xl px-3 py-2 text-sm outline-none min-w-36 bg-white"
          style={{ borderColor: '#e2ede9' }}
        >
          <option value="">Tất cả cấp độ</option>
          {levels.map((l) => (
            <option key={l.id} value={l.id}>
              Level {l.level} – {l.name}
            </option>
          ))}
        </select>

        {hasFilter && (
          <button
            onClick={() => {
              setSearch('');
              setFilterCategoryId('');
              setFilterSkillId('');
              setFilterLevelId('');
              setPage(1);
            }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm"
            style={{ borderColor: '#e2ede9', color: '#6b7f78' }}
          >
            <X size={14} /> Xoá filter
          </button>
        )}
      </div>

      {/* Table */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e2ede9' }}>
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin" style={{ color: '#1DB87A' }} />
          </div>
        ) : users.length === 0 ? (
          <div className="text-center py-16 text-sm" style={{ color: '#6b7f78' }}>
            {hasFilter ? 'Không có thành viên nào khớp với filter.' : 'Chưa có dữ liệu.'}
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ background: '#f8fdfb', borderBottom: '1px solid #e2ede9' }}>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#6b7f78' }}
                >
                  Thành viên
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#6b7f78', width: 160 }}
                >
                  YoE / Ranking
                </th>
                <th
                  className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wider"
                  style={{ color: '#6b7f78' }}
                >
                  Kỹ năng
                </th>
                <th className="px-4 py-3 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {users.map((user, idx) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom: idx < users.length - 1 ? '1px solid #f0f4f2' : 'none',
                  }}
                  className="hover:bg-[#fafffe] transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs font-bold"
                        style={{
                          background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)',
                        }}
                      >
                        {(user.fullName || user.username).charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: '#203430' }}>
                          {user.fullName}
                        </p>
                        <p className="text-xs" style={{ color: '#6b7f78' }}>
                          {[user.department, user.position].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {user.yoe != null ? (
                      <p className="text-sm font-medium" style={{ color: '#203430' }}>
                        {user.yoe} năm
                      </p>
                    ) : null}
                    {user.otaRanking ? (
                      <p className="text-xs mt-0.5" style={{ color: '#6b7f78' }}>
                        {user.otaRanking}
                      </p>
                    ) : null}
                    {user.yoe == null && !user.otaRanking && (
                      <p className="text-xs" style={{ color: '#b0bfba' }}>
                        Chưa cập nhật
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {user.userSkills.length === 0 ? (
                      <p className="text-xs" style={{ color: '#b0bfba' }}>
                        Chưa có kỹ năng
                      </p>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {user.userSkills.slice(0, 6).map((us) => (
                          <SkillBadge key={us.id} us={us} />
                        ))}
                        {user.userSkills.length > 6 && (
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: '#f0f4f2', color: '#6b7f78' }}
                          >
                            +{user.userSkills.length - 6}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditingUser(user)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-white hover:opacity-80 transition-opacity"
                      style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
                    >
                      Sửa
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm" style={{ color: '#6b7f78' }}>
            Trang {meta.page} / {meta.totalPages} · {meta.total} thành viên
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
              style={{ borderColor: '#e2ede9' }}
            >
              Trước
            </button>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1.5 rounded-lg border text-sm disabled:opacity-40 hover:bg-gray-50"
              style={{ borderColor: '#e2ede9' }}
            >
              Tiếp
            </button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingUser && (
        <EditSkillsModal
          user={editingUser}
          categories={categories}
          levels={levels}
          onClose={() => setEditingUser(null)}
          onSaved={() =>
            loadUsers({
              page,
              search,
              categoryId: filterCategoryId,
              skillId: filterSkillId,
              levelId: filterLevelId,
            })
          }
        />
      )}
    </div>
  );
}
