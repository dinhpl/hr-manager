import { z } from "zod";
import { UserRole } from "@prisma/client";

export const getUsersQuerySchema = z.object({
  search: z.string().optional(),
  department: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(100),
  password: z.string().min(6),
  fullName: z.string().min(1),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  role: z.nativeEnum(UserRole).default("EMPLOYEE"),
  department: z.string().optional(),
  position: z.string().optional(),
  managerId: z.coerce.bigint().optional(),
  companyJoinDate: z.string().datetime().optional(),
});

export const updateUserSchema = createUserSchema
  .omit({ email: true, username: true, password: true })
  .partial()
  .extend({ isActive: z.boolean().optional() });

export type CreateUserDto = z.infer<typeof createUserSchema>;
export type UpdateUserDto = z.infer<typeof updateUserSchema>;
export type GetUsersQuery = z.infer<typeof getUsersQuerySchema>;
