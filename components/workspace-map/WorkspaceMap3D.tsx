'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Bookmark, BookmarkCheck, RotateCcw } from 'lucide-react';
import * as THREE from 'three';
import type { WorkspaceItem } from './types';

const ITEM_H: Record<WorkspaceItem['type'], number> = {
  room: 120,
  door: 96,
  desk: 56,
  chair: 20,
  tv: 44,
};

const WALL_T = 10;
const FLOOR_T = 3;

const DEFAULT_AZIMUTH = Math.PI / 4;
const DEFAULT_ELEVATION = Math.PI / 4;
const CAMERA_STORAGE_KEY = 'workspaceMap3DCamera';

function loadSavedCamera(): { azimuth: number; elevation: number } | null {
  try {
    const raw = localStorage.getItem(CAMERA_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'azimuth' in parsed &&
      'elevation' in parsed &&
      typeof (parsed as Record<string, unknown>).azimuth === 'number' &&
      typeof (parsed as Record<string, unknown>).elevation === 'number'
    ) {
      return parsed as { azimuth: number; elevation: number };
    }
    return null;
  } catch {
    return null;
  }
}

interface WorkspaceMap3DProps {
  items: WorkspaceItem[];
}

type WallSide = 'north' | 'south' | 'east' | 'west';
type WallAxis = 'x' | 'z';

interface WallSegment {
  axis: WallAxis;
  coord: number;
  start: number;
  end: number;
  shared: boolean;
  side?: WallSide;
}

function mergeIntervals(intervals: Array<[number, number]>) {
  if (!intervals.length) return [];

  const sorted = [...intervals]
    .filter(([a, b]) => b - a > 0.001)
    .sort((a, b) => a[0] - b[0]);
  if (!sorted.length) return [];

  const merged: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i += 1) {
    const [start, end] = sorted[i];
    const last = merged[merged.length - 1];
    if (start <= last[1] + 0.001) {
      last[1] = Math.max(last[1], end);
      continue;
    }
    merged.push([start, end]);
  }
  return merged;
}

function subtractIntervals(base: [number, number], cuts: Array<[number, number]>) {
  const [baseStart, baseEnd] = base;
  if (baseEnd - baseStart <= 0.001) return [];

  const mergedCuts = mergeIntervals(
    cuts.map(([start, end]) => [Math.max(start, baseStart), Math.min(end, baseEnd)] as [number, number]),
  );
  if (!mergedCuts.length) return [base];

  const result: Array<[number, number]> = [];
  let cursor = baseStart;
  for (const [start, end] of mergedCuts) {
    if (start - cursor > 0.001) result.push([cursor, start]);
    cursor = Math.max(cursor, end);
  }
  if (baseEnd - cursor > 0.001) result.push([cursor, baseEnd]);
  return result;
}

function wallColor(segment: WallSegment) {
  if (segment.shared) return '#E1ECF7';
  if (segment.side === 'north' || segment.side === 'south') return '#E8F1FA';
  return '#DCE8F4';
}

function lineKey(axis: WallAxis, coord: number) {
  return `${axis}:${coord.toFixed(3)}`;
}

function CameraRig({
  azimuth,
  elevation,
  target,
  radius,
}: {
  azimuth: number;
  elevation: number;
  target: THREE.Vector3;
  radius: number;
}) {
  const { camera } = useThree();

  useEffect(() => {
    const sinA = Math.sin(azimuth);
    const cosA = Math.cos(azimuth);
    const sinE = Math.sin(elevation);
    const cosE = Math.cos(elevation);

    camera.position.set(
      target.x + radius * sinA * cosE,
      target.y + radius * sinE,
      target.z + radius * cosA * cosE,
    );
    camera.lookAt(target);
    camera.updateProjectionMatrix();
  }, [camera, azimuth, elevation, target, radius]);

  return null;
}

