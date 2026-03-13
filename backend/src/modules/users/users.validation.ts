import { z } from 'zod';
import { UserRole } from '@prisma/client';

const employeeCodeSchema = z.string().trim().min(1).max(50);
const departmentSchema = z.string().trim().min(1).max(100);
const positionSchema = z.string().trim().min(1).max(150);
const nullableEmployeeCodeSchema = z.union([employeeCodeSchema, z.literal(''), z.null()]);
const nullableDepartmentSchema = z.union([departmentSchema, z.literal(''), z.null()]);
const nullablePositionSchema = z.union([positionSchema, z.literal(''), z.null()]);
const nullableDateTimeSchema = z.union([z.string().datetime(), z.literal(''), z.null()]);

export const getUsersQuerySchema = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().trim().min(3).max(100),
  employeeCode: employeeCodeSchema.optional().transform((value) => value || undefined),
  password: z.string().min(6),
  fullName: z.string().trim().min(1),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  role: z.nativeEnum(UserRole).default('EMPLOYEE'),
  department: departmentSchema.optional(),
  position: positionSchema.optional(),
  managerId: z.coerce.bigint().optional(),
  isCountable: z.boolean().optional(),
  companyJoinDate: z.string().datetime().optional(),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  username: z.string().trim().min(3).max(100).optional(),
  employeeCode: nullableEmployeeCodeSchema
    .optional()
    .transform((value) => (value === '' ? null : value)),
  password: z.string().min(6).optional(),
  fullName: z.string().trim().min(1).optional(),
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  role: z.nativeEnum(UserRole).optional(),
  department: nullableDepartmentSchema
    .optional()
    .transform((value) => (value === '' ? null : value)),
  position: nullablePositionSchema.optional().transform((value) => (value === '' ? null : value)),
  managerId: z.union([z.coerce.bigint(), z.null()]).optional(),
  isCountable: z.boolean().optional(),
  companyJoinDate: nullableDateTimeSchema
    .optional()
    .transform((value) => (value === '' ? null : value)),
  isActive: z.boolean().optional(),
});

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
