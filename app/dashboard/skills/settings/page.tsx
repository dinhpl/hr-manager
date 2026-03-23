'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiClient } from '@/lib/api-client';

interface SkillLevel {
  id: string;
  level: number;
  name: string;
  description?: string | null;
}

interface Skill {
  id: string;
  name: string;
  categoryId: string;
  sortOrder: number;
}

interface SkillCategory {
  id: string;
  name: string;
  sortOrder: number;
  skills: Skill[];
  _count: { skills: number };
}

// ── Inline Input ──────────────────────────────────────────────
function InlineInput({
  value,
  onSave,
  onCancel,
  placeholder = 'Nhập tên...',
}: {
  value?: string;
  onSave: (v: string) => void;
  onCancel: () => void;
  placeholder?: string;
}) {
  const [val, setVal] = useState(value ?? '');
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSave(val.trim());
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={placeholder}
        className="flex-1 border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
        style={{ borderColor: '#e2ede9' }}
      />
      <button
        onClick={() => onSave(val.trim())}
        className="px-3 py-1.5 rounded-md text-sm font-medium text-white"
        style={{ background: '#1DB87A' }}
      >
        Lưu
      </button>
      <button
        onClick={onCancel}
        className="px-3 py-1.5 rounded-md text-sm font-medium"
        style={{ color: '#6b7f78', background: '#f0f9f5' }}
      >
        Huỷ
      </button>
    </div>
  );
}

