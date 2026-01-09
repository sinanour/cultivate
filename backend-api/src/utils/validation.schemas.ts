import { z } from 'zod';
import {
  ActivityStatus,
  VenueType,
  GeographicAreaType,
  SyncOperation,
  TimePeriod,
  DateGranularity,
  GroupingDimension
} from './constants';

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

// Activity Category schemas
export const ActivityCategoryCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const ActivityCategoryUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  version: z.number().int().positive().optional(),
});

// Activity Type schemas
export const ActivityTypeCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  activityCategoryId: z.string().uuid('Invalid activity category ID format'),
});

export const ActivityTypeUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters').optional(),
  activityCategoryId: z.string().uuid('Invalid activity category ID format').optional(),
  version: z.number().int().positive().optional(),
});

// Role schemas
export const RoleCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const RoleUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  version: z.number().int().positive().optional(),
});

// Population schemas
export const PopulationCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
});

export const PopulationUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  version: z.number().int().positive().optional(),
});

export const ParticipantPopulationCreateSchema = z.object({
  populationId: z.string().uuid('Invalid population ID format'),
});

// User schemas
export const UserCreateSchema = z.object({
  displayName: z.string().min(1).max(200).optional(),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['ADMINISTRATOR', 'EDITOR', 'READ_ONLY'], {
    errorMap: () => ({ message: 'Role must be ADMINISTRATOR, EDITOR, or READ_ONLY' }),
  }),
  authorizationRules: z.array(z.object({
    geographicAreaId: z.string().uuid(),
    ruleType: z.enum(['ALLOW', 'DENY']),
  })).optional(),
});

export const UserUpdateSchema = z.object({
  displayName: z.string().min(1).max(200).nullable().optional(),
  email: z.string().email('Invalid email format').optional(),
  password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  role: z.enum(['ADMINISTRATOR', 'EDITOR', 'READ_ONLY'], {
    errorMap: () => ({ message: 'Role must be ADMINISTRATOR, EDITOR, or READ_ONLY' }),
  }).optional(),
});

// Participant schemas
export const ParticipantCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  email: z.string().email('Invalid email format').optional(),
  phone: z.string().max(20, 'Phone must be at most 20 characters').optional(),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
  dateOfBirth: z.string().datetime('Invalid date of birth format').optional().refine(
    (date) => !date || new Date(date) < new Date(),
    { message: 'Date of birth must be in the past' }
  ),
  dateOfRegistration: z.string().datetime('Invalid date of registration format').optional(),
  nickname: z.string().max(100, 'Nickname must be at most 100 characters').optional(),
  homeVenueId: z.string().uuid('Invalid venue ID format').optional(),
});

export const ParticipantUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  email: z.union([z.string().email('Invalid email format'), z.null()]).optional(),
  phone: z.union([z.string().max(20, 'Phone must be at most 20 characters'), z.null()]).optional(),
  notes: z.union([z.string().max(1000, 'Notes must be at most 1000 characters'), z.null()]).optional(),
  dateOfBirth: z.union([
    z.string().datetime('Invalid date of birth format').refine(
      (date) => new Date(date) < new Date(),
      { message: 'Date of birth must be in the past' }
    ),
    z.null()
  ]).optional(),
  dateOfRegistration: z.union([z.string().datetime('Invalid date of registration format'), z.null()]).optional(),
  nickname: z.union([z.string().max(100, 'Nickname must be at most 100 characters'), z.null()]).optional(),
  homeVenueId: z.union([z.string().uuid('Invalid venue ID format'), z.null()]).optional(),
  version: z.number().int().positive().optional(),
});

export const ParticipantSearchSchema = z.object({
  q: z.string().optional(),
});

// Geographic Area schemas
export const GeographicAreaCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  areaType: z.nativeEnum(GeographicAreaType),
  parentGeographicAreaId: z.string().uuid('Invalid parent ID format').optional(),
});

export const GeographicAreaUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  areaType: z.nativeEnum(GeographicAreaType).optional(),
  parentGeographicAreaId: z.union([z.string().uuid('Invalid parent ID format'), z.null()]).optional(),
  version: z.number().int().positive().optional(),
});

// Venue schemas
export const VenueCreateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  address: z.string().min(1, 'Address is required').max(500, 'Address must be at most 500 characters'),
  geographicAreaId: z.string().uuid('Invalid geographic area ID format'),
  latitude: z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90').optional(),
  longitude: z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180').optional(),
  venueType: z.nativeEnum(VenueType).optional(),
});

