'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Circle, Group, Layer, Line, Rect, Stage, Text, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { KonvaEventObject } from 'konva/lib/Node';
import {
  Check,
  Cloud,
  CloudOff,
  Copy,
  Grid3x3,
  Loader2,
  Lock,
  Monitor,
  MousePointer2,
  Pencil,
  Presentation,
  Save,
  Square,
  Trash2,
  Unlock,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  DEFAULT_SIZES,
  INITIAL_ITEMS,
  LABEL_PREFIXES,
  STYLES,
  type DrawRect,
  type ItemType,
  type Tool,
  type WorkspaceItem,
} from './types';
import { fetchWorkspaceMap, saveWorkspaceMap } from '@/lib/workspace-map-api';
import { apiClient, getApiBaseUrl, getStoredUser } from '@/lib/api-client';
import { WorkspaceMap3D } from './WorkspaceMap3D';

const GRID = 10;
const DOOR_RESIZE_MIN = 2;
const WALL_THICKNESS_MIN = 1;
const WALL_THICKNESS_MAX = 20;
const SMART_SNAP_THRESHOLD = 6;
const ROOM_WALL_SNAP_THRESHOLD = 10;

type SaveStatus = 'idle' | 'loading' | 'saving' | 'saved' | 'error';
type SnapMode = 'smart' | 'grid' | 'none';
type AlignMode = 'left' | 'h-center' | 'right' | 'top' | 'v-center' | 'bottom';
type DistributeMode = 'horizontal' | 'vertical';

type ContextMenuState = {
  x: number;
  y: number;
  open: boolean;
};

interface WorkspaceMemberApiItem {
  id: string | number;
  email: string;
  fullName?: string | null;
  avatar?: string | null;
  isActive?: boolean;
}

interface WorkspaceMemberOption {
  id: string;
  email: string;
  avatarUrl: string | null;
  handle: string;
}

interface WorkspaceViewerSession {
  isSystemSuperAdmin?: boolean | string | number | null;
}

function normalizeEmailHandle(email?: string | null) {
  if (!email) return 'unknown';
  const localPart = email.trim().split('@')[0] ?? '';
  return localPart || 'unknown';
}

function getAvatarUrl(avatar?: string | null): string | null {
  if (!avatar) return null;
  if (avatar.startsWith('http')) return avatar;
  if (avatar.startsWith('/assets')) return avatar;
  if (avatar.startsWith('/uploads')) return getApiBaseUrl() + avatar;
  return null;
}

const snap = (v: number) => Math.round(v / GRID) * GRID;
const snapByStep = (v: number, step: number) => Math.round(v / step) * step;
const snapBound = (pos: { x: number; y: number }) => ({ x: snap(pos.x), y: snap(pos.y) });
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const toCell = (v: number) => Math.round(v / GRID);

const typeOrder: Record<ItemType, number> = { room: 0, door: 1, desk: 2, chair: 3, tv: 4 };
const sortByType = (arr: WorkspaceItem[]) =>
  [...arr].sort((a, b) => typeOrder[a.type] - typeOrder[b.type]);

const WS_ID_REGEX = /^ws-(\d+)$/;
const TRAILING_NUMBER_REGEX = /(\d+)\s*$/;

function getNextRoomGroupId(items: WorkspaceItem[]) {
  const maxGroupNo = items.reduce((max, item) => {
    if (item.type !== 'room' || !item.roomGroupId?.startsWith('room-group-')) return max;
    const no = Number(item.roomGroupId.replace('room-group-', ''));
    return Number.isFinite(no) ? Math.max(max, no) : max;
  }, 0);
  return `room-group-${maxGroupNo + 1}`;
}

function normalizeWorkspaceItems(items: WorkspaceItem[]) {
  const seenIds = new Set<string>();
  let maxSeq = 100;
  const maxLabelNo: Record<ItemType, number> = { room: 0, door: 0, desk: 0, chair: 0, tv: 0 };
  const typeCounts: Record<ItemType, number> = { room: 0, door: 0, desk: 0, chair: 0, tv: 0 };

  const parsed = items.map((item) => {
    const wsNo = Number(item.id.match(WS_ID_REGEX)?.[1] ?? Number.NaN);
    if (Number.isFinite(wsNo)) maxSeq = Math.max(maxSeq, wsNo);

    typeCounts[item.type] += 1;
    if (item.name.startsWith(LABEL_PREFIXES[item.type])) {
      const labelNo = Number(item.name.match(TRAILING_NUMBER_REGEX)?.[1] ?? Number.NaN);
      if (Number.isFinite(labelNo))
        maxLabelNo[item.type] = Math.max(maxLabelNo[item.type], labelNo);
    }

    return { ...item };
  });

  parsed.forEach((item) => {
    if (seenIds.has(item.id)) {
      maxSeq += 1;
      item.id = `ws-${maxSeq}`;
      return;
    }
    seenIds.add(item.id);
  });

  return {
    items: parsed,
    maxSeq,
    counters: {
      room: Math.max(maxLabelNo.room, typeCounts.room),
      door: Math.max(maxLabelNo.door, typeCounts.door),
      desk: Math.max(maxLabelNo.desk, typeCounts.desk),
      chair: Math.max(maxLabelNo.chair, typeCounts.chair),
      tv: Math.max(maxLabelNo.tv, typeCounts.tv),
    } satisfies Record<ItemType, number>,
  };
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
) {
  return !(
    a.x > b.x + b.width ||
    a.x + a.width < b.x ||
    a.y > b.y + b.height ||
    a.y + a.height < b.y
  );
}

function buildGroupedRoomCornerRadius(
  items: WorkspaceItem[],
): Map<string, [number, number, number, number]> {
  const groupedRooms = items.filter((item) => item.type === 'room' && item.roomGroupId);
  const byGroup = groupedRooms.reduce<Record<string, WorkspaceItem[]>>((acc, room) => {
    const key = room.roomGroupId as string;
    if (!acc[key]) acc[key] = [];
    acc[key].push(room);
    return acc;
  }, {});

  const cornerMap = new Map<string, [number, number, number, number]>();

  Object.values(byGroup).forEach((rooms) => {
    if (rooms.length < 2) return;

    const occupied = new Set<string>();
    rooms.forEach((room) => {
      const gx = toCell(room.x);
      const gy = toCell(room.y);
      const gw = Math.max(1, toCell(room.width));
      const gh = Math.max(1, toCell(room.height));
      for (let x = gx; x < gx + gw; x++) {
        for (let y = gy; y < gy + gh; y++) {
          occupied.add(`${x},${y}`);
        }
      }
    });

    const has = (x: number, y: number) => occupied.has(`${x},${y}`);

    rooms.forEach((room) => {
      const gx = toCell(room.x);
      const gy = toCell(room.y);
      const gw = Math.max(1, toCell(room.width));
      const gh = Math.max(1, toCell(room.height));
      const x0 = gx;
      const y0 = gy;
      const x1 = gx + gw;
      const y1 = gy + gh;
      const r = room.cornerRadius ?? STYLES.room.cornerRadius;

      const tl = has(x0, y0) && !has(x0 - 1, y0) && !has(x0, y0 - 1) ? r : 0;
      const tr = has(x1 - 1, y0) && !has(x1, y0) && !has(x1 - 1, y0 - 1) ? r : 0;
      const br = has(x1 - 1, y1 - 1) && !has(x1, y1 - 1) && !has(x1 - 1, y1) ? r : 0;
      const bl = has(x0, y1 - 1) && !has(x0 - 1, y1 - 1) && !has(x0, y1) ? r : 0;

      cornerMap.set(room.id, [tl, tr, br, bl]);
    });
  });

  return cornerMap;
}

function buildFixedGrid(params: {
  width: number;
  height: number;
  viewportX: number;
  viewportY: number;
  scale: number;
}) {
  const { width, height, viewportX, viewportY, scale } = params;
  const step = GRID;
  const majorStep = GRID * 5;
  const minX = Math.floor(-viewportX / scale / GRID) * GRID - GRID;
  const maxX = Math.ceil((width - viewportX) / scale / GRID) * GRID + GRID;
  const minY = Math.floor(-viewportY / scale / GRID) * GRID - GRID;
  const maxY = Math.ceil((height - viewportY) / scale / GRID) * GRID + GRID;
  const hairline = Math.max(0.35, 1 / scale);

  const lines: React.ReactElement[] = [];
  for (let x = minX; x <= maxX; x += step) {
    const isMajor = x % majorStep === 0;
    lines.push(
      <Line
        key={`v-${x}`}
        points={[x, minY, x, maxY]}
        stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
        strokeWidth={hairline}
        listening={false}
      />,
    );
  }
  for (let y = minY; y <= maxY; y += step) {
    const isMajor = y % majorStep === 0;
    lines.push(
      <Line
        key={`h-${y}`}
        points={[minX, y, maxX, y]}
        stroke={isMajor ? '#cbd5e1' : '#e2e8f0'}
        strokeWidth={hairline}
        listening={false}
      />,
    );
  }
  return lines;
}

