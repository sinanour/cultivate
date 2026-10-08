import { ApiClient } from './api.client';

/**
 * Request / response contracts for POST /api/{entity}/bulk.
 *
 * These are shared across venues, participants, and activities. Server-side
 * schemas are the authoritative source of truth; this file exists to let
 * typed callers construct bulk requests without duplicating field lists.
 */

export interface BulkCreateItem<TCreate> {
    /** Client-generated identifier - correlates response back to the staged row. */
    clientKey: string;
    data: TCreate;
}

export interface BulkUpdateItem<TUpdate> {
    id: string;
    version: number;
    /** Only the edited fields. */
    data: TUpdate;
}

export interface BulkDeleteItem {
    id: string;
    version: number;
}

export interface BulkMutationRequest<TCreate, TUpdate> {
    creates: BulkCreateItem<TCreate>[];
    updates: BulkUpdateItem<TUpdate>[];
    deletes: BulkDeleteItem[];
}

export interface BulkCreateResult<TRecord> {
    ref: { clientKey: string };
    status: 'created';
    record: TRecord;
}
export interface BulkUpdateResult<TRecord> {
    ref: { id: string };
    status: 'updated';
    record: TRecord;
}
export interface BulkDeleteResult {
    ref: { id: string };
    status: 'deleted';
}

export interface BulkErrorItem {
    ref: { id?: string; clientKey?: string };
    code: string;
    message: string;
}

export interface BulkMutationSuccessResponse<TRecord> {
    success: true;
    applied: { created: number; updated: number; deleted: number };
    results: {
        creates: BulkCreateResult<TRecord>[];
        updates: BulkUpdateResult<TRecord>[];
        deletes: BulkDeleteResult[];
    };
}

export interface BulkMutationFailureResponse {
    success: false;
    applied: { created: 0; updated: 0; deleted: 0 };
    code: string;
    message: string;
    errors: BulkErrorItem[];
}

export type BulkMutationResponse<TRecord> =
    | BulkMutationSuccessResponse<TRecord>
    | BulkMutationFailureResponse;

/**
 * BulkService - single parameterised client for every bulk endpoint. Keeps
 * the per-entity services thin: they only need to spell out their TCreate /
 * TUpdate / TRecord types.
 */
export class BulkService {
    static async submit<TRecord, TCreate = unknown, TUpdate = unknown>(
        entityPath: 'venues' | 'participants' | 'activities',
        request: BulkMutationRequest<TCreate, TUpdate>
    ): Promise<BulkMutationResponse<TRecord>> {
        return ApiClient.post<BulkMutationResponse<TRecord>>(
            `/${entityPath}/bulk`,
            request
        );
    }
}