function WallMesh({ segment }: { segment: WallSegment }) {
  const wh = ITEM_H.room;
  const len = segment.end - segment.start;
  if (len <= 0.001) return null;

  if (segment.axis === 'x') {
    const zOffset = segment.shared ? 0 : segment.side === 'north' ? WALL_T / 2 : -WALL_T / 2;
    return (
      <mesh
        position={[segment.start + len / 2, wh / 2, segment.coord + zOffset]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[len, wh, WALL_T]} />
        <meshStandardMaterial color={wallColor(segment)} roughness={0.9} metalness={0.02} />
      </mesh>
    );
  }

  const xOffset = segment.shared ? 0 : segment.side === 'west' ? WALL_T / 2 : -WALL_T / 2;
  return (
    <mesh position={[segment.coord + xOffset, wh / 2, segment.start + len / 2]} castShadow receiveShadow>
      <boxGeometry args={[WALL_T, wh, len]} />
      <meshStandardMaterial color={wallColor(segment)} roughness={0.9} metalness={0.02} />
    </mesh>
  );
}

function RoomMesh({ item, walls }: { item: WorkspaceItem; walls: WallSegment[] }) {
  const w = item.width;
  const h = item.height;

  return (
    <>
      <mesh position={[item.x + w / 2, FLOOR_T / 2, item.y + h / 2]} castShadow receiveShadow>
        <boxGeometry args={[w, FLOOR_T, h]} />
        <meshStandardMaterial color="#D8C1A0" roughness={0.9} metalness={0.02} />
      </mesh>
      {walls.map((segment, idx) => (
        <WallMesh
          key={`${item.id}:${segment.axis}:${segment.coord}:${segment.start}:${segment.end}:${idx}`}
          segment={segment}
        />
      ))}
    </>
  );
}

function furnitureColor(item: WorkspaceItem) {
  if (item.type === 'desk') return '#CFA67E';
  if (item.type === 'door') return '#E6EEF7';
  if (item.type === 'chair') return item.assignedMemberId ? '#7EC3A3' : '#D9DEE4';
  return '#1E2535';
}