function placeDoorOnNearestRoomWall(
  items: WorkspaceItem[],
  pos: { x: number; y: number },
  wallThickness: number,
) {
  const roomAtPoint = items
    .filter((item) => item.type === 'room')
    .filter(
      (room) =>
        pos.x >= room.x &&
        pos.x <= room.x + room.width &&
        pos.y >= room.y &&
        pos.y <= room.y + room.height,
    )
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];

  if (!roomAtPoint) return null;

  const room = roomAtPoint;
  const horizontalLen = DEFAULT_SIZES.door.width;
  const verticalLen = DEFAULT_SIZES.door.width;
  const thickness = Math.max(DEFAULT_SIZES.door.height, Math.ceil(wallThickness * 1.1));

  const distances: Array<{ side: 'top' | 'bottom' | 'left' | 'right'; distance: number }> = [
    { side: 'top', distance: Math.abs(pos.y - room.y) },
    { side: 'bottom', distance: Math.abs(room.y + room.height - pos.y) },
    { side: 'left', distance: Math.abs(pos.x - room.x) },
    { side: 'right', distance: Math.abs(room.x + room.width - pos.x) },
  ];
  const nearest = distances.sort((a, b) => a.distance - b.distance)[0];

  if (nearest.side === 'top' || nearest.side === 'bottom') {
    const centerX = clamp(
      pos.x,
      room.x + horizontalLen / 2,
      room.x + room.width - horizontalLen / 2,
    );
    return {
      x: snap(centerX - horizontalLen / 2),
      y: snap(nearest.side === 'top' ? room.y : room.y + room.height - thickness),
      width: horizontalLen,
      height: thickness,
    };
  }

  const centerY = clamp(pos.y, room.y + verticalLen / 2, room.y + room.height - verticalLen / 2);
  return {
    x: snap(nearest.side === 'left' ? room.x : room.x + room.width - thickness),
    y: snap(centerY - verticalLen / 2),
    width: thickness,
    height: verticalLen,
  };
}

function getSmartSnappedPosition(params: {
  item: WorkspaceItem;
  proposedX: number;
  proposedY: number;
  items: WorkspaceItem[];
  selectedIds: string[];
  snapMode: SnapMode;
}) {
  const { item, proposedX, proposedY, items, selectedIds, snapMode } = params;

  if (snapMode === 'none' || item.type === 'door') {
    return { x: proposedX, y: proposedY };
  }

  let x = snapMode === 'grid' ? snap(proposedX) : proposedX;
  let y = snapMode === 'grid' ? snap(proposedY) : proposedY;

  if (snapMode !== 'smart') return { x, y };

  const otherItems = items.filter((i) => i.id !== item.id && !selectedIds.includes(i.id));
  const targetX = [proposedX, proposedX + item.width / 2, proposedX + item.width];
  const targetY = [proposedY, proposedY + item.height / 2, proposedY + item.height];

  let bestX: number | null = null;
  let bestXDiff = SMART_SNAP_THRESHOLD + 1;
  let bestY: number | null = null;
  let bestYDiff = SMART_SNAP_THRESHOLD + 1;

  // Desk/chair/tv: snap to room wall edges when dragging near them.
  if (item.type === 'desk' || item.type === 'chair' || item.type === 'tv') {
    const roomItems = otherItems.filter((i) => i.type === 'room');

    roomItems.forEach((room) => {
      const nearYRange =
        proposedY + item.height >= room.y - ROOM_WALL_SNAP_THRESHOLD &&
        proposedY <= room.y + room.height + ROOM_WALL_SNAP_THRESHOLD;
      if (nearYRange) {
        const xCandidates = [room.x, room.x + room.width - item.width];
        xCandidates.forEach((candidateX) => {
          const diff = Math.abs(proposedX - candidateX);
          if (diff < bestXDiff && diff <= ROOM_WALL_SNAP_THRESHOLD) {
            bestXDiff = diff;
            bestX = candidateX;
          }
        });
      }

      const nearXRange =
        proposedX + item.width >= room.x - ROOM_WALL_SNAP_THRESHOLD &&
        proposedX <= room.x + room.width + ROOM_WALL_SNAP_THRESHOLD;
      if (nearXRange) {
        const yCandidates = [room.y, room.y + room.height - item.height];
        yCandidates.forEach((candidateY) => {
          const diff = Math.abs(proposedY - candidateY);
          if (diff < bestYDiff && diff <= ROOM_WALL_SNAP_THRESHOLD) {
            bestYDiff = diff;
            bestY = candidateY;
          }
        });
      }
    });
  }

  otherItems.forEach((other) => {
    const candidateX = [other.x, other.x + other.width / 2, other.x + other.width];
    const candidateY = [other.y, other.y + other.height / 2, other.y + other.height];

    targetX.forEach((tx, txIdx) => {
      candidateX.forEach((cx) => {
        const diff = Math.abs(tx - cx);
        if (diff < bestXDiff) {
          bestXDiff = diff;
          if (txIdx === 0) bestX = cx;
          if (txIdx === 1) bestX = cx - item.width / 2;
          if (txIdx === 2) bestX = cx - item.width;
        }
      });
    });

    targetY.forEach((ty, tyIdx) => {
      candidateY.forEach((cy) => {
        const diff = Math.abs(ty - cy);
        if (diff < bestYDiff) {
          bestYDiff = diff;
          if (tyIdx === 0) bestY = cy;
          if (tyIdx === 1) bestY = cy - item.height / 2;
          if (tyIdx === 2) bestY = cy - item.height;
        }
      });
    });
  });

  if (bestX !== null && bestXDiff <= SMART_SNAP_THRESHOLD) x = snap(bestX);
  else x = snap(proposedX);

  if (bestY !== null && bestYDiff <= SMART_SNAP_THRESHOLD) y = snap(bestY);
  else y = snap(proposedY);

  return { x, y };
}