export const VenueUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  address: z.string().min(1, 'Address is required').max(500, 'Address must be at most 500 characters').optional(),
  geographicAreaId: z.string().uuid('Invalid geographic area ID format').optional(),
  latitude: z.union([z.number().min(-90, 'Latitude must be >= -90').max(90, 'Latitude must be <= 90'), z.null()]).optional(),
  longitude: z.union([z.number().min(-180, 'Longitude must be >= -180').max(180, 'Longitude must be <= 180'), z.null()]).optional(),
  venueType: z.union([z.nativeEnum(VenueType), z.null()]).optional(),
  version: z.number().int().positive().optional(),
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
  status: z.nativeEnum(ActivityStatus).optional(),
  venueIds: z.array(z.string().uuid('Invalid venue ID format')).optional(),
});

export const ActivityUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters').optional(),
  activityTypeId: z.string().uuid('Invalid activity type ID format').optional(),
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.union([z.string().datetime('Invalid end date format'), z.null()]).optional(),
  status: z.nativeEnum(ActivityStatus).optional(),
  version: z.number().int().positive().optional(),
});

export const ActivityVenueAssociationSchema = z.object({
  venueId: z.string().uuid('Invalid venue ID format'),
  effectiveFrom: z.string().datetime('Invalid effectiveFrom date format').nullable().optional(),
});

// Assignment schemas
export const AssignmentCreateSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID format'),
  roleId: z.string().uuid('Invalid role ID format'),
  notes: z.string().max(1000, 'Notes must be at most 1000 characters').optional(),
});

export const AssignmentUpdateSchema = z.object({
  roleId: z.string().uuid('Invalid role ID format').optional(),
  notes: z.union([z.string().max(1000, 'Notes must be at most 1000 characters'), z.null()]).optional(),
});

// Analytics schemas
export const EngagementQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  parentGeographicAreaId: z.string().uuid('Invalid parent geographic area ID format').optional(),
  activityCategoryIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid activity category ID format')).optional()
  ),
  activityTypeIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid activity type ID format')).optional()
  ),
  geographicAreaIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid geographic area ID format')).optional()
  ),
  venueIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid venue ID format')).optional()
  ),
  populationIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid population ID format')).optional()
  ),
  groupBy: z.union([
    z.nativeEnum(GroupingDimension),
    z.array(z.nativeEnum(GroupingDimension))
  ]).optional().transform(val => {
    // Normalize to array
    if (!val) return undefined;
    return Array.isArray(val) ? val : [val];
  }),
  dateGranularity: z.nativeEnum(DateGranularity).optional(),
});

export const GrowthQuerySchema = z.object({
  period: z.nativeEnum(TimePeriod),
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  activityCategoryIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid activity category ID format')).optional()
  ),
  activityTypeIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid activity type ID format')).optional()
  ),
  geographicAreaIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid geographic area ID format')).optional()
  ),
  venueIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid venue ID format')).optional()
  ),
  populationIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid population ID format')).optional()
  ),
  groupBy: z.enum(['type', 'category']).optional(),
});

export const ActivityLifecycleQuerySchema = z.object({
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  groupBy: z.enum(['category', 'type']),
  geographicAreaIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        // Flatten any comma-separated values
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      // Single string - split by comma
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid geographic area ID format')).optional()
  ),
  activityCategoryIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid activity category ID format')).optional()
  ),
  activityTypeIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid activity type ID format')).optional()
  ),
  venueIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid venue ID format')).optional()
  ),
  populationIds: z.preprocess(
    (val) => {
      if (val === undefined || val === null) return undefined;
      if (Array.isArray(val)) {
        return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
      }
      const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
      return values.length > 0 ? values : undefined;
    },
    z.array(z.string().uuid('Invalid population ID format')).optional()
  ),
});

// Map Data schemas
const arrayPreprocessor = (val: any) => {
  if (val === undefined || val === null) return undefined;
  if (Array.isArray(val)) {
    return val.flatMap(v => String(v).split(',').map(s => s.trim())).filter(s => s.length > 0);
  }
  const values = String(val).split(',').map(s => s.trim()).filter(s => s.length > 0);
  return values.length > 0 ? values : undefined;
};

