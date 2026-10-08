/**
 * BulkMutationService
 *
 * Shared, generic orchestration for the bulk-editing feature. Each entity
 * (Venue, Participant, Activity) exposes a `bulkMutate()` method on its
 * domain service that provides a `BulkEntityAdapter` and delegates to this
 * helper so the transaction / validation / per-change-error skeleton lives
 * in exactly one place.
 *
 * Flow (requirements 9/10/11/12/13):
 *   1. Reject over-cap requests before touching the DB.
 *   2. Open a single `prisma.$transaction`.
 *   3. Validate every change (deletes, then updates, then creates). Any
 *      validation error is collected; we do not short-circuit so the response
 *      can report every failing row.
 *   4. If any validation failed, throw a `BulkError`. Prisma rolls back the
 *      transaction, so no change is persisted (atomic-all-or-nothing).
 *   5. Otherwise apply changes in the order deletes -> updates -> creates
 *      (so freed unique constraints don't collide with a new create).
 *   6. On commit, emit per-applied-change audit entries. Audit failures must
 *      not fail the request (and do not run on rollback - that is the point).
 */

import { PrismaClient } from '@prisma/client';
import { AppError } from '../types/errors.types';
import {
  BulkCreateResult,
  BulkDeleteResult,
  BulkError,
  BulkErrorItem,
  BulkMutationRequest,
  BulkMutationResponse,
  BulkUpdateResult,
  BulkChangeRef,
} from '../types/bulk-mutation.types';
import { AuditLogRepository } from '../repositories/audit-log.repository';
import { AuthorizationContext } from '../utils/auth.utils';

/**
 * Minimal transaction client type. Services only need access to their own
 * model namespace; using `any` here keeps the type local to the service.
 */
export type BulkTx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

export interface BulkEntityAdapter<TCreate, TUpdate> {
  /** Entity name used in audit log entries (e.g. "VENUE"). */
  entityType: string;

  /** Hard upper bound on `creates + updates + deletes` per request. */
  maxChanges: number;

  /**
   * Validate a staged create inside the transaction. MUST throw AppError or
   * Error (with a well-known message) on any problem so the service can map
   * the failure to a per-change error.
   */
  validateCreate(tx: BulkTx, data: TCreate, authCtx: AuthorizationContext): Promise<void>;

  /**
   * Validate a staged update inside the transaction. Verifies existence,
   * reference integrity, geographic authorization against both the current
   * and target area, and any entity-specific field rules.
   */
  validateUpdate(
    tx: BulkTx,
    id: string,
    expectedVersion: number,
    data: TUpdate,
    authCtx: AuthorizationContext
  ): Promise<void>;

  /**
   * Validate a staged delete inside the transaction. Verifies existence,
   * geographic authorization, and that nothing still references the record.
   */
  validateDelete(
    tx: BulkTx,
    id: string,
    expectedVersion: number,
    authCtx: AuthorizationContext
  ): Promise<void>;

  create(tx: BulkTx, data: TCreate): Promise<unknown>;
  updateWithVersion(
    tx: BulkTx,
    id: string,
    expectedVersion: number,
    data: TUpdate
  ): Promise<unknown>;
  delete(tx: BulkTx, id: string): Promise<void>;
}

export class BulkMutationService {
  constructor(
    private prisma: PrismaClient,
    private auditLogRepository?: AuditLogRepository
  ) {}