export default function WorkspaceMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<Konva.Stage>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const itemGroupRefs = useRef<Map<string, Konva.Group>>(new Map());
  const multiGroupRef = useRef<Konva.Group>(null);

  const [tool, setTool] = useState<Tool>('select');
  const [items, setItems] = useState<WorkspaceItem[]>(INITIAL_ITEMS);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lockedIds, setLockedIds] = useState<string[]>([]);

  const [stageSize, setStageSize] = useState({ width: 900, height: 600 });
  const [viewport, setViewport] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const [snapMode, setSnapMode] = useState<SnapMode>('smart');
  const [showGrid, setShowGrid] = useState(true);
  const [presentationMode, setPresentationMode] = useState(false);
  const [view3D, setView3D] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [drawRect, setDrawRect] = useState<DrawRect | null>(null);

  const [isSelecting, setIsSelecting] = useState(false);
  const selStart = useRef({ x: 0, y: 0 });
  const [selBox, setSelBox] = useState<DrawRect | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('loading');
  const [wallThickness, setWallThickness] = useState(STYLES.room.strokeWidth);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ x: 0, y: 0, open: false });
  const [memberOptions, setMemberOptions] = useState<WorkspaceMemberOption[]>([]);
  const [isLoadingMembers, setIsLoadingMembers] = useState(false);
  const [avatarImageMap, setAvatarImageMap] = useState<Record<string, HTMLImageElement>>({});
  const [isSystemSuperAdmin] = useState(() => {
    const viewer = getStoredUser<WorkspaceViewerSession>();
    const flag = viewer?.isSystemSuperAdmin;
    if (typeof flag === 'boolean') return flag;
    if (typeof flag === 'string') return flag.toLowerCase() === 'true' || flag === '1';
    if (typeof flag === 'number') return flag === 1;
    return false;
  });

  const seqRef = useRef(100);
  const hasAutoFittedRef = useRef(false);
  const countersRef = useRef<Record<ItemType, number>>({
    room: 3,
    door: 0,
    desk: 7,
    chair: 7,
    tv: 0,
  });

  const visibleItems = items;
  const visibleSorted = useMemo(() => sortByType(visibleItems), [visibleItems]);

  const isMultiSelect = selectedIds.length > 1;
  const singleItem =
    selectedIds.length === 1 ? (items.find((i) => i.id === selectedIds[0]) ?? null) : null;
  const chairAssignee = singleItem?.type === 'chair' ? singleItem.assignedMemberId : undefined;

  const roomCornerRadiusMap = useMemo(
    () => buildGroupedRoomCornerRadius(visibleItems),
    [visibleItems],
  );

  const gridLines = useMemo(
    () =>
      showGrid && !presentationMode
        ? buildFixedGrid({
            width: stageSize.width,
            height: stageSize.height,
            viewportX: viewport.x,
            viewportY: viewport.y,
            scale: viewport.scale,
          })
        : [],
    [
      showGrid,
      presentationMode,
      stageSize.width,
      stageSize.height,
      viewport.x,
      viewport.y,
      viewport.scale,
    ],
  );

  const flatItems = isMultiSelect
    ? visibleSorted.filter((i) => !selectedIds.includes(i.id))
    : visibleSorted;
  const groupedItems = isMultiSelect ? visibleSorted.filter((i) => selectedIds.includes(i.id)) : [];
  const isViewOnly = !isSystemSuperAdmin;

  const cursor = isPanning
    ? 'grabbing'
    : tool === 'select'
      ? 'grab'
      : tool === 'room'
        ? 'crosshair'
        : 'cell';
  const stageCursor = isViewOnly ? (isPanning ? 'grabbing' : 'grab') : cursor;

  useEffect(() => {
    const measure = () => {
      if (!containerRef.current) return;
      setStageSize({
        width: containerRef.current.offsetWidth,
        height: containerRef.current.offsetHeight,
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (hasAutoFittedRef.current) return;
    if (view3D) return;
    if (stageSize.width <= 0 || stageSize.height <= 0) return;
    if (items.length === 0) return;

    const minX = Math.min(...items.map((item) => item.x));
    const minY = Math.min(...items.map((item) => item.y));
    const maxX = Math.max(...items.map((item) => item.x + item.width));
    const maxY = Math.max(...items.map((item) => item.y + item.height));

    const boundsWidth = Math.max(1, maxX - minX);
    const boundsHeight = Math.max(1, maxY - minY);
    const padding = Math.max(56, Math.min(stageSize.width, stageSize.height) * 0.08);

    const fitScaleX = stageSize.width / (boundsWidth + padding * 2);
    const fitScaleY = stageSize.height / (boundsHeight + padding * 2);
    const nextScale = clamp(Math.min(fitScaleX, fitScaleY), 0.08, 3);

    const centerX = minX + boundsWidth / 2;
    const centerY = minY + boundsHeight / 2;

    setViewport({
      scale: nextScale,
      x: stageSize.width / 2 - centerX * nextScale,
      y: stageSize.height / 2 - centerY * nextScale,
    });

    hasAutoFittedRef.current = true;
  }, [items, stageSize.width, stageSize.height, view3D]);

  useEffect(() => {
    if (!isViewOnly) return;
    setSelectedIds([]);
    setEditingId(null);
    setContextMenu((prev) => ({ ...prev, open: false }));
    setShowCommandPalette(false);
    setTool('select');
  }, [isViewOnly]);

  useEffect(() => {
    fetchWorkspaceMap()
      .then((data) => {
        hasAutoFittedRef.current = false;
        if (data.items?.length) {
          const normalized = normalizeWorkspaceItems(data.items);
          seqRef.current = normalized.maxSeq;
          countersRef.current = normalized.counters;
          setItems(normalized.items);
        }
        if (typeof data.wallThickness === 'number' && Number.isFinite(data.wallThickness)) {
          setWallThickness(clamp(data.wallThickness, WALL_THICKNESS_MIN, WALL_THICKNESS_MAX));
        }
        setSaveStatus('idle');
      })
      .catch(() => setSaveStatus('idle'));
  }, []);

  useEffect(() => {
    setIsLoadingMembers(true);
    apiClient
      .get<WorkspaceMemberApiItem[]>('/api/users?page=1&limit=100&status=active')
      .then((res) => {
        const seen = new Set<string>();
        const users = (res.data ?? [])
          .filter((u) => Boolean(u?.email))
          .map((u) => ({
            id: String(u.id),
            email: u.email.trim(),
            avatarUrl: getAvatarUrl(u.avatar ?? null),
            handle: normalizeEmailHandle(u.email),
          }))
          .filter((u) => {
            if (seen.has(u.id)) return false;
            seen.add(u.id);
            return true;
          })
          .sort((a, b) => a.email.localeCompare(b.email));
        setMemberOptions(users);
      })
      .catch(() => setMemberOptions([]))
      .finally(() => setIsLoadingMembers(false));
  }, []);

  useEffect(() => {
    const avatarUrls = Array.from(
      new Set(
        items
          .filter((item) => item.type === 'chair')
          .map((item) => item.assignedMemberAvatar)
          .filter((url): url is string => Boolean(url)),
      ),
    );

    avatarUrls.forEach((url) => {
      if (avatarImageMap[url]) return;
      const image = new window.Image();
      image.crossOrigin = 'anonymous';
      image.src = url;
      image.onload = () => {
        setAvatarImageMap((prev) => (prev[url] ? prev : { ...prev, [url]: image }));
      };
    });
  }, [items, avatarImageMap]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isViewOnly) return;
      if (e.target instanceof HTMLInputElement) return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
        setSelectedIds([]);
        return;
      }

      if (e.key === 'Escape') {
        setSelectedIds([]);
        setTool('select');
        setEditingId(null);
        setContextMenu((prev) => ({ ...prev, open: false }));
        setShowCommandPalette(false);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setSelectedIds(visibleItems.map((i) => i.id));
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (selectedIds.length === 1) {
          const source = items.find((i) => i.id === selectedIds[0]);
          if (!source) return;
          const prefix = LABEL_PREFIXES[source.type];
          const hasDefaultLabel = source.name.startsWith(prefix);
          const duplicated: WorkspaceItem = {
            ...source,
            id: `ws-${++seqRef.current}`,
            x: snap(source.x + GRID * 2),
            y: snap(source.y + GRID * 2),
            name: hasDefaultLabel
              ? `${prefix} ${++countersRef.current[source.type]}`
              : `${source.name} (copy)`,
          };
          setItems((prev) => [...prev, duplicated]);
          setSelectedIds([duplicated.id]);
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void handleSave();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }

      if (!e.ctrlKey && !e.metaKey) {
        if (e.key.toLowerCase() === 'v') setTool('select');
        if (e.key.toLowerCase() === 'r') setTool('room');
        if (e.key.toLowerCase() === 'o') setTool('door');
        if (e.key.toLowerCase() === 'd') setTool('desk');
        if (e.key.toLowerCase() === 'c') setTool('chair');
        if (e.key.toLowerCase() === 't') setTool('tv');
        if (e.key.toLowerCase() === 'l' && selectedIds.length > 0) {
          setLockedIds((prev) => {
            const set = new Set(prev);
            selectedIds.forEach((id) => {
              if (set.has(id)) set.delete(id);
              else set.add(id);
            });
            return Array.from(set);
          });
        }
        if (e.key.toLowerCase() === 'g') {
          if (selectedIds.length >= 2) {
            const selectedRooms = items.filter(
              (item) => selectedIds.includes(item.id) && item.type === 'room',
            );
            if (selectedRooms.length >= 2) {
              const groupId = getNextRoomGroupId(items);
              const selectedSet = new Set(selectedRooms.map((room) => room.id));
              setItems((prev) =>
                prev.map((item) =>
                  selectedSet.has(item.id) && item.type === 'room'
                    ? { ...item, roomGroupId: groupId }
                    : item,
                ),
              );
            }
          }
        }
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        setIsSpacePressed(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [selectedIds, items, visibleItems, isViewOnly]);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    const node = selectedIds.length === 1 ? itemGroupRefs.current.get(selectedIds[0]) : undefined;
    tr.nodes(node ? [node] : []);
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  }, [selectedIds]);

  useEffect(() => {
    if (selectedIds.length !== 1) return;
    const tr = trRef.current;
    const node = itemGroupRefs.current.get(selectedIds[0]);
    if (!tr || !node) return;
    tr.nodes([node]);
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  }, [items, selectedIds]);

  useEffect(() => {
    const onWindowClick = () => setContextMenu((prev) => ({ ...prev, open: false }));
    window.addEventListener('click', onWindowClick);
    return () => window.removeEventListener('click', onWindowClick);
  }, []);

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      await saveWorkspaceMap({ items, wallThickness });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const stagePos = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage();
    const pointer = stage?.getPointerPosition();
    if (!stage || !pointer) return { x: 0, y: 0 };
    const transform = stage.getAbsoluteTransform().copy();
    transform.invert();
    return transform.point(pointer);
  };

  const startPan = (stage: Konva.Stage) => {
    setIsPanning(true);
    setIsSelecting(false);
    setSelBox(null);
    stage.draggable(true);
    stage.startDrag();
  };

  const addNewItemByTool = (toolType: Exclude<Tool, 'select'>, pos: { x: number; y: number }) => {
    if (toolType === 'door') {
      const placed = placeDoorOnNearestRoomWall(visibleItems, pos, wallThickness);
      if (!placed) return;
      const newDoor: WorkspaceItem = {
        id: `ws-${++seqRef.current}`,
        type: 'door',
        x: placed.x,
        y: placed.y,
        width: placed.width,
        height: placed.height,
        name: `${LABEL_PREFIXES.door} ${++countersRef.current.door}`,
      };
      setItems((prev) => [...prev, newDoor]);
      setSelectedIds([newDoor.id]);
      setTool('select');
      return;
    }

    const size = DEFAULT_SIZES[toolType];
    const newItem: WorkspaceItem = {
      id: `ws-${++seqRef.current}`,
      type: toolType,
      x: snap(pos.x - size.width / 2),
      y: snap(pos.y - size.height / 2),
      width: size.width,
      height: size.height,
      name: `${LABEL_PREFIXES[toolType]} ${++countersRef.current[toolType]}`,
    };
    setItems((prev) => [...prev, newItem]);
    setSelectedIds([newItem.id]);
    setTool('select');
  };

  const handleStageMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    setContextMenu((prev) => ({ ...prev, open: false }));
    const isStage = e.target === e.target.getStage();

    if (isViewOnly) {
      if (isStage) {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (stage) startPan(stage);
      }
      return;
    }

    if (isStage && (isSpacePressed || e.evt.button === 1)) {
      e.evt.preventDefault();
      const stage = e.target.getStage();
      if (stage) startPan(stage);
      return;
    }

    if (tool === 'select') {
      if (isStage) {
        const stage = e.target.getStage();
        if (stage && !e.evt.shiftKey) {
          e.evt.preventDefault();
          startPan(stage);
          return;
        }

        const pos = stagePos(e);
        selStart.current = pos;
        setSelBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
        setIsSelecting(true);
        setSelectedIds([]);
      }
      return;
    }

    const pos = stagePos(e);
    if (tool === 'room') {
      const sx = snap(pos.x);
      const sy = snap(pos.y);
      setIsDrawing(true);
      setDrawStart({ x: sx, y: sy });
      setDrawRect({ x: sx, y: sy, width: 0, height: 0 });
      return;
    }

    addNewItemByTool(tool, pos);
  };

  const handleStageMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    if (isPanning) return;

    if (isDrawing) {
      const pos = stagePos(e);
      const ex = snap(pos.x);
      const ey = snap(pos.y);
      setDrawRect({
        x: Math.min(ex, drawStart.x),
        y: Math.min(ey, drawStart.y),
        width: Math.abs(ex - drawStart.x),
        height: Math.abs(ey - drawStart.y),
      });
      return;
    }

    if (isSelecting) {
      const pos = stagePos(e);
      setSelBox({
        x: Math.min(pos.x, selStart.current.x),
        y: Math.min(pos.y, selStart.current.y),
        width: Math.abs(pos.x - selStart.current.x),
        height: Math.abs(pos.y - selStart.current.y),
      });
    }
  };

  const handleStageMouseUp = () => {
    if (isPanning) {
      const stage = stageRef.current;
      if (stage) {
        stage.stopDrag();
        stage.draggable(false);
      }
      setIsPanning(false);
      return;
    }

    if (isDrawing && drawRect) {
      setIsDrawing(false);
      if (drawRect.width >= 40 && drawRect.height >= 40) {
        const room: WorkspaceItem = {
          id: `ws-${++seqRef.current}`,
          type: 'room',
          x: snap(drawRect.x),
          y: snap(drawRect.y),
          width: Math.max(GRID, snap(drawRect.width)),
          height: Math.max(GRID, snap(drawRect.height)),
          name: `${LABEL_PREFIXES.room} ${++countersRef.current.room}`,
        };
        setItems((prev) => [...prev, room]);
        setSelectedIds([room.id]);
        setTool('select');
      }
      setDrawRect(null);
      return;
    }

    if (isSelecting) {
      setIsSelecting(false);
      if (selBox && selBox.width > 4 && selBox.height > 4) {
        const hit = visibleItems.filter((item) => rectsIntersect(selBox, item)).map((i) => i.id);
        setSelectedIds(hit);
      }
      setSelBox(null);
    }
  };

  const handleStageWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    const stage = stageRef.current;
    if (!stage) return;

    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const oldScale = viewport.scale;
    const scaleBy = 1.08;
    const nextScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    const clampedScale = clamp(nextScale, 0.35, 3);

    const worldPos = {
      x: (pointer.x - viewport.x) / oldScale,
      y: (pointer.y - viewport.y) / oldScale,
    };

    setViewport({
      scale: clampedScale,
      x: pointer.x - worldPos.x * clampedScale,
      y: pointer.y - worldPos.y * clampedScale,
    });
  };

  const handleStageDragMove = (e: KonvaEventObject<DragEvent>) => {
    const stage = stageRef.current;
    if (!stage || !isPanning || e.target !== stage) return;
    setViewport((prev) => ({ ...prev, x: stage.x(), y: stage.y() }));
  };

  const handleDelete = () => {
    if (selectedIds.length === 0) return;
    setItems((prev) => prev.filter((i) => !selectedIds.includes(i.id)));
    setSelectedIds([]);
  };

  const handleDuplicate = () => {
    if (selectedIds.length !== 1) return;
    const source = items.find((i) => i.id === selectedIds[0]);
    if (!source) return;

    const prefix = LABEL_PREFIXES[source.type];
    const hasDefaultLabel = source.name.startsWith(prefix);
    const duplicated: WorkspaceItem = {
      ...source,
      id: `ws-${++seqRef.current}`,
      x: snap(source.x + GRID * 2),
      y: snap(source.y + GRID * 2),
      name: hasDefaultLabel
        ? `${prefix} ${++countersRef.current[source.type]}`
        : `${source.name} (copy)`,
    };

    setItems((prev) => [...prev, duplicated]);
    setSelectedIds([duplicated.id]);
  };

  const commitName = () => {
    if (!editingId) return;
    setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, name: editName } : i)));
    setEditingId(null);
  };

  const handleItemClick = (id: string, e: KonvaEventObject<MouseEvent>) => {
    if (lockedIds.includes(id)) return;
    e.cancelBubble = true;
    if (e.evt.shiftKey) {
      setSelectedIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
    } else {
      setSelectedIds([id]);
    }
  };

  const handleItemContextMenu = (id: string, e: KonvaEventObject<PointerEvent>) => {
    e.evt.preventDefault();
    e.cancelBubble = true;
    if (!selectedIds.includes(id)) setSelectedIds([id]);
    setContextMenu({ x: e.evt.clientX, y: e.evt.clientY, open: true });
  };

  const handleSingleDragMove = (id: string, e: KonvaEventObject<DragEvent>) => {
    const item = items.find((i) => i.id === id);
    if (!item || lockedIds.includes(id)) return;

    const node = e.target as Konva.Group;
    const snapped = getSmartSnappedPosition({
      item,
      proposedX: node.x(),
      proposedY: node.y(),
      items: visibleItems,
      selectedIds,
      snapMode,
    });

    if (node.x() !== snapped.x || node.y() !== snapped.y) {
      node.x(snapped.x);
      node.y(snapped.y);
    }
  };

  const handleSingleDragEnd = (id: string, e: KonvaEventObject<DragEvent>) => {
    const item = items.find((i) => i.id === id);
    if (!item || lockedIds.includes(id)) return;

    const node = e.target as Konva.Group;
    const snapped = getSmartSnappedPosition({
      item,
      proposedX: node.x(),
      proposedY: node.y(),
      items: visibleItems,
      selectedIds,
      snapMode,
    });

    node.x(snapped.x);
    node.y(snapped.y);
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, x: snapped.x, y: snapped.y } : it)),
    );
  };

  const handleGroupDragMove = (e: KonvaEventObject<DragEvent>) => {
    const node = e.target as Konva.Group;
    const next =
      snapMode === 'none' ? { x: node.x(), y: node.y() } : snapBound({ x: node.x(), y: node.y() });
    if (node.x() !== next.x || node.y() !== next.y) {
      node.x(next.x);
      node.y(next.y);
    }
  };

  const handleGroupDragEnd = (e: KonvaEventObject<DragEvent>) => {
    const gx = snapMode === 'none' ? e.target.x() : snap(e.target.x());
    const gy = snapMode === 'none' ? e.target.y() : snap(e.target.y());
    e.target.x(0);
    e.target.y(0);

    setItems((prev) =>
      prev.map((item) =>
        selectedIds.includes(item.id) && !lockedIds.includes(item.id)
          ? { ...item, x: item.x + gx, y: item.y + gy }
          : item,
      ),
    );
  };

  const handleTransform = (id: string) => {
    const node = itemGroupRefs.current.get(id);
    const item = items.find((i) => i.id === id);
    if (!node || !item || lockedIds.includes(id)) return;

    const resizeStep = item.type === 'door' ? 1 : GRID;
    const minResize = item.type === 'door' ? DOOR_RESIZE_MIN : GRID;

    const sx = node.scaleX();
    const sy = node.scaleY();
    const snappedWidth = Math.max(minResize, snapByStep(item.width * sx, resizeStep));
    const snappedHeight = Math.max(minResize, snapByStep(item.height * sy, resizeStep));
    const snappedX = snapByStep(node.x(), resizeStep);
    const snappedY = snapByStep(node.y(), resizeStep);

    node.x(snappedX);
    node.y(snappedY);
    node.scaleX(snappedWidth / item.width);
    node.scaleY(snappedHeight / item.height);
  };

  const handleTransformEnd = (id: string) => {
    const node = itemGroupRefs.current.get(id);
    if (!node || lockedIds.includes(id)) return;

    const sx = node.scaleX();
    const sy = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);

    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (!item) return prev;

      const resizeStep = item.type === 'door' ? 1 : GRID;
      const minResize = item.type === 'door' ? DOOR_RESIZE_MIN : GRID;

      const nx = snapByStep(node.x(), resizeStep);
      const ny = snapByStep(node.y(), resizeStep);
      const nw = Math.max(minResize, snapByStep(item.width * sx, resizeStep));
      const nh = Math.max(minResize, snapByStep(item.height * sy, resizeStep));

      node.x(nx);
      node.y(ny);

      return prev.map((i) => (i.id === id ? { ...i, x: nx, y: ny, width: nw, height: nh } : i));
    });

    trRef.current?.forceUpdate();
    node.getLayer()?.batchDraw();
  };

  const handleAlign = (mode: AlignMode) => {
    if (selectedIds.length < 2) return;
    const selectedItems = items.filter((i) => selectedIds.includes(i.id));
    if (selectedItems.length < 2) return;

    const left = Math.min(...selectedItems.map((i) => i.x));
    const right = Math.max(...selectedItems.map((i) => i.x + i.width));
    const top = Math.min(...selectedItems.map((i) => i.y));
    const bottom = Math.max(...selectedItems.map((i) => i.y + i.height));
    const hCenter = (left + right) / 2;
    const vCenter = (top + bottom) / 2;

    setItems((prev) =>
      prev.map((item) => {
        if (!selectedIds.includes(item.id) || lockedIds.includes(item.id)) return item;

        if (mode === 'left') return { ...item, x: snap(left) };
        if (mode === 'right') return { ...item, x: snap(right - item.width) };
        if (mode === 'h-center') return { ...item, x: snap(hCenter - item.width / 2) };
        if (mode === 'top') return { ...item, y: snap(top) };
        if (mode === 'bottom') return { ...item, y: snap(bottom - item.height) };
        return { ...item, y: snap(vCenter - item.height / 2) };
      }),
    );
  };

  const handleDistribute = (mode: DistributeMode) => {
    if (selectedIds.length < 3) return;
    const selectedItems = items
      .filter((i) => selectedIds.includes(i.id) && !lockedIds.includes(i.id))
      .sort((a, b) => (mode === 'horizontal' ? a.x - b.x : a.y - b.y));

    if (selectedItems.length < 3) return;

    if (mode === 'horizontal') {
      const minX = selectedItems[0].x;
      const maxX = selectedItems[selectedItems.length - 1].x;
      const step = (maxX - minX) / (selectedItems.length - 1);
      const map = new Map<string, number>();
      selectedItems.forEach((item, idx) => map.set(item.id, snap(minX + step * idx)));
      setItems((prev) =>
        prev.map((item) => (map.has(item.id) ? { ...item, x: map.get(item.id)! } : item)),
      );
      return;
    }

    const minY = selectedItems[0].y;
    const maxY = selectedItems[selectedItems.length - 1].y;
    const step = (maxY - minY) / (selectedItems.length - 1);
    const map = new Map<string, number>();
    selectedItems.forEach((item, idx) => map.set(item.id, snap(minY + step * idx)));
    setItems((prev) =>
      prev.map((item) => (map.has(item.id) ? { ...item, y: map.get(item.id)! } : item)),
    );
  };

  const bringToFront = () => {
    if (selectedIds.length === 0) return;
    setItems((prev) => {
      const selected = prev.filter((i) => selectedIds.includes(i.id));
      const rest = prev.filter((i) => !selectedIds.includes(i.id));
      return [...rest, ...selected];
    });
  };

  const sendToBack = () => {
    if (selectedIds.length === 0) return;
    setItems((prev) => {
      const selected = prev.filter((i) => selectedIds.includes(i.id));
      const rest = prev.filter((i) => !selectedIds.includes(i.id));
      return [...selected, ...rest];
    });
  };

  const toggleLocked = (id: string) => {
    setLockedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectedLock = () => {
    if (selectedIds.length === 0) return;
    setLockedIds((prev) => {
      const set = new Set(prev);
      selectedIds.forEach((id) => {
        if (set.has(id)) set.delete(id);
        else set.add(id);
      });
      return Array.from(set);
    });
  };

  const handleGroupRooms = () => {
    const selectedRooms = items.filter(
      (item) => selectedIds.includes(item.id) && item.type === 'room',
    );
    if (selectedRooms.length < 2) return;
    const selectedSet = new Set(selectedRooms.map((r) => r.id));
    const groupId = getNextRoomGroupId(items);
    setItems((prev) =>
      prev.map((item) =>
        selectedSet.has(item.id) && item.type === 'room' ? { ...item, roomGroupId: groupId } : item,
      ),
    );
  };

  const handleUngroupRooms = () => {
    const selectedSet = new Set(
      items.filter((i) => selectedIds.includes(i.id) && i.type === 'room').map((r) => r.id),
    );
    if (selectedSet.size === 0) return;
    setItems((prev) =>
      prev.map((item) =>
        selectedSet.has(item.id) && item.type === 'room'
          ? { ...item, roomGroupId: undefined }
          : item,
      ),
    );
  };

  const handleWallThicknessChange = (value: number) => {
    if (!Number.isFinite(value)) return;
    setWallThickness(clamp(Math.round(value), WALL_THICKNESS_MIN, WALL_THICKNESS_MAX));
  };

  const handleCornerRadiusChange = (value: number) => {
    if (!Number.isFinite(value) || selectedIds.length !== 1) return;
    const selectedId = selectedIds[0];
    setItems((prev) => {
      const current = prev.find((item) => item.id === selectedId);
      if (!current) return prev;
      const maxRadius = Math.floor(Math.min(current.width, current.height) / 2);
      const nextRadius = clamp(Math.round(value), 0, maxRadius);
      return prev.map((item) =>
        item.id === selectedId ? { ...item, cornerRadius: nextRadius } : item,
      );
    });
  };

  const handleRotateTv90 = () => {
    if (!singleItem || singleItem.type !== 'tv') return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === singleItem.id ? { ...item, rotation: ((item.rotation ?? 0) + 90) % 360 } : item,
      ),
    );
  };

  const handleAssignMemberToChairById = (memberId: string) => {
    if (!singleItem || singleItem.type !== 'chair') return;
    if (memberId === '__unassigned__') {
      handleUnassignMemberFromChair();
      return;
    }
    const member = memberOptions.find((m) => m.id === memberId);
    if (!member) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === singleItem.id
          ? {
              ...item,
              assignedMemberId: member.id,
              assignedMemberEmail: member.email,
              assignedMemberAvatar: member.avatarUrl,
            }
          : item,
      ),
    );
  };

  const handleUnassignMemberFromChair = () => {
    if (!singleItem || singleItem.type !== 'chair') return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === singleItem.id
          ? {
              ...item,
              assignedMemberId: undefined,
              assignedMemberEmail: undefined,
              assignedMemberAvatar: undefined,
            }
          : item,
      ),
    );
  };

  const renderItem = (item: WorkspaceItem, inMultiGroup: boolean) => {
    const s = STYLES[item.type];
    const isSelected = selectedIds.includes(item.id);
    const isRoom = item.type === 'room';
    const isChair = item.type === 'chair';
    const isLocked = lockedIds.includes(item.id);
    const baseCornerRadius = item.cornerRadius ?? s.cornerRadius;
    const cornerRadius = isRoom
      ? (roomCornerRadiusMap.get(item.id) ?? baseCornerRadius)
      : baseCornerRadius;
    const strokeWidth = isRoom ? wallThickness : s.strokeWidth;
    const isTv = item.type === 'tv';
    const chairHandle = isChair ? normalizeEmailHandle(item.assignedMemberEmail) : '';
    const chairAvatarImage =
      isChair && item.assignedMemberAvatar ? avatarImageMap[item.assignedMemberAvatar] : undefined;
    const hasChairMember = isChair && Boolean(item.assignedMemberId);
    const fontSize = isRoom ? 12 : item.type === 'desk' ? 11 : hasChairMember ? 8 : 9;
    const labelY = isRoom ? 6 : item.height / 2 - fontSize / 2 - 2;
    const tvRotation = isTv ? (item.rotation ?? 0) : 0;
    const tvScreenWidth = Math.max(8, item.width - 8);
    const tvScreenHeight = Math.max(8, item.height - 16);
    const chairDisplayName = hasChairMember
      ? chairHandle.length > 10
        ? `${chairHandle.slice(0, 10)}…`
        : chairHandle
      : item.name;
    const chairInitials = chairDisplayName.slice(0, 2).toUpperCase();
    const chairAvatarRadius = 11;
    const chairAvatarCenterY = 13;
    const chairNameBarY = Math.max(item.height - 15, 23);

    return (
      <Group
        key={item.id}
        ref={
          inMultiGroup
            ? undefined
            : (node) => {
                if (node) itemGroupRefs.current.set(item.id, node);
                else itemGroupRefs.current.delete(item.id);
              }
        }
        x={item.x}
        y={item.y}
        draggable={!isViewOnly && !inMultiGroup && tool === 'select' && !isLocked}
        dragBoundFunc={
          !isViewOnly && !inMultiGroup && item.type !== 'door' && snapMode !== 'none'
            ? snapBound
            : undefined
        }
        onClick={!isViewOnly ? (e) => handleItemClick(item.id, e) : undefined}
        onTap={
          !isViewOnly
            ? (e) => handleItemClick(item.id, e as unknown as KonvaEventObject<MouseEvent>)
            : undefined
        }
        onContextMenu={!isViewOnly ? (e) => handleItemContextMenu(item.id, e) : undefined}
        onDblClick={() => {
          if (isViewOnly) return;
          if (isLocked) return;
          setSelectedIds([item.id]);
          setEditingId(item.id);
          setEditName(item.name);
        }}
        onDragMove={!isViewOnly && !inMultiGroup ? (e) => handleSingleDragMove(item.id, e) : undefined}
        onDragEnd={!isViewOnly && !inMultiGroup ? (e) => handleSingleDragEnd(item.id, e) : undefined}
        onTransform={!isViewOnly && !inMultiGroup ? () => handleTransform(item.id) : undefined}
        onTransformEnd={!isViewOnly && !inMultiGroup ? () => handleTransformEnd(item.id) : undefined}
      >
        <Rect
          x={0}
          y={0}
          width={item.width}
          height={item.height}
          fill={isTv ? 'rgba(0,0,0,0)' : presentationMode ? '#f8fafc' : s.fill}
          stroke={isTv ? 'rgba(0,0,0,0)' : isSelected ? '#4f46e5' : isRoom ? '#334155' : s.stroke}
          strokeWidth={isTv ? 0 : isSelected ? Math.max(2.5, strokeWidth + 0.5) : strokeWidth}
          cornerRadius={cornerRadius}
          opacity={isLocked ? 0.82 : 1}
          shadowEnabled={isSelected && !presentationMode && !isTv}
          shadowColor="rgba(79,70,229,0.3)"
          shadowBlur={11}
          shadowOffsetY={3}
        />
        {isTv && (
          <Group x={item.width / 2} y={item.height / 2} rotation={tvRotation} listening={false}>
            <Rect
              x={-tvScreenWidth / 2}
              y={-tvScreenHeight / 2 - 2}
              width={tvScreenWidth}
              height={tvScreenHeight}
              cornerRadius={Math.max(2, Math.min(4, (item.cornerRadius ?? s.cornerRadius) / 2))}
              fill="#0F172A"
              stroke="#6366F1"
              strokeWidth={1}
              listening={false}
            />
            <Line
              points={[-10, tvScreenHeight / 2 + 4, 10, tvScreenHeight / 2 + 4]}
              stroke="#4338CA"
              strokeWidth={2}
              listening={false}
            />
          </Group>
        )}
        {hasChairMember && (
          <Group x={item.width / 2} y={chairAvatarCenterY} listening={false}>
            <Circle
              x={0}
              y={0}
              radius={chairAvatarRadius}
              fill={chairAvatarImage ? undefined : '#1DB87A'}
              fillPriority={chairAvatarImage ? 'pattern' : 'linear-gradient'}
              fillLinearGradientStartPoint={
                chairAvatarImage ? undefined : { x: -chairAvatarRadius, y: -chairAvatarRadius }
              }
              fillLinearGradientEndPoint={
                chairAvatarImage ? undefined : { x: chairAvatarRadius, y: chairAvatarRadius }
              }
              fillLinearGradientColorStops={
                chairAvatarImage ? undefined : [0, '#1DB87A', 1, '#0E474E']
              }
              fillPatternImage={chairAvatarImage}
              fillPatternScale={
                chairAvatarImage
                  ? {
                      x: 20 / chairAvatarImage.width,
                      y: 20 / chairAvatarImage.height,
                    }
                  : undefined
              }
              fillPatternOffset={
                chairAvatarImage
                  ? {
                      x: chairAvatarImage.width / 2,
                      y: chairAvatarImage.height / 2,
                    }
                  : undefined
              }
            />
            {!chairAvatarImage && (
              <Text
                x={-chairAvatarRadius}
                y={-chairAvatarRadius}
                width={chairAvatarRadius * 2}
                height={chairAvatarRadius * 2}
                verticalAlign="middle"
                text={chairInitials}
                fontSize={9}
                fontStyle="bold"
                fill="#FFFFFF"
                align="center"
                listening={false}
              />
            )}
          </Group>
        )}
        {hasChairMember && (
          <Rect
            x={3}
            y={chairNameBarY}
            width={Math.max(10, item.width - 6)}
            height={12}
            fill="rgba(255,255,255,0.92)"
            stroke="rgba(34,197,94,0.35)"
            strokeWidth={0.7}
            cornerRadius={6}
            listening={false}
          />
        )}
        <Text
          x={hasChairMember ? 3 : 0}
          y={hasChairMember ? chairNameBarY : labelY}
          width={hasChairMember ? Math.max(10, item.width - 6) : item.width}
          height={hasChairMember ? 12 : undefined}
          verticalAlign={hasChairMember ? 'middle' : undefined}
          text={chairDisplayName}
          fontSize={fontSize}
          fontStyle={isRoom ? 'bold' : 'normal'}
          fill={isRoom ? '#334155' : s.stroke}
          align="center"
          padding={hasChairMember ? 0 : 4}
          listening={false}
          ellipsis
          wrap="none"
        />
      </Group>
    );
  };

  const selectedRooms = items.filter((i) => selectedIds.includes(i.id) && i.type === 'room');
  const canGroupRooms = selectedRooms.length >= 2;
  const canUngroupRooms = selectedRooms.some((r) => r.roomGroupId);

  const paletteCommands = [
    { id: 'save', label: 'Save layout', run: () => void handleSave() },
    { id: 'select', label: 'Tool: Select', run: () => setTool('select') },
    { id: 'draw-room', label: 'Tool: Draw room', run: () => setTool('room') },
    { id: 'add-door', label: 'Tool: Add door', run: () => setTool('door') },
    { id: 'add-desk', label: 'Tool: Add desk', run: () => setTool('desk') },
    { id: 'add-chair', label: 'Tool: Add chair', run: () => setTool('chair') },
    { id: 'add-tv', label: 'Tool: Add TV', run: () => setTool('tv') },
    { id: 'snap-smart', label: 'Snap: Smart', run: () => setSnapMode('smart') },
    { id: 'snap-grid', label: 'Snap: Grid', run: () => setSnapMode('grid') },
    { id: 'snap-none', label: 'Snap: Free', run: () => setSnapMode('none') },
    { id: 'toggle-grid', label: 'Toggle grid', run: () => setShowGrid((v) => !v) },
    { id: 'present', label: 'Toggle presentation mode', run: () => setPresentationMode((v) => !v) },
    { id: 'group-rooms', label: 'Group selected rooms', run: () => handleGroupRooms() },
    { id: 'ungroup-rooms', label: 'Ungroup selected rooms', run: () => handleUngroupRooms() },
    { id: 'delete', label: 'Delete selected items', run: () => handleDelete() },
  ];

  const filteredCommands = paletteCommands.filter((command) =>
    command.label.toLowerCase().includes(commandQuery.trim().toLowerCase()),
  );

  return (
    <div className="relative flex h-full flex-col bg-slate-100">
      {!isViewOnly && <div className="shrink-0 border-b border-slate-300 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Floor Plan</span>
            <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-700">
              {selectedIds.length > 0 ? `${selectedIds.length} selected` : `${items.length} items`}
            </Badge>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
            <Button
              size="sm"
              variant={tool === 'select' ? 'default' : 'ghost'}
              onClick={() => setTool('select')}
              className="h-8 px-2"
              title="Select (V)"
            >
              <MousePointer2 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'room' ? 'default' : 'ghost'}
              onClick={() => setTool('room')}
              className="h-8 px-2"
              title="Draw room (R)"
            >
              <Square className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'door' ? 'default' : 'ghost'}
              onClick={() => setTool('door')}
              className="h-8 px-2 text-xs"
              title="Add door (O)"
            >
              Door
            </Button>
            <Button
              size="sm"
              variant={tool === 'desk' ? 'default' : 'ghost'}
              onClick={() => setTool('desk')}
              className="h-8 px-2"
              title="Add desk (D)"
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={tool === 'chair' ? 'default' : 'ghost'}
              onClick={() => setTool('chair')}
              className="h-8 px-2 text-xs"
              title="Add chair (C)"
            >
              Chair
            </Button>
            <Button
              size="sm"
              variant={tool === 'tv' ? 'default' : 'ghost'}
              onClick={() => setTool('tv')}
              className="h-8 px-2"
              title="Add TV (T)"
            >
              <Monitor className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 p-1">
            <Button
              size="sm"
              variant={snapMode === 'smart' ? 'default' : 'ghost'}
              onClick={() => setSnapMode('smart')}
              className="h-8 px-2 text-xs"
            >
              Smart
            </Button>
            <Button
              size="sm"
              variant={snapMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setSnapMode('grid')}
              className="h-8 px-2 text-xs"
            >
              Grid
            </Button>
            <Button
              size="sm"
              variant={snapMode === 'none' ? 'default' : 'ghost'}
              onClick={() => setSnapMode('none')}
              className="h-8 px-2 text-xs"
            >
              Free
            </Button>
          </div>

          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
            <Label htmlFor="wall-thickness" className="text-xs text-slate-600">
              Wall
            </Label>
            <input
              id="wall-thickness"
              type="range"
              min={WALL_THICKNESS_MIN}
              max={WALL_THICKNESS_MAX}
              step={1}
              value={wallThickness}
              onChange={(e) => handleWallThicknessChange(Number(e.target.value))}
              className="h-1.5 w-16 accent-slate-700"
            />
            <Input
              type="number"
              min={WALL_THICKNESS_MIN}
              max={WALL_THICKNESS_MAX}
              value={wallThickness}
              onChange={(e) => handleWallThicknessChange(Number(e.target.value))}
              className="h-7 w-11 px-1 text-center text-xs"
            />
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Button
              size="sm"
              variant={showGrid ? 'outline' : 'ghost'}
              onClick={() => setShowGrid((v) => !v)}
              className="h-8 px-2 text-xs"
            >
              Grid
            </Button>
            <Button
              size="sm"
              variant={presentationMode ? 'default' : 'outline'}
              onClick={() => setPresentationMode((v) => !v)}
              className="h-8 px-2 text-xs"
            >
              <Presentation className="mr-1 h-4 w-4" /> Present
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGroupRooms}
              disabled={!canGroupRooms}
              className="h-8 px-2 text-xs"
            >
              Group
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleUngroupRooms}
              disabled={!canUngroupRooms}
              className="h-8 px-2 text-xs"
            >
              Ungroup
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={bringToFront}
              disabled={selectedIds.length === 0}
              className="h-8 px-2 text-xs"
            >
              Front
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={sendToBack}
              disabled={selectedIds.length === 0}
              className="h-8 px-2 text-xs"
            >
              Back
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDuplicate}
              disabled={selectedIds.length !== 1}
              className="h-8 px-2 text-xs border-indigo-300 text-indigo-600"
            >
              <Copy className="mr-1 h-4 w-4" /> Dup
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={toggleSelectedLock}
              disabled={selectedIds.length === 0}
              className="h-8 px-2 text-xs border-amber-300 text-amber-700"
            >
              <Lock className="mr-1 h-4 w-4" /> Lock
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleDelete}
              disabled={selectedIds.length === 0}
              className="h-8 px-2 text-xs border-rose-300 text-rose-600"
            >
              <Trash2 className="mr-1 h-4 w-4" /> Del
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleSave}
              disabled={saveStatus === 'saving' || saveStatus === 'loading'}
              className="h-8 px-2 text-xs border-emerald-300 text-emerald-700"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              ) : saveStatus === 'saved' ? (
                <Cloud className="mr-1 h-4 w-4" />
              ) : saveStatus === 'error' ? (
                <CloudOff className="mr-1 h-4 w-4" />
              ) : (
                <Save className="mr-1 h-4 w-4" />
              )}
              {saveStatus === 'saving'
                ? 'Saving'
                : saveStatus === 'saved'
                  ? 'Saved'
                  : saveStatus === 'error'
                    ? 'Error'
                    : 'Save'}
            </Button>
          </div>
        </div>
      </div>}

      <div className="flex min-h-0 flex-1">
        <div className="relative min-h-0 flex-1 overflow-hidden bg-slate-50">
          <div className="absolute left-3 top-3 z-20 rounded-lg border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur-sm">
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant={view3D ? 'ghost' : 'default'}
                onClick={() => setView3D(false)}
                className="h-7 px-3 text-xs"
              >
                2D
              </Button>
              <Button
                size="sm"
                variant={view3D ? 'default' : 'ghost'}
                onClick={() => setView3D(true)}
                className="h-7 px-3 text-xs"
              >
                3D
              </Button>
            </div>
          </div>

          {view3D ? (
            <WorkspaceMap3D items={items} />
          ) : (
            <>
              <div ref={containerRef} className="h-full w-full" style={{ cursor: stageCursor }}>
                <Stage
                  ref={stageRef}
                  width={stageSize.width}
                  height={stageSize.height}
                  x={viewport.x}
                  y={viewport.y}
                  scaleX={viewport.scale}
                  scaleY={viewport.scale}
                  onWheel={handleStageWheel}
                  onDragMove={handleStageDragMove}
                  onMouseDown={handleStageMouseDown}
                  onMouseMove={handleStageMouseMove}
                  onMouseUp={handleStageMouseUp}
                  onMouseLeave={handleStageMouseUp}
                >
                  <Layer>
                    {!isViewOnly && gridLines}

                    {flatItems.map((item) => renderItem(item, false))}

                    {!isViewOnly && isMultiSelect && (
                      <Group
                        ref={multiGroupRef}
                        draggable
                        dragBoundFunc={snapMode === 'none' ? undefined : snapBound}
                        onDragMove={handleGroupDragMove}
                        onDragEnd={handleGroupDragEnd}
                      >
                        {groupedItems.map((item) => renderItem(item, true))}
                      </Group>
                    )}

                    {!isViewOnly && !presentationMode && drawRect && (
                      <Rect
                        x={drawRect.x}
                        y={drawRect.y}
                        width={drawRect.width}
                        height={drawRect.height}
                        fill="rgba(59,130,246,0.08)"
                        stroke="#3B82F6"
                        strokeWidth={2}
                        dash={[8, 4]}
                        cornerRadius={6}
                      />
                    )}

                    {!isViewOnly && !presentationMode && selBox && (
                      <Rect
                        x={selBox.x}
                        y={selBox.y}
                        width={selBox.width}
                        height={selBox.height}
                        fill="rgba(79,70,229,0.08)"
                        stroke="#4f46e5"
                        strokeWidth={1}
                        dash={[4, 3]}
                      />
                    )}

                    {!isViewOnly && <Transformer
                      ref={trRef}
                      borderStroke="#4f46e5"
                      borderStrokeWidth={1.5}
                      anchorStroke="#4f46e5"
                      anchorFill="#fff"
                      anchorSize={9}
                      anchorCornerRadius={3}
                      rotateEnabled={false}
                      keepRatio={false}
                      enabledAnchors={singleItem && lockedIds.includes(singleItem.id) ? [] : undefined}
                      boundBoxFunc={(old, nb) => {
                        const isDoorSelected = singleItem?.type === 'door';
                        const resizeStep = isDoorSelected ? 1 : GRID;
                        const minResize = isDoorSelected ? DOOR_RESIZE_MIN : GRID;
                        const snapped = {
                          ...nb,
                          x: snapByStep(nb.x, resizeStep),
                          y: snapByStep(nb.y, resizeStep),
                          width: Math.max(minResize, snapByStep(nb.width, resizeStep)),
                          height: Math.max(minResize, snapByStep(nb.height, resizeStep)),
                        };
                        return snapped.width < minResize || snapped.height < minResize ? old : snapped;
                      }}
                    />}
                  </Layer>
                </Stage>
              </div>

              {!isViewOnly && contextMenu.open && (
                <div
                  className="fixed z-50 min-w-44 rounded-md border border-slate-200 bg-white p-1.5 shadow-lg"
                  style={{ left: contextMenu.x, top: contextMenu.y }}
                >
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                    onClick={handleDuplicate}
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                    onClick={bringToFront}
                  >
                    Bring to Front
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                    onClick={sendToBack}
                  >
                    Send to Back
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-slate-100"
                    onClick={toggleSelectedLock}
                  >
                    Toggle Lock
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1.5 text-left text-xs text-rose-600 hover:bg-rose-50"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {!isViewOnly && <aside
          className={`w-72 shrink-0 border-l border-slate-300 bg-white ${view3D ? 'hidden' : ''}`}
        >
          {singleItem ? (
            <div className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Properties</span>
                <Badge variant="outline" className="text-xs">
                  {LABEL_PREFIXES[singleItem.type]}
                </Badge>
              </div>

              <div>
                <Label className="mb-1 block text-xs text-slate-500">Name</Label>
                {editingId === singleItem.id ? (
                  <div className="flex gap-1">
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') commitName();
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <Button size="sm" className="h-8 w-8 p-0" onClick={commitName}>
                      <Check className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="flex w-full items-center justify-between rounded border border-transparent px-2 py-1.5 hover:border-slate-200 hover:bg-slate-50"
                    onClick={() => {
                      setEditingId(singleItem.id);
                      setEditName(singleItem.name);
                    }}
                  >
                    <span className="truncate text-sm font-medium text-slate-700">
                      {singleItem.name}
                    </span>
                    <Pencil className="h-3 w-3 text-slate-400" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  X: {Math.round(singleItem.x)}
                </div>
                <div className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  Y: {Math.round(singleItem.y)}
                </div>
                <div className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  W: {Math.round(singleItem.width)}
                </div>
                <div className="rounded border bg-slate-50 px-2 py-1 text-xs text-slate-600">
                  H: {Math.round(singleItem.height)}
                </div>
              </div>

              <div>
                <Label className="mb-1 block text-xs text-slate-500">Border Radius</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={Math.floor(Math.min(singleItem.width, singleItem.height) / 2)}
                    step={1}
                    value={singleItem.cornerRadius ?? STYLES[singleItem.type].cornerRadius}
                    onChange={(e) => handleCornerRadiusChange(Number(e.target.value))}
                    className="h-1.5 flex-1 accent-indigo-600"
                  />
                  <Input
                    type="number"
                    min={0}
                    max={Math.floor(Math.min(singleItem.width, singleItem.height) / 2)}
                    value={singleItem.cornerRadius ?? STYLES[singleItem.type].cornerRadius}
                    onChange={(e) => handleCornerRadiusChange(Number(e.target.value))}
                    className="h-8 w-16 px-1 text-center text-xs"
                  />
                </div>
              </div>

              {singleItem.type === 'room' && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-2 text-xs text-slate-600">
                  Room wall is controlled globally from top toolbar.
                </div>
              )}

              {singleItem.type === 'tv' && (
                <div className="space-y-2">
                  <div className="rounded-md border border-indigo-200 bg-indigo-50 p-2 text-xs text-indigo-700">
                    Góc xoay hiện tại: {singleItem.rotation ?? 0}°
                  </div>
                  <Button variant="outline" size="sm" onClick={handleRotateTv90} className="w-full">
                    <Monitor className="mr-2 h-4 w-4" /> Xoay +90°
                  </Button>
                </div>
              )}

              {singleItem.type === 'chair' && (
                <div className="space-y-2 rounded-md border border-emerald-200 bg-emerald-50/60 p-2">
                  <Label className="text-xs text-emerald-700">Gán thành viên từ Employees</Label>
                  {singleItem.assignedMemberEmail ? (
                    <div className="rounded border border-emerald-200 bg-white px-2 py-1 text-xs text-emerald-700">
                      Đang gán:{' '}
                      <strong>{normalizeEmailHandle(singleItem.assignedMemberEmail)}</strong>
                      <div className="truncate text-[11px] text-emerald-600">
                        {singleItem.assignedMemberEmail}
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-emerald-700">Chưa gán thành viên cho ghế này</div>
                  )}
                  <Combobox
                    disabled={isLoadingMembers}
                    className="h-8 w-full text-xs"
                    placeholder={isLoadingMembers ? 'Đang tải users...' : 'Chọn member'}
                    searchPlaceholder="Tìm member..."
                    emptyText="Không có member phù hợp"
                    value={chairAssignee ?? '__unassigned__'}
                    onValueChange={handleAssignMemberToChairById}
                    options={[
                      { value: '__unassigned__', label: '-- Bỏ gán --' },
                      ...memberOptions.map((member) => ({
                        value: member.id,
                        label: `${member.handle} (${member.email})`,
                      })),
                    ]}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUnassignMemberFromChair}
                    disabled={!singleItem.assignedMemberId}
                    className="w-full"
                  >
                    Bỏ gán member
                  </Button>
                </div>
              )}

              <Separator />

              <Button variant="outline" size="sm" onClick={handleDuplicate}>
                <Copy className="mr-2 h-4 w-4" /> Duplicate
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleLocked(singleItem.id)}
                className="border-amber-300 text-amber-700"
              >
                {lockedIds.includes(singleItem.id) ? (
                  <Unlock className="mr-2 h-4 w-4" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                {lockedIds.includes(singleItem.id) ? 'Unlock' : 'Lock'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="border-rose-300 text-rose-600"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            </div>
          ) : isMultiSelect ? (
            <div className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Selection</span>
                <Badge variant="outline">{selectedIds.length}</Badge>
              </div>

              <div className="rounded-md border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-700">
                Multi-select active. Use align/distribute in toolbar or drag as group.
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button size="sm" variant="outline" onClick={() => handleAlign('left')}>
                  Left
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAlign('right')}>
                  Right
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAlign('top')}>
                  Top
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleAlign('bottom')}>
                  Bottom
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDistribute('horizontal')}>
                  Dist H
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleDistribute('vertical')}>
                  Dist V
                </Button>
              </div>

              <Separator />
              <Button
                variant="outline"
                size="sm"
                onClick={handleDelete}
                className="border-rose-300 text-rose-600"
              >
                <Trash2 className="mr-2 h-4 w-4" /> Delete ({selectedIds.length})
              </Button>
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-slate-400">
              <MousePointer2 className="h-8 w-8 opacity-30" />
              <p className="text-xs">Select an item to inspect properties</p>
              <div className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-xs text-slate-500">
                <p className="mb-2 font-medium text-slate-600">Shortcuts</p>
                <div className="space-y-1">
                  <div>V: Select</div>
                  <div>R: Draw room</div>
                  <div>O: Add door</div>
                  <div>D/C/T: Add desk/chair/tv</div>
                  <div>Ctrl/Cmd + D: Duplicate</div>
                  <div>Ctrl/Cmd + A: Select all visible</div>
                  <div>L: Toggle lock selected</div>
                  <div>G: Group selected rooms</div>
                  <div>Space + Drag: Pan</div>
                </div>
              </div>
            </div>
          )}
        </aside>}
      </div>

      {!isViewOnly && <div className="flex shrink-0 items-center gap-3 border-t border-slate-300 bg-white px-4 py-1.5 text-xs text-slate-500">
        <span className="font-medium text-slate-700">
          {tool !== 'select'
            ? tool === 'room'
              ? 'Draw Room Mode'
              : tool === 'door'
                ? 'Add Door Mode'
                : tool === 'desk'
                  ? 'Add Desk Mode'
                  : tool === 'chair'
                    ? 'Add Chair Mode'
                    : 'Add TV Mode'
            : selectedIds.length > 1
              ? `Group selected: ${selectedIds.length}`
              : selectedIds.length === 1
                ? 'Single selected - resize enabled'
                : 'Ready'}
        </span>
        <span>Zoom: {Math.round(viewport.scale * 100)}%</span>
        <span>Snap: {snapMode}</span>
        <span>Grid: {showGrid ? 'on' : 'off'}</span>
        <span>Presentation: {presentationMode ? 'on' : 'off'}</span>
        <span className="ml-auto">
          Visible: {visibleItems.length} / {items.length}
        </span>
      </div>}

      {!isViewOnly && showCommandPalette && (
        <div className="absolute inset-0 z-[60] flex items-start justify-center bg-slate-900/30 pt-24">
          <div className="w-[560px] rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="border-b p-3">
              <Input
                value={commandQuery}
                onChange={(e) => setCommandQuery(e.target.value)}
                placeholder="Command Palette... (Ctrl/Cmd + /)"
                autoFocus
              />
            </div>
            <div className="max-h-80 overflow-auto p-2">
              {filteredCommands.length === 0 && (
                <div className="rounded px-3 py-2 text-sm text-slate-400">No command found</div>
              )}
              {filteredCommands.map((command) => (
                <button
                  key={command.id}
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-slate-100"
                  onClick={() => {
                    command.run();
                    setShowCommandPalette(false);
                    setCommandQuery('');
                  }}
                >
                  {command.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
