import { Prisma, UserRole, DeviceAuditAction } from '@prisma/client';
import prisma from '../../config/prisma';
import { buildMeta, getPaginationParams } from '../../utils/pagination';
import {
  CreateDeviceDto,
  UpdateDeviceDto,
  GetDevicesQueryDto,
  AssignDeviceDto,
  UnassignDeviceDto,
  TransferDeviceDto,
  CreateMaintenanceDto,
  ResolveMaintenanceDto,
  GetAuditLogsQueryDto,
} from './devices.validation';

type AuthUser = {
  id: bigint;
  role: UserRole;
  systemRole?: string | null;
};

function isAdminOrHr(user: AuthUser) {
  return (
    user.role === 'ADMIN' ||
    user.role === 'HR' ||
    user.systemRole === 'ADMIN'
  );
}

async function writeAuditLog(
  tx: Prisma.TransactionClient,
  deviceId: bigint,
  actorId: bigint,
  action: DeviceAuditAction,
  opts?: { targetId?: bigint; note?: string; meta?: object },
) {
  await tx.deviceAuditLog.create({
    data: {
      deviceId,
      actorId,
      action,
      targetId: opts?.targetId,
      note: opts?.note,
      meta: opts?.meta as Prisma.InputJsonValue,
    },
  });
}

const DEVICE_LIST_INCLUDE = {
  specs: { orderBy: { sortOrder: 'asc' as const } },
  images: { orderBy: { sortOrder: 'asc' as const }, take: 1 },
  assignments: {
    where: { status: 'ACTIVE' as const },
    include: {
      user: { select: { id: true, fullName: true, department: true, employeeCode: true } },
    },
    take: 1,
  },
} satisfies Prisma.DeviceInclude;

const DEVICE_DETAIL_INCLUDE = {
  specs: { orderBy: { sortOrder: 'asc' as const } },
  images: { orderBy: { sortOrder: 'asc' as const } },
  assignments: {
    orderBy: { assignedAt: 'desc' as const },
    include: {
      user: { select: { id: true, fullName: true, department: true, employeeCode: true } },
      assignedBy: { select: { id: true, fullName: true } },
      returnedBy: { select: { id: true, fullName: true } },
    },
  },
  maintenanceLogs: {
    orderBy: { createdAt: 'desc' as const },
    include: {
      reportedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  },
} satisfies Prisma.DeviceInclude;

// --------- DEVICE CRUD ---------

export async function getDevices(user: AuthUser, query: GetDevicesQueryDto) {
  const { page, limit, skip } = getPaginationParams(query as Record<string, unknown>);
  const admin = isAdminOrHr(user);

  const where: Prisma.DeviceWhereInput = {
    isActive: true,
    ...(query.type && { type: query.type }),
    ...(query.status && { status: query.status }),
    ...(query.search && {
      OR: [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { serialNumber: { contains: query.search, mode: 'insensitive' } },
        { brand: { contains: query.search, mode: 'insensitive' } },
      ],
    }),
    ...(!admin && {
      assignments: { some: { userId: user.id, status: 'ACTIVE' } },
    }),
    ...(admin && query.userId && {
      assignments: { some: { userId: query.userId, status: 'ACTIVE' } },
    }),
  };

  const [data, total] = await Promise.all([
    prisma.device.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: DEVICE_LIST_INCLUDE,
    }),
    prisma.device.count({ where }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
}

export async function getDeviceById(id: bigint, user: AuthUser) {
  const device = await prisma.device.findUnique({
    where: { id },
    include: DEVICE_DETAIL_INCLUDE,
  });

  if (!device || !device.isActive) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  if (!isAdminOrHr(user)) {
    const isAssigned = device.assignments.some(
      (a) => a.userId === user.id && a.status === 'ACTIVE',
    );
    if (!isAssigned) throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  return device;
}

export async function createDevice(
  actor: AuthUser,
  data: CreateDeviceDto,
  imageUrl?: string,
) {
  const existing = await prisma.device.findUnique({ where: { code: data.code } });
  if (existing) {
    throw Object.assign(new Error('Device code already exists'), { status: 409 });
  }

  return prisma.$transaction(async (tx) => {
    const device = await tx.device.create({
      data: {
        code: data.code,
        name: data.name,
        type: data.type,
        brand: data.brand,
        model: data.model,
        serialNumber: data.serialNumber,
        purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : undefined,
        purchasePrice: data.purchasePrice,
        warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : undefined,
        location: data.location,
        note: data.note,
        imageUrl,
        specs: data.specs ? { createMany: { data: data.specs } } : undefined,
      },
      include: { specs: { orderBy: { sortOrder: 'asc' } } },
    });
    await writeAuditLog(tx, device.id, actor.id, 'CREATED');
    return device;
  });
}

export async function updateDevice(
  id: bigint,
  actor: AuthUser,
  data: UpdateDeviceDto,
  imageUrl?: string,
) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || !device.isActive) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  return prisma.$transaction(async (tx) => {
    if (data.specs !== undefined) {
      await tx.deviceSpec.deleteMany({ where: { deviceId: id } });
      if (data.specs.length > 0) {
        await tx.deviceSpec.createMany({
          data: data.specs.map((s) => ({ ...s, deviceId: id })),
        });
      }
    }

    const updated = await tx.device.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.brand !== undefined && { brand: data.brand }),
        ...(data.model !== undefined && { model: data.model }),
        ...(data.serialNumber !== undefined && { serialNumber: data.serialNumber }),
        ...(data.purchaseDate !== undefined && {
          purchaseDate: data.purchaseDate ? new Date(data.purchaseDate) : null,
        }),
        ...(data.purchasePrice !== undefined && { purchasePrice: data.purchasePrice }),
        ...(data.warrantyUntil !== undefined && {
          warrantyUntil: data.warrantyUntil ? new Date(data.warrantyUntil) : null,
        }),
        ...(data.location !== undefined && { location: data.location }),
        ...(data.note !== undefined && { note: data.note }),
        ...(imageUrl !== undefined && { imageUrl }),
      },
      include: { specs: { orderBy: { sortOrder: 'asc' } } },
    });

    await writeAuditLog(tx, id, actor.id, 'UPDATED');
    return updated;
  });
}