export const MapActivityMarkersQuerySchema = z.object({
  geographicAreaIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid geographic area ID format')).optional()
  ),
  activityCategoryIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid activity category ID format')).optional()
  ),
  activityTypeIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid activity type ID format')).optional()
  ),
  venueIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid venue ID format')).optional()
  ),
  populationIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid population ID format')).optional()
  ),
  startDate: z.string().datetime('Invalid start date format').optional(),
  endDate: z.string().datetime('Invalid end date format').optional(),
  status: z.nativeEnum(ActivityStatus).optional(),
});

export const MapParticipantHomeMarkersQuerySchema = z.object({
  geographicAreaIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid geographic area ID format')).optional()
  ),
  populationIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid population ID format')).optional()
  ),
});

export const MapVenueMarkersQuerySchema = z.object({
  geographicAreaIds: z.preprocess(
    arrayPreprocessor,
    z.array(z.string().uuid('Invalid geographic area ID format')).optional()
  ),
});

// Sync schemas
export const SyncOperationSchema = z.object({
  operation: z.nativeEnum(SyncOperation),
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

// Participant Address History schemas
export const ParticipantAddressHistoryCreateSchema = z.object({
  venueId: z.string().uuid('Invalid venue ID format'),
  effectiveFrom: z.string().datetime('Invalid effectiveFrom date format').nullable().optional(),
});

export const ParticipantAddressHistoryUpdateSchema = z.object({
  venueId: z.string().uuid('Invalid venue ID format').optional(),
  effectiveFrom: z.string().datetime('Invalid effectiveFrom date format').nullable().optional(),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;
export type ActivityCategoryCreateInput = z.infer<typeof ActivityCategoryCreateSchema>;
export type ActivityCategoryUpdateInput = z.infer<typeof ActivityCategoryUpdateSchema>;
export type ActivityTypeCreateInput = z.infer<typeof ActivityTypeCreateSchema>;
export type ActivityTypeUpdateInput = z.infer<typeof ActivityTypeUpdateSchema>;
export type RoleCreateInput = z.infer<typeof RoleCreateSchema>;
export type RoleUpdateInput = z.infer<typeof RoleUpdateSchema>;
export type UserCreateInput = z.infer<typeof UserCreateSchema>;
export type UserUpdateInput = z.infer<typeof UserUpdateSchema>;
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
export type ActivityLifecycleQuery = z.infer<typeof ActivityLifecycleQuerySchema>;
export type MapActivityMarkersQuery = z.infer<typeof MapActivityMarkersQuerySchema>;
export type MapParticipantHomeMarkersQuery = z.infer<typeof MapParticipantHomeMarkersQuerySchema>;
export type MapVenueMarkersQuery = z.infer<typeof MapVenueMarkersQuerySchema>;
export type SyncOperationInput = z.infer<typeof SyncOperationSchema>;
export type BatchSyncInput = z.infer<typeof BatchSyncSchema>;
export type UuidParam = z.infer<typeof UuidParamSchema>;
export type ParticipantAddressHistoryCreateInput = z.infer<typeof ParticipantAddressHistoryCreateSchema>;
export type ParticipantAddressHistoryUpdateInput = z.infer<typeof ParticipantAddressHistoryUpdateSchema>;

// CSV Import schemas
export const ParticipantImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  email: z.string().email('Invalid email format').optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  phone: z.string().max(20).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  notes: z.string().max(1000).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  dateOfBirth: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  dateOfRegistration: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  nickname: z.string().max(100).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
});

export const VenueImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  address: z.string().min(1, 'Address is required').max(500),
  geographicAreaId: z.string().uuid('Invalid geographic area ID'),
  latitude: z.coerce.number().min(-90).max(90).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  longitude: z.coerce.number().min(-180).max(180).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  venueType: z.enum(['PUBLIC_BUILDING', 'PRIVATE_RESIDENCE']).optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
});

export const ActivityImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  activityTypeId: z.string().uuid('Invalid activity type ID'),
  startDate: z.string().min(1, 'Start date is required'),
  endDate: z.string().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
  status: z.enum(['PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED']).optional(),
});

export const GeographicAreaImportSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(200),
  areaType: z.nativeEnum(GeographicAreaType),
  parentGeographicAreaId: z.string().uuid().optional().or(z.literal('')).transform(val => val === '' ? undefined : val),
});

export type ParticipantImportInput = z.infer<typeof ParticipantImportSchema>;
export type VenueImportInput = z.infer<typeof VenueImportSchema>;
export type ActivityImportInput = z.infer<typeof ActivityImportSchema>;
export type GeographicAreaImportInput = z.infer<typeof GeographicAreaImportSchema>;
