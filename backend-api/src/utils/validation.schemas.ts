import { z } from 'zod';

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Activity Type schemas
export const ActivityTypeCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const ActivityTypeUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

// Role schemas
export const RoleCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const RoleUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

// Participant schemas
export const ParticipantCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  email: z.string().email('Invalid email format'),
  phone: z.string().max(20, 'Phone must be at most 20 characters').optional(),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
  homeVenueId: z.string().uuid('Invalid venue ID format').optional(),
});

export const ParticipantUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().max(20, 'Phone must be at most 20 characters').optional(),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
  homeVenueId: z.string().uuid('Invalid venue ID format').optional().nullable(),
});

export const ParticipantSearchSchema = z.object({
  q: z.string().optional(),
});

// UUID validation schema
export const UuidParamSchema = z.object({
    id: z.string().uuid('Invalid ID format'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ActivityTypeCreateInput = z.infer<typeof ActivityTypeCreateSchema>;
export type ActivityTypeUpdateInput = z.infer<typeof ActivityTypeUpdateSchema>;
export type RoleCreateInput = z.infer<typeof RoleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof RoleUpdateSchema>;
export type ParticipantCreateInput = z.infer<typeof ParticipantCreateSchema>;
export type ParticipantUpdateInput = z.infer<typeof ParticipantUpdateSchema>;
export type ParticipantSearchQuery = z.infer<typeof ParticipantSearchSchema>;
export type UuidParam = z.infer<typeof UuidParamSchema>;
