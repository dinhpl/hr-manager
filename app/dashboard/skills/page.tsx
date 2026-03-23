'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Brain, Filter, Loader2, PencilLine, Search, Settings2, X } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient, apiRequest, getApiBaseUrl } from '@/lib/api-client';

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
  avatar?: string | null;
  department?: string | null;
  position?: string | null;
  yoe?: number | null;
  otaRanking?: string | null;
  userSkills: UserSkill[];
}

interface Meta {
  total: number;
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

function getUserInitials(user: Pick<UserRow, 'fullName' | 'username'>) {
  const source = user.fullName?.trim() || user.username?.trim() || 'NV';
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/assets')) return avatar;
  if (avatar.startsWith('/uploads')) return getApiBaseUrl() + avatar;
  return null;
}

function getLevelTone(level: number) {
  if (level >= 4) {
    return {
      background: '#e8f5ee',
      color: '#0e7a52',
      border: '#b8e6d1',
    };
  }

  if (level === 3) {
    return {
      background: '#eff6ff',
      color: '#2563eb',
      border: '#bfdbfe',
    };
  }

  if (level === 2) {
    return {
      background: '#fff7e8',
      color: '#b45309',
      border: '#fed7aa',
    };
  }

  return {
    background: '#f3f4f6',
    color: '#4b5563',
    border: '#d1d5db',
  };
}

function SkillBadge({ userSkill }: { userSkill: UserSkill }) {
  const tone = getLevelTone(userSkill.level.level);

  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium"
      style={{
        background: tone.background,
        color: tone.color,
        borderColor: tone.border,
      }}
      title={`${userSkill.skill.category.name} · Level ${userSkill.level.level}: ${userSkill.level.name}`}
    >
      <span className="max-w-[140px] truncate">{userSkill.skill.name}</span>
      <span className="opacity-70">L{userSkill.level.level}</span>
    </span>
  );
}