function FurnitureMesh({ item }: { item: WorkspaceItem }) {
  const w = item.width;
  const h = item.height;

  if (item.type === 'door') {
    const isHorizontal = w >= h;
    const frameDepth = isHorizontal ? h : w;
    const openingSpan = isHorizontal ? w : h;
    const postThickness = Math.max(2, Math.min(6, openingSpan * 0.12));
    const frameHeight = ITEM_H.room;
    const lintelThickness = Math.max(2.4, Math.min(6, frameHeight * 0.12));
    const clearHeight = frameHeight - lintelThickness;

    return (
      <group position={[item.x + w / 2, 0, item.y + h / 2]}>
        {isHorizontal ? (
          <>
            <mesh position={[-w / 2 + postThickness / 2, clearHeight / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[postThickness, clearHeight, frameDepth]} />
              <meshStandardMaterial color="#E6EEF8" roughness={0.78} metalness={0.03} />
            </mesh>
            <mesh position={[w / 2 - postThickness / 2, clearHeight / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[postThickness, clearHeight, frameDepth]} />
              <meshStandardMaterial color="#E6EEF8" roughness={0.78} metalness={0.03} />
            </mesh>
            <mesh position={[0, clearHeight + lintelThickness / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[w, lintelThickness, frameDepth]} />
              <meshStandardMaterial color="#D8E4F3" roughness={0.75} metalness={0.04} />
            </mesh>
          </>
        ) : (
          <>
            <mesh position={[0, clearHeight / 2, -h / 2 + postThickness / 2]} castShadow receiveShadow>
              <boxGeometry args={[frameDepth, clearHeight, postThickness]} />
              <meshStandardMaterial color="#E6EEF8" roughness={0.78} metalness={0.03} />
            </mesh>
            <mesh position={[0, clearHeight / 2, h / 2 - postThickness / 2]} castShadow receiveShadow>
              <boxGeometry args={[frameDepth, clearHeight, postThickness]} />
              <meshStandardMaterial color="#E6EEF8" roughness={0.78} metalness={0.03} />
            </mesh>
            <mesh position={[0, clearHeight + lintelThickness / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[frameDepth, lintelThickness, h]} />
              <meshStandardMaterial color="#D8E4F3" roughness={0.75} metalness={0.04} />
            </mesh>
          </>
        )}

        <mesh position={[0, 0.2, 0]} receiveShadow>
          <boxGeometry args={[isHorizontal ? w : frameDepth, 0.4, isHorizontal ? frameDepth : h]} />
          <meshStandardMaterial color="#C89261" roughness={0.88} metalness={0.02} />
        </mesh>
      </group>
    );
  }

  const fh = ITEM_H[item.type];
  const yaw = item.type === 'tv' ? -THREE.MathUtils.degToRad(item.rotation ?? 0) : 0;

  const topY = fh + 0.2;
  const hasAssignee = item.type === 'chair' && Boolean(item.assignedMemberId);
  const isTV = item.type === 'tv' && w > 20;

  return (
    <group position={[item.x + w / 2, fh / 2, item.y + h / 2]} rotation={[0, yaw, 0]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[w, fh, h]} />
        <meshStandardMaterial color={furnitureColor(item)} roughness={0.75} metalness={0.05} />
      </mesh>

      {isTV ? (
        <mesh position={[0, topY, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[Math.max(8, w - 6), Math.max(8, h - 6)]} />
          <meshStandardMaterial color="#3B82F6" emissive="#1D4ED8" emissiveIntensity={0.28} />
        </mesh>
      ) : null}

      {hasAssignee ? (
        <mesh position={[0, topY + 2.4, 0]}>
          <sphereGeometry args={[3.2, 18, 18]} />
          <meshStandardMaterial color="#FFFFFF" metalness={0.08} roughness={0.42} />
        </mesh>
      ) : null}
    </group>
  );
}

export function WorkspaceMap3D({ items }: WorkspaceMap3DProps) {
  const [azimuth, setAzimuth] = useState(() => loadSavedCamera()?.azimuth ?? DEFAULT_AZIMUTH);
  const [elevation, setElevation] = useState(() => loadSavedCamera()?.elevation ?? DEFAULT_ELEVATION);
  const [isDragging, setIsDragging] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle');
  const dragRef = useRef<{ sx: number; sy: number; az: number; el: number } | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSaveCamera = (e: React.MouseEvent) => {
    e.stopPropagation();
    localStorage.setItem(CAMERA_STORAGE_KEY, JSON.stringify({ azimuth, elevation }));
    setSaveStatus('saved');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveStatus('idle'), 2000);
  };

  const { normalItems, worldW, worldH } = useMemo(() => {
    if (!items.length) return { normalItems: [], worldW: 400, worldH: 300 };

    const minX = Math.min(...items.map((i) => i.x));
    const minY = Math.min(...items.map((i) => i.y));
    const maxX = Math.max(...items.map((i) => i.x + i.width));
    const maxY = Math.max(...items.map((i) => i.y + i.height));

    const normalItems = items.map((item) => ({
      ...item,
      x: item.x - minX,
      y: item.y - minY,
    }));

    return { normalItems, worldW: maxX - minX, worldH: maxY - minY };
  }, [items]);

  const sortedRooms = useMemo(() => normalItems.filter((i) => i.type === 'room'), [normalItems]);
  const sortedFurniture = useMemo(() => normalItems.filter((i) => i.type !== 'room'), [normalItems]);
  const { roomWallsById, sharedWalls } = useMemo(() => {
    const cutsByRoomSide = new Map<string, Array<[number, number]>>();
    const sharedSegments = new Map<string, WallSegment>();
    const lineCuts = new Map<string, Array<[number, number]>>();
    const rooms = sortedRooms;
    const doors = normalItems.filter((i) => i.type === 'door');
    const EPS = 0.001;
    const DOOR_CUT_TOL = Math.max(WALL_T + 2, 14);

    const pushCut = (roomId: string, side: WallSide, start: number, end: number) => {
      if (end - start <= EPS) return;
      const key = `${roomId}:${side}`;
      const list = cutsByRoomSide.get(key) ?? [];
      list.push([start, end]);
      cutsByRoomSide.set(key, list);
    };

    const pushLineCut = (axis: WallAxis, coord: number, start: number, end: number) => {
      if (end - start <= EPS) return;
      const key = lineKey(axis, coord);
      const list = lineCuts.get(key) ?? [];
      list.push([start, end]);
      lineCuts.set(key, list);
    };

    const addShared = (axis: WallAxis, coord: number, start: number, end: number) => {
      if (end - start <= EPS) return;
      const key = `${axis}:${coord.toFixed(3)}:${start.toFixed(3)}:${end.toFixed(3)}`;
      sharedSegments.set(key, { axis, coord, start, end, shared: true });
    };

    for (let i = 0; i < rooms.length; i += 1) {
      const a = rooms[i];
      for (let j = i + 1; j < rooms.length; j += 1) {
        const b = rooms[j];

        if (Math.abs(a.y + a.height - b.y) < EPS || Math.abs(b.y + b.height - a.y) < EPS) {
          const overlapStart = Math.max(a.x, b.x);
          const overlapEnd = Math.min(a.x + a.width, b.x + b.width);
          if (overlapEnd - overlapStart > EPS) {
            if (Math.abs(a.y + a.height - b.y) < EPS) {
              addShared('x', b.y, overlapStart, overlapEnd);
              pushCut(a.id, 'south', overlapStart, overlapEnd);
              pushCut(b.id, 'north', overlapStart, overlapEnd);
            }
            if (Math.abs(b.y + b.height - a.y) < EPS) {
              addShared('x', a.y, overlapStart, overlapEnd);
              pushCut(b.id, 'south', overlapStart, overlapEnd);
              pushCut(a.id, 'north', overlapStart, overlapEnd);
            }
          }
        }

        if (Math.abs(a.x + a.width - b.x) < EPS || Math.abs(b.x + b.width - a.x) < EPS) {
          const overlapStart = Math.max(a.y, b.y);
          const overlapEnd = Math.min(a.y + a.height, b.y + b.height);
          if (overlapEnd - overlapStart > EPS) {
            if (Math.abs(a.x + a.width - b.x) < EPS) {
              addShared('z', b.x, overlapStart, overlapEnd);
              pushCut(a.id, 'east', overlapStart, overlapEnd);
              pushCut(b.id, 'west', overlapStart, overlapEnd);
            }
            if (Math.abs(b.x + b.width - a.x) < EPS) {
              addShared('z', a.x, overlapStart, overlapEnd);
              pushCut(b.id, 'east', overlapStart, overlapEnd);
              pushCut(a.id, 'west', overlapStart, overlapEnd);
            }
          }
        }
      }
    }

    for (const room of rooms) {
      for (const door of doors) {
        const dx1 = door.x;
        const dx2 = door.x + door.width;
        const dz1 = door.y;
        const dz2 = door.y + door.height;

        const overlapX = [Math.max(dx1, room.x), Math.min(dx2, room.x + room.width)] as [number, number];
        const overlapZ = [Math.max(dz1, room.y), Math.min(dz2, room.y + room.height)] as [number, number];

        const candidates: Array<{
          side: WallSide;
          axis: WallAxis;
          coord: number;
          start: number;
          end: number;
          dist: number;
        }> = [];

        if (overlapX[1] - overlapX[0] > EPS) {
          candidates.push({
            side: 'north',
            axis: 'x',
            coord: room.y,
            start: overlapX[0],
            end: overlapX[1],
            dist: Math.min(Math.abs(dz1 - room.y), Math.abs(dz2 - room.y)),
          });
          candidates.push({
            side: 'south',
            axis: 'x',
            coord: room.y + room.height,
            start: overlapX[0],
            end: overlapX[1],
            dist: Math.min(Math.abs(dz1 - (room.y + room.height)), Math.abs(dz2 - (room.y + room.height))),
          });
        }

        if (overlapZ[1] - overlapZ[0] > EPS) {
          candidates.push({
            side: 'west',
            axis: 'z',
            coord: room.x,
            start: overlapZ[0],
            end: overlapZ[1],
            dist: Math.min(Math.abs(dx1 - room.x), Math.abs(dx2 - room.x)),
          });
          candidates.push({
            side: 'east',
            axis: 'z',
            coord: room.x + room.width,
            start: overlapZ[0],
            end: overlapZ[1],
            dist: Math.min(Math.abs(dx1 - (room.x + room.width)), Math.abs(dx2 - (room.x + room.width))),
          });
        }

        const minDist = Math.min(...candidates.map((c) => c.dist));
        if (!Number.isFinite(minDist) || minDist > DOOR_CUT_TOL) continue;

        for (const candidate of candidates) {
          if (candidate.dist <= minDist + 0.2) {
            pushCut(room.id, candidate.side, candidate.start, candidate.end);
            pushLineCut(candidate.axis, candidate.coord, candidate.start, candidate.end);
          }
        }
      }
    }

    const roomWalls = new Map<string, WallSegment[]>();
    for (const room of rooms) {
      const baseSides: Array<{ side: WallSide; axis: WallAxis; coord: number; base: [number, number] }> = [
        { side: 'north', axis: 'x', coord: room.y, base: [room.x, room.x + room.width] },
        { side: 'south', axis: 'x', coord: room.y + room.height, base: [room.x, room.x + room.width] },
        { side: 'west', axis: 'z', coord: room.x, base: [room.y, room.y + room.height] },
        { side: 'east', axis: 'z', coord: room.x + room.width, base: [room.y, room.y + room.height] },
      ];

      const segments: WallSegment[] = [];
      for (const baseSide of baseSides) {
        const cuts = cutsByRoomSide.get(`${room.id}:${baseSide.side}`) ?? [];
        const remains = subtractIntervals(baseSide.base, cuts);
        for (const [start, end] of remains) {
          segments.push({
            axis: baseSide.axis,
            coord: baseSide.coord,
            start,
            end,
            shared: false,
            side: baseSide.side,
          });
        }
      }
      roomWalls.set(room.id, segments);
    }

    const sharedWalls: WallSegment[] = [];
    for (const segment of sharedSegments.values()) {
      const cuts = lineCuts.get(lineKey(segment.axis, segment.coord)) ?? [];
      const remains = subtractIntervals([segment.start, segment.end], cuts);
      for (const [start, end] of remains) {
        sharedWalls.push({ ...segment, start, end });
      }
    }

    return { roomWallsById: roomWalls, sharedWalls };
  }, [sortedRooms, normalItems]);

  const target = useMemo(
    () => new THREE.Vector3(worldW / 2, ITEM_H.room * 0.32, worldH / 2),
    [worldW, worldH],
  );
  const orbitRadius = useMemo(() => Math.max(worldW, worldH) * 1.55 + ITEM_H.room, [worldW, worldH]);

  const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    dragRef.current = { sx: e.clientX, sy: e.clientY, az: azimuth, el: elevation };
    setIsDragging(true);
  };
  const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.sx;
    const dy = e.clientY - dragRef.current.sy;
    setAzimuth(dragRef.current.az + dx * 0.008);
    setElevation(Math.max(0.1, Math.min(1.48, dragRef.current.el + dy * 0.006)));
  };
  const onMouseUp = () => {
    dragRef.current = null;
    setIsDragging(false);
  };

  const onTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    dragRef.current = { sx: t.clientX, sy: t.clientY, az: azimuth, el: elevation };
    setIsDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const t = e.touches[0];
    const dx = t.clientX - dragRef.current.sx;
    const dy = t.clientY - dragRef.current.sy;
    setAzimuth(dragRef.current.az + dx * 0.008);
    setElevation(Math.max(0.1, Math.min(1.48, dragRef.current.el + dy * 0.006)));
  };

  return (
    <div
      className="relative flex h-full w-full select-none items-center justify-center"
      style={{
        background: 'radial-gradient(ellipse at 58% 38%, #FDFEFE 0%, #EAF1F8 62%, #D5DEE8 100%)',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={() => {
        dragRef.current = null;
        setIsDragging(false);
      }}
    >
      {!isDragging && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-white/85 px-4 py-1.5 text-xs text-slate-600 shadow-sm backdrop-blur-sm">
          Kéo để xoay không gian 3D
        </div>
      )}

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <button
          type="button"
          onClick={handleSaveCamera}
          className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs shadow-sm backdrop-blur-sm transition-colors ${
            saveStatus === 'saved'
              ? 'bg-emerald-500 text-white'
              : 'bg-white/80 text-slate-600 hover:bg-white'
          }`}
          title="Lưu góc camera hiện tại làm mặc định"
        >
          {saveStatus === 'saved' ? (
            <BookmarkCheck className="h-3.5 w-3.5" />
          ) : (
            <Bookmark className="h-3.5 w-3.5" />
          )}
          {saveStatus === 'saved' ? 'Đã lưu' : 'Lưu góc'}
        </button>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setAzimuth(DEFAULT_AZIMUTH);
            setElevation(DEFAULT_ELEVATION);
          }}
          className="rounded-full bg-white/80 p-2 text-slate-600 shadow-sm backdrop-blur-sm transition-colors hover:bg-white"
          title="Đặt lại góc nhìn"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>

      <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-md bg-white/80 px-2 py-1 text-xs text-slate-600 shadow-sm backdrop-blur-sm">
        {Math.round(((azimuth % (Math.PI * 2)) * 180) / Math.PI)}° · elev{' '}
        {Math.round((elevation * 180) / Math.PI)}°
      </div>

      <Canvas
        style={{ width: '100%', height: '100%' }}
        dpr={[1, 1.8]}
        camera={{ fov: 42, near: 1, far: 5000 }}
        shadows
      >
        <color attach="background" args={['#EDF3FA']} />
        <fog attach="fog" args={['#E3EBF4', orbitRadius * 0.82, orbitRadius * 3]} />

        <ambientLight intensity={1.08} />
        <directionalLight
          position={[worldW * 0.16, ITEM_H.room * 3, worldH * 0.24]}
          intensity={1.75}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <hemisphereLight args={['#F8FBFF', '#CAD7E7', 0.74]} />

        <CameraRig azimuth={azimuth} elevation={elevation} target={target} radius={orbitRadius} />

        <mesh position={[worldW / 2, -2, worldH / 2]} receiveShadow>
          <boxGeometry args={[worldW + 220, 2, worldH + 220]} />
          <meshStandardMaterial
            color="#CC9D73"
            roughness={0.9}
            metalness={0}
            emissive="#3A1E0E"
            emissiveIntensity={0.09}
          />
        </mesh>

        {sortedRooms.map((item) => (
          <RoomMesh key={item.id} item={item} walls={roomWallsById.get(item.id) ?? []} />
        ))}
        {sharedWalls.map((segment, idx) => (
          <WallMesh
            key={`shared:${segment.axis}:${segment.coord}:${segment.start}:${segment.end}:${idx}`}
            segment={segment}
          />
        ))}
        {sortedFurniture.map((item) => (
          <FurnitureMesh key={item.id} item={item} />
        ))}
      </Canvas>
    </div>
  );
}