export async function deleteDevice(id: bigint, actor: AuthUser) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || !device.isActive) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  if (device.status === 'IN_USE') {
    throw Object.assign(
      new Error('Cannot delete a device that is currently in use'),
      { status: 400 },
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.device.update({
      where: { id },
      data: { isActive: false, status: 'RETIRED' },
    });
    await writeAuditLog(tx, id, actor.id, 'RETIRED');
  });
}

// --------- ASSIGNMENT ---------

export async function assignDevice(id: bigint, actor: AuthUser, data: AssignDeviceDto) {
  const device = await prisma.device.findUnique({ where: { id } });
  if (!device || !device.isActive) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  if (device.status !== 'AVAILABLE') {
    throw Object.assign(
      new Error(`Device is not available (current status: ${device.status})`),
      { status: 400 },
    );
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: data.userId },
    select: { id: true, fullName: true, isActive: true },
  });
  if (!targetUser || !targetUser.isActive) {
    throw Object.assign(new Error('Target user not found or inactive'), { status: 404 });
  }

  return prisma.$transaction(async (tx) => {
    const assignment = await tx.deviceAssignment.create({
      data: {
        deviceId: id,
        userId: data.userId,
        assignedById: actor.id,
        note: data.note,
      },
      include: {
        user: { select: { id: true, fullName: true, department: true } },
        assignedBy: { select: { id: true, fullName: true } },
      },
    });
    await tx.device.update({ where: { id }, data: { status: 'IN_USE' } });
    await writeAuditLog(tx, id, actor.id, 'ASSIGNED', {
      targetId: data.userId,
      note: data.note,
      meta: { userId: data.userId.toString(), userName: targetUser.fullName },
    });
    return assignment;
  });
}

export async function unassignDevice(id: bigint, actor: AuthUser, data: UnassignDeviceDto) {
  const activeAssignment = await prisma.deviceAssignment.findFirst({
    where: { deviceId: id, status: 'ACTIVE' },
  });
  if (!activeAssignment) {
    throw Object.assign(new Error('Device has no active assignment'), { status: 400 });
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.deviceAssignment.update({
      where: { id: activeAssignment.id },
      data: {
        status: 'RETURNED',
        returnedAt: new Date(),
        returnedById: actor.id,
        note: data.note,
      },
    });
    await tx.device.update({ where: { id }, data: { status: 'AVAILABLE' } });
    await writeAuditLog(tx, id, actor.id, 'UNASSIGNED', {
      targetId: activeAssignment.userId,
      note: data.note,
    });
    return updated;
  });
}

export async function transferDevice(id: bigint, actor: AuthUser, data: TransferDeviceDto) {
  const activeAssignment = await prisma.deviceAssignment.findFirst({
    where: { deviceId: id, status: 'ACTIVE' },
  });
  if (!activeAssignment) {
    throw Object.assign(new Error('Device has no active assignment to transfer from'), {
      status: 400,
    });
  }
  if (activeAssignment.userId === data.toUserId) {
    throw Object.assign(new Error('Cannot transfer to the same user'), { status: 400 });
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: data.toUserId },
    select: { id: true, fullName: true, isActive: true },
  });
  if (!targetUser || !targetUser.isActive) {
    throw Object.assign(new Error('Target user not found or inactive'), { status: 404 });
  }

  return prisma.$transaction(async (tx) => {
    await tx.deviceAssignment.update({
      where: { id: activeAssignment.id },
      data: { status: 'RETURNED', returnedAt: new Date(), returnedById: actor.id },
    });
    const newAssignment = await tx.deviceAssignment.create({
      data: {
        deviceId: id,
        userId: data.toUserId,
        assignedById: actor.id,
        note: data.note,
      },
      include: {
        user: { select: { id: true, fullName: true, department: true } },
        assignedBy: { select: { id: true, fullName: true } },
      },
    });
    await writeAuditLog(tx, id, actor.id, 'TRANSFERRED', {
      targetId: data.toUserId,
      note: data.note,
      meta: {
        fromUserId: activeAssignment.userId.toString(),
        toUserId: data.toUserId.toString(),
        toUserName: targetUser.fullName,
      },
    });
    return newAssignment;
  });
}