function MoreSkillsPopover({ userSkills }: { userSkills: UserSkill[] }) {
  const remainingSkills = userSkills.slice(6);
  const [open, setOpen] = useState(false);

  if (remainingSkills.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center rounded-full border border-border bg-background px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          onMouseEnter={() => setOpen(true)}
          onMouseLeave={() => setOpen(false)}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
        >
          +{remainingSkills.length} kỹ năng khác
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 space-y-3 p-3"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">Kỹ năng còn lại</p>
          <p className="text-xs text-muted-foreground">
            Danh sách kỹ năng không hiển thị trực tiếp trên dòng.
          </p>
        </div>
        <div className="flex max-h-64 flex-wrap gap-2 overflow-y-auto">
          {remainingSkills.map((userSkill) => (
            <SkillBadge key={userSkill.id} userSkill={userSkill} />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

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
    const next: Record<string, string> = {};
    user.userSkills.forEach((userSkill) => {
      next[userSkill.skillId] = userSkill.levelId;
    });
    return next;
  });
  const [yoe, setYoe] = useState(user.yoe?.toString() ?? '');
  const [otaRanking, setOtaRanking] = useState(user.otaRanking ?? '');
  const [skillSearch, setSkillSearch] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedCount = Object.keys(skillMap).length;
  const selectedSkills = useMemo(
    () =>
      categories.flatMap((category) =>
        category.skills
          .filter((skill) => skillMap[skill.id])
          .map((skill) => {
            const levelId = skillMap[skill.id];
            const level = levels.find((item) => item.id === levelId);

            return {
              id: skill.id,
              name: skill.name,
              categoryName: category.name,
              levelLabel: level ? `L${level.level} - ${level.name}` : 'Chưa chọn level',
            };
          }),
      ),
    [categories, levels, skillMap],
  );
  const selectedGroupCount = useMemo(
    () => new Set(selectedSkills.map((skill) => skill.categoryName)).size,
    [selectedSkills],
  );
  const filteredCategories = useMemo(() => {
    const query = skillSearch.trim().toLowerCase();

    if (!query) return categories;

    return categories
      .map((category) => ({
        ...category,
        skills: category.skills.filter((skill) => skill.name.toLowerCase().includes(query)),
      }))
      .filter((category) => category.skills.length > 0);
  }, [categories, skillSearch]);

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

      await apiRequest({
        url: `/api/user-skills/user/${user.id}/bulk`,
        method: 'PUT',
        data: { skills },
      });
      await apiClient.patch(`/api/user-skills/user/${user.id}/profile`, {
        yoe: yoe ? Number(yoe) : null,
        otaRanking: otaRanking || null,
      });

      toast.success('Đã lưu hồ sơ kỹ năng');
      onSaved();
      onClose();
    } catch {
      toast.error('Không thể lưu hồ sơ kỹ năng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[94vh] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden border-border p-0 sm:max-w-6xl">
        <DialogHeader className="border-b border-border bg-[linear-gradient(180deg,rgba(211,242,231,0.22),rgba(255,255,255,1))] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                {getAvatarUrl(user.avatar) ? (
                  <img
                    src={getAvatarUrl(user.avatar) || ''}
                    alt={user.fullName}
                    className="h-12 w-12 rounded-2xl object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1DB87A_0%,#0E474E_100%)] text-sm font-bold text-white">
                    {getUserInitials(user)}
                  </div>
                )}
                <div className="space-y-1">
                  <DialogTitle className="text-left text-xl text-foreground">
                    {user.fullName}
                  </DialogTitle>
                  <DialogDescription className="text-left text-sm text-muted-foreground">
                    {[user.department, user.position, user.email].filter(Boolean).join(' · ')}
                  </DialogDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">{selectedCount} kỹ năng</Badge>
                <Badge variant="outline">{categories.length} nhóm</Badge>
                {skillSearch ? <Badge variant="outline">Đang lọc: {skillSearch}</Badge> : null}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
          <div className="space-y-5">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
              <Card className="gap-4 border-border/80 shadow-none">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-base">Tóm tắt hồ sơ</CardTitle>
                  <CardDescription>
                    Thông tin nền giúp xác định level và phạm vi kỹ năng phù hợp.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-border bg-background px-3 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Kỹ năng
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">{selectedCount}</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background px-3 py-3">
                      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                        Nhóm
                      </p>
                      <p className="mt-1 text-lg font-semibold text-foreground">
                        {selectedGroupCount}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="yoe">Số năm kinh nghiệm</Label>
                      <Input
                        id="yoe"
                        type="number"
                        min={0}
                        max={50}
                        value={yoe}
                        onChange={(event) => setYoe(event.target.value)}
                        placeholder="VD: 3"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>OTA Ranking</Label>
                      <Select
                        value={otaRanking || '__none__'}
                        onValueChange={(value) => setOtaRanking(value === '__none__' ? '' : value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Chọn ranking" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">Chưa chọn ranking</SelectItem>
                          {OTA_RANKINGS.map((ranking) => (
                            <SelectItem key={ranking} value={ranking}>
                              {ranking}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    {otaRanking
                      ? OTA_DESCRIPTIONS[otaRanking]
                      : 'Ranking tổng quan không thay thế level của từng kỹ năng.'}
                  </p>
                </CardContent>
              </Card>

              <Card className="gap-4 border-border/80 shadow-none">
                <CardHeader className="border-b border-border pb-4">
                  <CardTitle className="text-base">Kỹ năng đã chọn</CardTitle>
                  <CardDescription>Danh sách này sẽ được áp dụng khi lưu thay đổi.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedSkills.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                      Chưa chọn kỹ năng nào cho nhân sự này.
                    </div>
                  ) : (
                    <ScrollArea className="h-44 rounded-xl">
                      <div className="flex flex-wrap gap-2 pr-3">
                        {selectedSkills.map((skill) => (
                          <Badge
                            key={skill.id}
                            variant="secondary"
                            className="max-w-full font-normal"
                            title={`${skill.categoryName} · ${skill.levelLabel}`}
                          >
                            <span className="truncate">
                              {skill.name} · {skill.levelLabel}
                            </span>
                          </Badge>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card className="gap-4 border-border/80 shadow-none">
              <CardHeader className="border-b border-border pb-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">Danh mục kỹ năng</CardTitle>
                    <CardDescription>
                      Chọn kỹ năng theo nhóm và gán level tương ứng.
                    </CardDescription>
                  </div>
                  <div className="relative w-full lg:max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={skillSearch}
                      onChange={(event) => setSkillSearch(event.target.value)}
                      placeholder="Tìm kỹ năng..."
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ScrollArea className="h-[52vh] rounded-xl">
                  <div className="grid gap-4 pr-3 xl:grid-cols-2">
                    {filteredCategories.map((category) => {
                      const selectedInCategory = category.skills.filter(
                        (skill) => skillMap[skill.id],
                      ).length;

                      return (
                        <Card
                          key={category.id}
                          className="gap-4 border-border bg-background shadow-none"
                        >
                          <CardHeader className="border-b border-border">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <CardTitle className="text-sm">{category.name}</CardTitle>
                                <CardDescription>
                                  {selectedInCategory}/{category.skills.length} kỹ năng đã chọn
                                </CardDescription>
                              </div>
                              <Badge variant="outline">{category.skills.length}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            {category.skills.length === 0 ? (
                              <p className="text-sm text-muted-foreground">
                                Chưa có kỹ năng trong nhóm này. Có thể thêm ở phần cài đặt.
                              </p>
                            ) : (
                              category.skills.map((skill) => {
                                const selected = Boolean(skillMap[skill.id]);
                                const currentLevelId = skillMap[skill.id];

                                return (
                                  <div
                                    key={skill.id}
                                    className="rounded-xl border p-3 transition-colors"
                                    style={{
                                      borderColor: selected ? '#9ad9bd' : '#e2ede9',
                                      background: selected ? '#f7fcf9' : '#ffffff',
                                    }}
                                  >
                                    <div className="flex items-start gap-3">
                                      <Checkbox
                                        checked={selected}
                                        onCheckedChange={() => toggleSkill(skill.id)}
                                        className="mt-0.5"
                                      />
                                      <div className="min-w-0 flex-1 space-y-2">
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-medium text-foreground">
                                              {skill.name}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                              {category.name}
                                            </p>
                                          </div>
                                          {selected ? (
                                            <Badge variant="secondary">Đã chọn</Badge>
                                          ) : null}
                                        </div>

                                        {selected ? (
                                          <div className="grid gap-2 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center">
                                            <Label
                                              htmlFor={`skill-level-${skill.id}`}
                                              className="text-xs text-muted-foreground"
                                            >
                                              Cấp độ
                                            </Label>
                                            <Select
                                              value={currentLevelId}
                                              onValueChange={(value) => setLevel(skill.id, value)}
                                            >
                                              <SelectTrigger
                                                id={`skill-level-${skill.id}`}
                                                className="bg-background"
                                              >
                                                <SelectValue placeholder="Chọn level" />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {levels.map((level) => (
                                                  <SelectItem key={level.id} value={level.id}>
                                                    L{level.level} - {level.name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
                                        ) : null}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </ScrollArea>

                {filteredCategories.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                    Không tìm thấy kỹ năng phù hợp với từ khoá hiện tại.
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-background px-6 py-4 sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {selectedCount} kỹ năng được áp dụng cho {user.fullName}.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Huỷ
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 size-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function SkillManagementPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [meta, setMeta] = useState<Meta>({ total: 0 });
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterCategoryId, setFilterCategoryId] = useState('');
  const [filterSkillId, setFilterSkillId] = useState('');
  const [filterLevelId, setFilterLevelId] = useState('');

  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [levels, setLevels] = useState<SkillLevel[]>([]);

  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    Promise.all([
      apiClient.get<SkillCategory[]>('/api/skills/categories'),
      apiClient.get<Skill[]>('/api/skills'),
      apiClient.get<SkillLevel[]>('/api/skills/levels'),
    ])
      .then(([categoriesResponse, skillsResponse, levelsResponse]) => {
        setCategories(categoriesResponse.data);
        setAllSkills(skillsResponse.data);
        setLevels(levelsResponse.data);
      })
      .catch(() => {
        toast.error('Không tải được dữ liệu cài đặt kỹ năng');
      });
  }, []);

  const loadUsers = useCallback(
    async (params: { search: string; categoryId: string; skillId: string; levelId: string }) => {
      setLoading(true);

      try {
        const query = new URLSearchParams({
          limit: '100',
        });

        if (params.search) query.set('search', params.search);
        if (params.categoryId) query.set('categoryId', params.categoryId);
        if (params.skillId) query.set('skillId', params.skillId);
        if (params.levelId) query.set('levelId', params.levelId);

        const result = await apiClient.get<UserRow[]>(`/api/user-skills?${query}`);
        setUsers(result.data);

        if (result.meta) {
          setMeta({
            total: result.meta.total ?? 0,
          });
        } else {
          setMeta({
            total: result.data.length,
          });
        }
      } catch {
        toast.error('Không tải được danh sách kỹ năng');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    searchTimeout.current = setTimeout(() => {
      void loadUsers({
        search,
        categoryId: filterCategoryId,
        skillId: filterSkillId,
        levelId: filterLevelId,
      });
    }, 300);

    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [search, filterCategoryId, filterSkillId, filterLevelId, loadUsers]);

  const filteredSkills = useMemo(() => {
    if (!filterCategoryId) return allSkills;
    return allSkills.filter((skill) => skill.categoryId === filterCategoryId);
  }, [allSkills, filterCategoryId]);

  const hasFilter = Boolean(search || filterCategoryId || filterSkillId || filterLevelId);

  const clearFilters = () => {
    setSearch('');
    setFilterCategoryId('');
    setFilterSkillId('');
    setFilterLevelId('');
  };

  const activeFilterBadges = [
    search ? `Từ khoá: ${search}` : null,
    filterCategoryId
      ? `Nhóm: ${categories.find((item) => item.id === filterCategoryId)?.name ?? filterCategoryId}`
      : null,
    filterSkillId
      ? `Kỹ năng: ${allSkills.find((item) => item.id === filterSkillId)?.name ?? filterSkillId}`
      : null,
    filterLevelId
      ? `Level: ${levels.find((item) => item.id === filterLevelId)?.name ?? filterLevelId}`
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary text-primary">
              <Brain className="size-5" />
            </div>
            <div className="space-y-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Quản lý kỹ năng
              </h1>
              <p className="text-sm text-muted-foreground">
                Hồ sơ năng lực và level kỹ năng của từng thành viên.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">{users.length} thành viên</Badge>
            <Badge variant="outline">{categories.length} nhóm</Badge>
            <Badge variant="outline">{levels.length} level</Badge>
          </div>
        </div>

        <Link
          href="/dashboard/skills/settings"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
        >
          <Settings2 className="size-4" />
          Cài đặt kỹ năng
        </Link>
      </div>

      <Card className="border-border/80 shadow-none">
        <CardHeader className="border-b border-border">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-primary" />
            <CardTitle className="text-base">Bộ lọc</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 pt-5">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.4fr)_220px_220px_220px_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Tìm theo tên, username, email..."
                className="pl-9"
              />
            </div>

            <Select
              value={filterCategoryId || '__all__'}
              onValueChange={(value) => {
                setFilterCategoryId(value === '__all__' ? '' : value);
                setFilterSkillId('');
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả nhóm" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả nhóm</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterSkillId || '__all__'}
              onValueChange={(value) => {
                setFilterSkillId(value === '__all__' ? '' : value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả kỹ năng" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả kỹ năng</SelectItem>
                {filteredSkills.map((skill) => (
                  <SelectItem key={skill.id} value={skill.id}>
                    {skill.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filterLevelId || '__all__'}
              onValueChange={(value) => {
                setFilterLevelId(value === '__all__' ? '' : value);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tất cả level" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Tất cả level</SelectItem>
                {levels.map((level) => (
                  <SelectItem key={level.id} value={level.id}>
                    Level {level.level} - {level.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" onClick={clearFilters} disabled={!hasFilter}>
              <X className="mr-2 size-4" />
              Xoá filter
            </Button>
          </div>

          {activeFilterBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {activeFilterBadges.map((label) => (
                <Badge key={label} variant="secondary" className="font-normal">
                  {label}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-border/80 shadow-none">
        <CardHeader className="border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-base">Danh sách thành viên</CardTitle>
              <CardDescription>{users.length} kết quả</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{users.length} hồ sơ trên trang</Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Đang tải danh sách kỹ năng...
              </div>
            </div>
          ) : users.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center gap-3 px-6 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <Brain className="size-5" />
              </div>
              <div className="space-y-1">
                <p className="font-medium text-foreground">
                  {hasFilter
                    ? 'Không có hồ sơ phù hợp với bộ lọc hiện tại.'
                    : 'Chưa có dữ liệu kỹ năng.'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {hasFilter
                    ? 'Thử đổi từ khoá, nhóm kỹ năng hoặc level để mở rộng kết quả.'
                    : 'Bắt đầu bằng cách thêm kỹ năng trong phần cài đặt và gán cho nhân sự.'}
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="min-w-[280px]">Thành viên</TableHead>
                    <TableHead className="min-w-[220px]">Hồ sơ năng lực</TableHead>
                    <TableHead className="min-w-[340px]">Kỹ năng</TableHead>
                    <TableHead className="w-[96px] text-right">Thao tác</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} className="align-top">
                      <TableCell className="py-4">
                        <div className="flex items-start gap-3">
                          {getAvatarUrl(user.avatar) ? (
                            <img
                              src={getAvatarUrl(user.avatar) || ''}
                              alt={user.fullName}
                              className="h-11 w-11 shrink-0 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1DB87A_0%,#0E474E_100%)] text-sm font-bold text-white">
                              {getUserInitials(user)}
                            </div>
                          )}
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {user.fullName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                            <div className="flex flex-wrap gap-2">
                              {user.department ? (
                                <Badge variant="secondary" className="font-normal">
                                  {user.department}
                                </Badge>
                              ) : null}
                              {user.position ? (
                                <Badge variant="outline" className="font-normal">
                                  {user.position}
                                </Badge>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="text-sm text-foreground">
                          <span className="font-medium">
                            {user.yoe != null ? `${user.yoe} năm` : 'Chưa có YoE'}
                          </span>
                          <span className="mx-2 text-muted-foreground">·</span>
                          <span className="text-muted-foreground">
                            {user.otaRanking || 'Chưa có ranking'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        {user.userSkills.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-4 text-sm text-muted-foreground">
                            Chưa có kỹ năng nào được gán cho thành viên này.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {user.userSkills.slice(0, 6).map((userSkill) => (
                                <SkillBadge key={userSkill.id} userSkill={userSkill} />
                              ))}
                              <MoreSkillsPopover userSkills={user.userSkills} />
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Tổng cộng {user.userSkills.length} kỹ năng đã được cấu hình.
                            </p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="py-4 text-right">
                        <Button size="sm" onClick={() => setEditingUser(user)}>
                          <PencilLine className="mr-2 size-4" />
                          Sửa
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {editingUser ? (
        <EditSkillsModal
          user={editingUser}
          categories={categories}
          levels={levels}
          onClose={() => setEditingUser(null)}
          onSaved={() =>
            void loadUsers({
              search,
              categoryId: filterCategoryId,
              skillId: filterSkillId,
              levelId: filterLevelId,
            })
          }
        />
      ) : null}
    </div>
  );
}