// ── Categories & Skills Tab ───────────────────────────────────
function CategoriesTab() {
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingCatId, setEditingCatId] = useState<string | null>(null);
  const [addingCat, setAddingCat] = useState(false);
  const [addingSkillInCat, setAddingSkillInCat] = useState<string | null>(null);
  const [editingSkillId, setEditingSkillId] = useState<string | null>(null);

  const loadCategories = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ data: SkillCategory[] }>('/api/skills/categories');
      setCategories(data.data);
    } catch {
      toast.error('Không tải được dữ liệu');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleAddCat = async (name: string) => {
    if (!name) return setAddingCat(false);
    try {
      await apiClient.post('/api/skills/categories', { name });
      toast.success('Đã tạo nhóm');
      setAddingCat(false);
      loadCategories();
    } catch {
      toast.error('Lỗi tạo nhóm (tên đã tồn tại?)');
    }
  };

  const handleUpdateCat = async (id: string, name: string) => {
    if (!name) return setEditingCatId(null);
    try {
      await apiClient.patch(`/api/skills/categories/${id}`, { name });
      toast.success('Đã cập nhật');
      setEditingCatId(null);
      loadCategories();
    } catch {
      toast.error('Lỗi cập nhật');
    }
  };

  const handleDeleteCat = async (id: string, skillCount: number) => {
    if (
      skillCount > 0 &&
      !confirm(`Nhóm này có ${skillCount} kỹ năng. Xoá sẽ xoá luôn tất cả. Tiếp tục?`)
    )
      return;
    try {
      await apiClient.delete(`/api/skills/categories/${id}`);
      toast.success('Đã xoá nhóm');
      loadCategories();
    } catch {
      toast.error('Lỗi xoá nhóm');
    }
  };

  const handleAddSkill = async (categoryId: string, name: string) => {
    if (!name) return setAddingSkillInCat(null);
    try {
      await apiClient.post('/api/skills', { name, categoryId: Number(categoryId) });
      toast.success('Đã thêm kỹ năng');
      setAddingSkillInCat(null);
      loadCategories();
    } catch {
      toast.error('Tên kỹ năng đã tồn tại hoặc lỗi');
    }
  };

  const handleUpdateSkill = async (id: string, name: string) => {
    if (!name) return setEditingSkillId(null);
    try {
      await apiClient.patch(`/api/skills/${id}`, { name });
      toast.success('Đã cập nhật');
      setEditingSkillId(null);
      loadCategories();
    } catch {
      toast.error('Lỗi cập nhật');
    }
  };

  const handleDeleteSkill = async (id: string) => {
    if (!confirm('Xoá kỹ năng này?')) return;
    try {
      await apiClient.delete(`/api/skills/${id}`);
      toast.success('Đã xoá');
      loadCategories();
    } catch {
      toast.error('Lỗi xoá');
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" style={{ color: '#1DB87A' }} />
      </div>
    );

  return (
    <div className="space-y-2">
      {categories.map((cat) => (
        <div
          key={cat.id}
          className="rounded-xl border overflow-hidden"
          style={{ borderColor: '#e2ede9' }}
        >
          {/* Category header */}
          <div className="flex items-center gap-2 px-4 py-3" style={{ background: '#f8fdfb' }}>
            <button onClick={() => toggleExpand(cat.id)} className="text-muted-foreground">
              {expanded.has(cat.id) ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {editingCatId === cat.id ? (
              <div className="flex-1">
                <InlineInput
                  value={cat.name}
                  onSave={(v) => handleUpdateCat(cat.id, v)}
                  onCancel={() => setEditingCatId(null)}
                />
              </div>
            ) : (
              <>
                <span className="flex-1 font-semibold text-sm" style={{ color: '#203430' }}>
                  {cat.name}
                </span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: '#e8f5ee', color: '#1DB87A' }}
                >
                  {cat._count.skills} kỹ năng
                </span>
                <button
                  onClick={() => {
                    setExpanded((p) => new Set([...p, cat.id]));
                    setEditingCatId(cat.id);
                  }}
                  className="p-1 rounded hover:bg-white"
                  style={{ color: '#6b7f78' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDeleteCat(cat.id, cat._count.skills)}
                  className="p-1 rounded hover:bg-red-50"
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </div>

          {/* Skills list */}
          {expanded.has(cat.id) && (
            <div
              className="px-4 py-2 space-y-1 border-t"
              style={{ borderColor: '#f0f4f2' }}
            >
              {cat.skills.map((skill) => (
                <div
                  key={skill.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-gray-50 group"
                >
                  {editingSkillId === skill.id ? (
                    <div className="flex-1">
                      <InlineInput
                        value={skill.name}
                        onSave={(v) => handleUpdateSkill(skill.id, v)}
                        onCancel={() => setEditingSkillId(null)}
                      />
                    </div>
                  ) : (
                    <>
                      <span className="flex-1 text-sm" style={{ color: '#374151' }}>
                        {skill.name}
                      </span>
                      <div className="hidden group-hover:flex items-center gap-1">
                        <button
                          onClick={() => setEditingSkillId(skill.id)}
                          className="p-1 rounded hover:bg-white"
                          style={{ color: '#6b7f78' }}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteSkill(skill.id)}
                          className="p-1 rounded hover:bg-red-50"
                          style={{ color: '#dc2626' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
              {addingSkillInCat === cat.id ? (
                <div className="py-1 px-2">
                  <InlineInput
                    placeholder="Tên kỹ năng mới..."
                    onSave={(v) => handleAddSkill(cat.id, v)}
                    onCancel={() => setAddingSkillInCat(null)}
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingSkillInCat(cat.id)}
                  className="flex items-center gap-1.5 py-1 px-2 text-sm rounded-lg hover:bg-[#f0f9f5] transition-colors w-full"
                  style={{ color: '#1DB87A' }}
                >
                  <Plus size={14} /> Thêm kỹ năng
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add category */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: '#e2ede9' }}>
        <div className="px-4 py-3">
          {addingCat ? (
            <InlineInput
              placeholder="Tên nhóm mới..."
              onSave={handleAddCat}
              onCancel={() => setAddingCat(false)}
            />
          ) : (
            <button
              onClick={() => setAddingCat(true)}
              className="flex items-center gap-2 text-sm font-medium"
              style={{ color: '#1DB87A' }}
            >
              <Plus size={16} /> Thêm nhóm kỹ năng
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Levels Tab ────────────────────────────────────────────────
function LevelsTab() {
  const [levels, setLevels] = useState<SkillLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '' });
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState({ level: '', name: '', description: '' });

  const loadLevels = useCallback(async () => {
    try {
      const { data } = await apiClient.get<{ data: SkillLevel[] }>('/api/skills/levels');
      setLevels(data.data);
    } catch {
      toast.error('Không tải được cấp độ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLevels();
  }, [loadLevels]);

  const handleUpdate = async (id: string) => {
    if (!editForm.name.trim()) return;
    try {
      await apiClient.patch(`/api/skills/levels/${id}`, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
      });
      toast.success('Đã cập nhật');
      setEditingId(null);
      loadLevels();
    } catch {
      toast.error('Lỗi cập nhật');
    }
  };

  const handleAdd = async () => {
    if (!newForm.level || !newForm.name.trim()) return;
    try {
      await apiClient.post('/api/skills/levels', {
        level: Number(newForm.level),
        name: newForm.name.trim(),
        description: newForm.description.trim() || null,
      });
      toast.success('Đã thêm cấp độ');
      setAddingNew(false);
      setNewForm({ level: '', name: '', description: '' });
      loadLevels();
    } catch {
      toast.error('Số cấp độ đã tồn tại hoặc lỗi');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Xoá cấp độ này? Sẽ lỗi nếu đang được sử dụng.')) return;
    try {
      await apiClient.delete(`/api/skills/levels/${id}`);
      toast.success('Đã xoá');
      loadLevels();
    } catch {
      toast.error('Không thể xoá: đang được sử dụng');
    }
  };

  if (loading)
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="animate-spin" style={{ color: '#1DB87A' }} />
      </div>
    );

  return (
    <div className="space-y-3 max-w-2xl">
      {levels.map((lvl) => (
        <div key={lvl.id} className="rounded-xl border p-4" style={{ borderColor: '#e2ede9' }}>
          {editingId === lvl.id ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold w-16" style={{ color: '#203430' }}>
                  Level {lvl.level}
                </span>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Tên cấp độ"
                  className="flex-1 border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
                  style={{ borderColor: '#e2ede9' }}
                />
              </div>
              <input
                value={editForm.description}
                onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Mô tả (không bắt buộc)"
                className="w-full border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
                style={{ borderColor: '#e2ede9' }}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(lvl.id)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium text-white"
                  style={{ background: '#1DB87A' }}
                >
                  Lưu
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="px-3 py-1.5 rounded-md text-sm font-medium"
                  style={{ color: '#6b7f78', background: '#f0f9f5' }}
                >
                  Huỷ
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <div
                className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                style={{ background: 'linear-gradient(135deg, #1DB87A 0%, #0E474E 100%)' }}
              >
                {lvl.level}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm" style={{ color: '#203430' }}>
                  {lvl.name}
                </p>
                {lvl.description && (
                  <p className="text-xs mt-0.5" style={{ color: '#6b7f78' }}>
                    {lvl.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setEditingId(lvl.id);
                    setEditForm({ name: lvl.name, description: lvl.description ?? '' });
                  }}
                  className="p-1.5 rounded-lg hover:bg-[#f0f9f5]"
                  style={{ color: '#6b7f78' }}
                >
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(lvl.id)}
                  className="p-1.5 rounded-lg hover:bg-red-50"
                  style={{ color: '#dc2626' }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add new level */}
      {addingNew ? (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: '#e2ede9' }}>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={99}
              value={newForm.level}
              onChange={(e) => setNewForm((f) => ({ ...f, level: e.target.value }))}
              placeholder="Số (VD: 4)"
              className="w-20 border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
              style={{ borderColor: '#e2ede9' }}
            />
            <input
              value={newForm.name}
              onChange={(e) => setNewForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Tên cấp độ"
              className="flex-1 border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
              style={{ borderColor: '#e2ede9' }}
            />
          </div>
          <input
            value={newForm.description}
            onChange={(e) => setNewForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Mô tả (không bắt buộc)"
            className="w-full border rounded-md px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-[#1DB87A]/40"
            style={{ borderColor: '#e2ede9' }}
          />
          <div className="flex gap-2">
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 rounded-md text-sm font-medium text-white"
              style={{ background: '#1DB87A' }}
            >
              Thêm
            </button>
            <button
              onClick={() => {
                setAddingNew(false);
                setNewForm({ level: '', name: '', description: '' });
              }}
              className="px-3 py-1.5 rounded-md text-sm font-medium"
              style={{ color: '#6b7f78', background: '#f0f9f5' }}
            >
              Huỷ
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAddingNew(true)}
          className="flex items-center gap-2 text-sm font-medium py-2 px-3 rounded-xl border border-dashed w-full justify-center hover:bg-[#f0f9f5] transition-colors"
          style={{ borderColor: '#1DB87A', color: '#1DB87A' }}
        >
          <Plus size={16} /> Thêm cấp độ mới
        </button>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SkillSettingsPage() {
  const [tab, setTab] = useState<'categories' | 'levels'>('categories');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold" style={{ color: '#203430' }}>
          Cài đặt Kỹ Năng
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6b7f78' }}>
          Quản lý danh mục, kỹ năng và cấp độ
        </p>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 p-1 rounded-xl mb-6 w-fit"
        style={{ background: '#f0f9f5' }}
      >
        {(
          [
            { key: 'categories', label: 'Nhóm & Kỹ Năng' },
            { key: 'levels', label: 'Cấp Độ' },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={
              tab === t.key
                ? {
                    background: '#fff',
                    color: '#203430',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  }
                : { color: '#6b7f78' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'categories' ? <CategoriesTab /> : <LevelsTab />}
    </div>
  );
}
