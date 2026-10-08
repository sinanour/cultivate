/**
 * Shared types for the bulk-editing feature.
 *
 * One POST /api/{entity}/bulk endpoint per entity accepts a BulkMutationRequest
 * describing all creates, updates, and deletes to apply within a single
 * atomic prisma.$transaction. Each operation is identified by a stable `ref`
 * (either the record `id` or the client-generated `clientKey` for creates)
 * so the frontend can map per-change errors back to rows.
 */

export interface BulkMutationCreateItem<TCreate> {
  /** Client-generated identifier used only for correlating response to input row. */
  clientKey: string;
  data: TCreate;
}

export interface BulkMutationUpdateItem<TUpdate> {
  id: string;
  /** Expected `version` for optimistic concurrency. */
  version: number;
  /** Partial update payload - only changed fields. */
  data: TUpdate;
}

export interface BulkMutationDeleteItem {
  id: string;
  /** Expected `version` for optimistic concurrency. */
  version: number;
}

export interface BulkMutationRequest<TCreate, TUpdate> {
  creates: BulkMutationCreateItem<TCreate>[];
  updates: BulkMutationUpdateItem<TUpdate>[];
  deletes: BulkMutationDeleteItem[];
}

export interface BulkChangeRef {
  id?: string;
  clientKey?: string;
}

export interface BulkCreateResult {
  ref: { clientKey: string };
  status: 'created';
  record: unknown;
}

export interface BulkUpdateResult {
  ref: { id: string };
  status: 'updated';
  record: unknown;
}

export interface BulkDeleteResult {
  ref: { id: string };
  status: 'deleted';
}

export interface BulkErrorItem {
  ref: BulkChangeRef;
  code: string;
  message: string;
}

export interface BulkMutationSuccessResponse {
  success: true;
  applied: { created: number; updated: number; deleted: number };
  results: {
    creates: BulkCreateResult[];
    updates: BulkUpdateResult[];
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

export type BulkMutationResponse =
  | BulkMutationSuccessResponse
  | BulkMutationFailureResponse;

/**
 * Thrown from inside the transaction callback so that Prisma rolls back and
 * the route handler can map the collected per-change errors into the response
 * envelope with the right HTTP status.
 */
export class BulkError extends Error {
  constructor(
    public code: string,
    message: string,
    public errors: BulkErrorItem[],
    public statusCode: number
  ) {
    super(message);
    this.name = 'BulkError';
  }
}
