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

// Geographic Area schemas
export const GeographicAreaCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  areaType: z.enum([
    'NEIGHBOURHOOD',
    'COMMUNITY',
    'CITY',
    'CLUSTER',
    'COUNTY',
    'PROVINCE',
    'STATE',
    'COUNTRY',
    'CUSTOM',
  ]),
  parentGeographicAreaId: z.string().uuid('Invalid parent ID format').optional(),
});

export const GeographicAreaUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  areaType: z
    .enum([
      'NEIGHBOURHOOD',
      'COMMUNITY',
      'CITY',
      'CLUSTER',
      'COUNTY',
      'PROVINCE',
      'STATE',
      'COUNTRY',
      'CUSTOM',
    ])
    .optional(),
  parentGeographicAreaId: z.string().uuid('Invalid parent ID format').optional().nullable(),
});

// Venue schemas
export const VenueCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  address: z.string().min(1, 'Address is required').max(500, 'Address must be at most 500 characters'),
  geographicAreaId: z.string().uuid('Invalid geographic area ID format'),
  latitude: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90').optional(),
  longitude: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180').optional(),
  venueType: z.enum(['PUBLIC_BUILDING', 'PRIVATE_RESIDENCE']).optional(),
});

export const VenueUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  address: z.string().min(1, 'Address is required').max(500, 'Address must be at most 500 characters').optional(),
  geographicAreaId: z.string().uuid('Invalid geographic area ID format').optional(),
  latitude: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90').optional().nullable(),
  longitude: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180').optional().nullable(),
  venueType: z.enum(['PUBLIC_BUILDING', 'PRIVATE_RESIDENCE']).optional().nullable(),
});

export const VenueSearchSchema = z.object({
  q: z.string().optional(),
});

// Activity schemas
export const ActivityCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  activityTypeId: z.string().uuid('Invalid activity type ID format'),
  startDate: z.string().datetime('Invalid start date format'),
  endDate: z.string().datetime('Invalid end date format').optional(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
  venueIds: z.array(z.string().uuid('Invalid venue ID format')).optional(),
});

export const ActivityUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  activityTypeId: z.string().uuid('Invalid activity type ID format').optional(),
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional().nullable(),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export const ActivityVenueAssociationSchema = z.object({
  venueId: z.string().uuid('Invalid venue ID format'),
});

// Assignment schemas
export const AssignmentCreateSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID format'),
  roleId: z.string().uuid('Invalid role ID format'),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
});

export const AssignmentUpdateSchema = z.object({
  roleId: z.string().uuid('Invalid role ID format').optional(),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
});

// Analytics schemas
export const EngagementQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  geographicAreaId: z.string().uuid('Invalid geographic area ID format').optional(),
});

export const GrowthQuerySchema = z.object({
  period: z.enum(['DAY', 'WEEK', 'MONTH', 'YEAR']),
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  geographicAreaId: z.string().uuid('Invalid geographic area ID format').optional(),
});

// Sync schemas
export const SyncOperationSchema = z.object({
  operation: z.enum(['CREATE', 'UPDATE', 'DELETE']),
  entityType: z.string().min(1, 'Entity type is required'),
  localId: z.string().optional(),
  serverId: z.string().uuid('Invalid server ID format').optional(),
  data: z.any().optional(),
  timestamp: z.string().datetime('Invalid timestamp format'),
});

export const BatchSyncSchema = z.object({
  operations: z.array(SyncOperationSchema).min(1, 'At least one operation is required'),
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
export type GeographicAreaCreateInput = z.infer<typeof GeographicAreaCreateSchema>;
export type GeographicAreaUpdateInput = z.infer<typeof GeographicAreaUpdateSchema>;
export type VenueCreateInput = z.infer<typeof VenueCreateSchema>;
export type VenueUpdateInput = z.infer<typeof VenueUpdateSchema>;
export type VenueSearchQuery = z.infer<typeof VenueSearchSchema>;
export type ActivityCreateInput = z.infer<typeof ActivityCreateSchema>;
export type ActivityUpdateInput = z.infer<typeof ActivityUpdateSchema>;
export type ActivityVenueAssociationInput = z.infer<typeof ActivityVenueAssociationSchema>;
export type AssignmentCreateInput = z.infer<typeof AssignmentCreateSchema>;
export type AssignmentUpdateInput = z.infer<typeof AssignmentUpdateSchema>;
export type EngagementQuery = z.infer<typeof EngagementQuerySchema>;
export type GrowthQuery = z.infer<typeof GrowthQuerySchema>;
export type SyncOperationInput = z.infer<typeof SyncOperationSchema>;
export type BatchSyncInput = z.infer<typeof BatchSyncSchema>;
export type UuidParam = z.infer<typeof UuidParamSchema>;