  async bulkMutate<TCreate, TUpdate>(
    req: BulkMutationRequest<TCreate, TUpdate>,
    authCtx: AuthorizationContext,
    adapter: BulkEntityAdapter<TCreate, TUpdate>
  ): Promise<BulkMutationResponse> {
    const totalChanges =
      req.creates.length + req.updates.length + req.deletes.length;

    // Empty change set is a valid no-op per spec (R10 doesn't require >0).
    if (totalChanges === 0) {
      return {
        success: true,
        applied: { created: 0, updated: 0, deleted: 0 },
        results: { creates: [], updates: [], deletes: [] },
      };
    }

    // Size cap enforced before any DB work (R9.6, R9.7).
    if (totalChanges > adapter.maxChanges) {
      throw new AppError(
        'BULK_TOO_LARGE',
        `Bulk request exceeds the maximum of ${adapter.maxChanges} total changes (got ${totalChanges})`,
        400,
        { max: adapter.maxChanges, received: totalChanges }
      );
    }

    const applied = await this.prisma.$transaction(async (tx) => {
      const results = {
        creates: [] as BulkCreateResult[],
        updates: [] as BulkUpdateResult[],
        deletes: [] as BulkDeleteResult[],
      };
      const errors: BulkErrorItem[] = [];

      // Phase 1 - validate everything inside the transaction. Collect all
      // errors (do not abort on first) so the response can tell the user
      // about every bad row at once.
      for (const d of req.deletes) {
        try {
          await adapter.validateDelete(tx, d.id, d.version, authCtx);
        } catch (e) {
          errors.push(toErrorItem(e, { id: d.id }));
        }
      }
      for (const u of req.updates) {
        try {
          await adapter.validateUpdate(tx, u.id, u.version, u.data, authCtx);
        } catch (e) {
          errors.push(toErrorItem(e, { id: u.id }));
        }
      }
      for (const c of req.creates) {
        try {
          await adapter.validateCreate(tx, c.data, authCtx);
        } catch (e) {
          errors.push(toErrorItem(e, { clientKey: c.clientKey }));
        }
      }

      if (errors.length > 0) {
        throw new BulkError(
          pickCode(errors),
          `No changes were applied. ${errors.length} of ${totalChanges} changes failed validation.`,
          errors,
          pickStatus(errors)
        );
      }

      // Phase 2 - apply changes. Order: deletes -> version-checked updates ->
      // creates. This avoids transient unique-constraint collisions when a
      // deleted row's unique key is reused by a staged create.
      for (const d of req.deletes) {
        try {
          await adapter.delete(tx, d.id);
          results.deletes.push({ ref: { id: d.id }, status: 'deleted' });
        } catch (e) {
          errors.push(toErrorItem(e, { id: d.id }));
        }
      }
      for (const u of req.updates) {
        try {
          const record = await adapter.updateWithVersion(tx, u.id, u.version, u.data);
          results.updates.push({ ref: { id: u.id }, status: 'updated', record });
        } catch (e) {
          errors.push(toErrorItem(e, { id: u.id }));
        }
      }
      for (const c of req.creates) {
        try {
          const record = await adapter.create(tx, c.data);
          results.creates.push({
            ref: { clientKey: c.clientKey },
            status: 'created',
            record,
          });
        } catch (e) {
          errors.push(toErrorItem(e, { clientKey: c.clientKey }));
        }
      }

      if (errors.length > 0) {
        throw new BulkError(
          pickCode(errors),
          `No changes were applied. ${errors.length} of ${totalChanges} changes failed to apply.`,
          errors,
          pickStatus(errors)
        );
      }

      return results;
    });

    // Transaction committed. Emit per-applied-change audit entries. Any audit
    // failure is logged but MUST NOT fail the request - the mutations have
    // already been durably applied.
    await this.emitAuditLogs(adapter, authCtx, applied);

    return {
      success: true,
      applied: {
        created: applied.creates.length,
        updated: applied.updates.length,
        deleted: applied.deletes.length,
      },
      results: applied,
    };
  }

  private async emitAuditLogs(
    adapter: BulkEntityAdapter<unknown, unknown>,
    authCtx: AuthorizationContext,
    applied: {
      creates: BulkCreateResult[];
      updates: BulkUpdateResult[];
      deletes: BulkDeleteResult[];
    }
  ): Promise<void> {
    if (!this.auditLogRepository) return;
    const userId = authCtx.userId || undefined;

    try {
      for (const c of applied.creates) {
        const entityId =
          (c.record as { id?: string } | null | undefined)?.id ?? 'unknown';
        await this.auditLogRepository.create({
          userId,
          actionType: `BULK_CREATE_${adapter.entityType}`,
          entityType: adapter.entityType,
          entityId,
          details: { bulk: true, clientKey: c.ref.clientKey },
        });
      }
      for (const u of applied.updates) {
        await this.auditLogRepository.create({
          userId,
          actionType: `BULK_UPDATE_${adapter.entityType}`,
          entityType: adapter.entityType,
          entityId: u.ref.id,
          details: { bulk: true },
        });
      }
      for (const d of applied.deletes) {
        await this.auditLogRepository.create({
          userId,
          actionType: `BULK_DELETE_${adapter.entityType}`,
          entityType: adapter.entityType,
          entityId: d.ref.id,
          details: { bulk: true },
        });
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to emit bulk mutation audit logs:', err);
    }
  }
}

function toErrorItem(e: unknown, ref: BulkChangeRef): BulkErrorItem {
  if (e instanceof AppError) {
    return { ref, code: e.code, message: e.message };
  }
  if (e instanceof Error) {
    if (e.message === 'VERSION_CONFLICT') {
      return {
        ref,
        code: 'VERSION_CONFLICT',
        message:
          'The record was modified by another user. Refresh and try again.',
      };
    }
    if (/not found/i.test(e.message)) {
      return { ref, code: 'NOT_FOUND', message: e.message };
    }
    if (/referenced by|referenced/i.test(e.message)) {
      return { ref, code: 'REFERENCED_ENTITY', message: e.message };
    }
    return { ref, code: 'VALIDATION_ERROR', message: e.message };
  }
  return { ref, code: 'INTERNAL_ERROR', message: 'Unknown error' };
}

function pickCode(errors: BulkErrorItem[]): string {
  if (errors.some((e) => e.code === 'VERSION_CONFLICT')) {
    return 'BULK_VERSION_CONFLICT';
  }
  if (errors.some((e) => e.code === 'GEOGRAPHIC_AUTHORIZATION_DENIED')) {
    return 'BULK_AUTHORIZATION_DENIED';
  }
  return 'BULK_VALIDATION_FAILED';
}

function pickStatus(errors: BulkErrorItem[]): number {
  if (errors.some((e) => e.code === 'VERSION_CONFLICT')) return 409;
  return 422;
}