// --------- MAINTENANCE ---------

export async function createMaintenanceLog(
  deviceId: bigint,
  actor: AuthUser,
  data: CreateMaintenanceDto,
) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || !device.isActive) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  if (device.status === 'RETIRED') {
    throw Object.assign(
      new Error('Cannot create maintenance log for a retired device'),
      { status: 400 },
    );
  }

  return prisma.$transaction(async (tx) => {
    const log = await tx.deviceMaintenanceLog.create({
      data: {
        deviceId,
        reportedById: actor.id,
        assignedToId: data.assignedToId,
        issue: data.issue,
        cost: data.cost,
        note: data.note,
      },
      include: {
        reportedBy: { select: { id: true, fullName: true } },
        assignedTo: { select: { id: true, fullName: true } },
      },
    });
    const prevStatus = device.status;
    await tx.device.update({ where: { id: deviceId }, data: { status: 'MAINTENANCE' } });
    await writeAuditLog(tx, deviceId, actor.id, 'MAINTENANCE_OPENED', {
      meta: { prevStatus, issue: data.issue },
    });
    return log;
  });
}

export async function resolveMaintenanceLog(
  deviceId: bigint,
  maintenanceId: bigint,
  actor: AuthUser,
  data: ResolveMaintenanceDto,
) {
  const log = await prisma.deviceMaintenanceLog.findFirst({
    where: { id: maintenanceId, deviceId, status: 'OPEN' },
  });
  if (!log) {
    throw Object.assign(
      new Error('Maintenance log not found or already resolved'),
      { status: 404 },
    );
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.deviceMaintenanceLog.update({
      where: { id: maintenanceId },
      data: {
        status: 'RESOLVED',
        resolution: data.resolution,
        resolvedAt: new Date(),
        ...(data.cost !== undefined && { cost: data.cost }),
      },
    });
    const activeAssignment = await tx.deviceAssignment.findFirst({
      where: { deviceId, status: 'ACTIVE' },
    });
    const nextStatus = activeAssignment ? 'IN_USE' : 'AVAILABLE';
    await tx.device.update({ where: { id: deviceId }, data: { status: nextStatus } });
    await writeAuditLog(tx, deviceId, actor.id, 'MAINTENANCE_RESOLVED', {
      meta: { resolution: data.resolution, nextStatus },
    });
    return updated;
  });
}

export async function getMaintenanceLogs(deviceId: bigint, user: AuthUser) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || !device.isActive) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }

  return prisma.deviceMaintenanceLog.findMany({
    where: { deviceId },
    orderBy: { createdAt: 'desc' },
    include: {
      reportedBy: { select: { id: true, fullName: true } },
      assignedTo: { select: { id: true, fullName: true } },
    },
  });
}

export async function getAuditLogs(deviceId: bigint, query: GetAuditLogsQueryDto) {
  const { page, limit, skip } = getPaginationParams(query as Record<string, unknown>);

  const [data, total] = await Promise.all([
    prisma.deviceAuditLog.findMany({
      where: { deviceId },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        actor: { select: { id: true, fullName: true } },
      },
    }),
    prisma.deviceAuditLog.count({ where: { deviceId } }),
  ]);

  return { data, meta: buildMeta(total, page, limit) };
}

// --------- IMAGES ---------

export async function addDeviceImages(deviceId: bigint, filenames: string[]) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device || !device.isActive) {
    throw Object.assign(new Error('Device not found'), { status: 404 });
  }
  const existing = await prisma.deviceImage.count({ where: { deviceId } });
  const data = filenames.map((imageUrl, i) => ({
    deviceId,
    imageUrl,
    sortOrder: existing + i,
  }));
  return prisma.deviceImage.createMany({ data });
}

export async function deleteDeviceImage(deviceId: bigint, imageId: bigint) {
  const image = await prisma.deviceImage.findFirst({
    where: { id: imageId, deviceId },
  });
  if (!image) {
    throw Object.assign(new Error('Image not found'), { status: 404 });
  }
  await prisma.deviceImage.delete({ where: { id: imageId } });
}

export async function getDeviceImages(deviceId: bigint) {
  return prisma.deviceImage.findMany({
    where: { deviceId },
    orderBy: { sortOrder: 'asc' },
  });
}
