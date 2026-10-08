# Design Document: Bulk Editing Feature

## Overview

This document describes the design for a **bulk editing** feature for the three high-volume
complex entities — **Venue**, **Participant**, and **Activity**. Users open a paginated,
spreadsheet-like table, edit many fields across many records inline, add and delete records,
and then either **Apply Changes** (persist the whole staged change set atomically) or
**Discard Changes** (abandon it). Nothing is persisted until Apply Changes is clicked —
a two-step persistence model.

The design reuses existing infrastructure wherever possible:

- **Routes → Services → Repositories (Prisma)** layering already used by every entity.
- **Pagination** via `parsePaginationParams` / `PaginationHelper` and the existing
  `GET /api/{entity}` list endpoints (no new read path needed for the table body).
- **Optimistic concurrency** via the per-entity `version` field and the existing
  `VERSION_CONFLICT` (409) convention.
- **Geographic authorization** via the existing `AuthorizationMiddleware`,
  `GeographicAuthorizationService`, and `extractAuthorizationContext` helpers.
- **AppError** and the standard error-code envelope (`VALIDATION_ERROR`, `NOT_FOUND`,
  `VERSION_CONFLICT`, `GEOGRAPHIC_AUTHORIZATION_DENIED`, `INTERNAL_ERROR`).
- **CloudScape** `Table` with inline editing on the frontend; **React Query** for data
  fetching; **Vitest** for frontend tests; **Jest** + mocked Prisma / real test DB for
  backend tests.

The feature is purely additive: it introduces one new backend endpoint per entity and a new
set of frontend components/hooks. It does not alter the Prisma schema, existing single-record
endpoints, or the merge/import flows.

## Architecture

### System Components

```
┌───────────────────────────────────────────────────────────────────────┐
│                            Frontend (React / CloudScape)                │
├───────────────────────────────────────────────────────────────────────┤
│  List Pages (existing)            Bulk Editing (new)                     │
│  - VenuesPage                     - BulkEditPage<T>                       │
│  - ParticipantsPage                 (route: /{entity}/bulk-edit)          │
│  - ActivitiesPage                 - BulkEditTable  (CloudScape Table,     │
│      │  "Bulk Edit" button          inline-editable cells)               │
│      └────────────────────▶       - BulkEditToolbar (Add / Apply /       │
│                                      Discard + change-set summary)        │
│                                   - useStagedChangeSet<T> (hook: the      │
│                                      staged-change state machine)         │
│                                   - useBulkMutation<T> (React Query       │
│                                      mutation → POST /{entity}/bulk)      │
│                                   - per-entity column/field config        │
└───────────────────────────────────────────────────────────────────────┘
                              │  GET  /api/{entity}?page&limit  (existing)
                              │  POST /api/{entity}/bulk        (new)
                              ▼
┌───────────────────────────────────────────────────────────────────────┐
│                           Backend API (Express)                         │
├───────────────────────────────────────────────────────────────────────┤
│  venue.routes.ts        + POST /bulk  → VenueService.bulkMutate()        │
│  participant.routes.ts  + POST /bulk  → ParticipantService.bulkMutate()  │
│  activity.routes.ts     + POST /bulk  → ActivityService.bulkMutate()     │
│                                                                          │
│  BulkMutationService<TCreate, TUpdate> (shared helper)                   │
│   - validates every change (reusing per-entity validators)              │
│   - runs one prisma.$transaction                                         │
│   - version checks, geo-auth checks, duplicate/reference checks         │
│   - returns per-change results                                          │
└───────────────────────────────────────────────────────────────────────┘
                              │  prisma.$transaction (atomic)
                              ▼
┌───────────────────────────────────────────────────────────────────────┐
│                          PostgreSQL (unchanged schema)                  │
└───────────────────────────────────────────────────────────────────────┘
```

### Why reuse the existing list endpoint for reads

The Bulk_Editing_View's table body is just a paginated list of the entity, already provided by
`GET /api/{entity}?page=&limit=` through `getXxxFlexible` → `PaginationHelper.createResponse`.
Reusing it means geographic filtering, field selection, and pagination semantics are identical
to the list page, with zero new read code and no risk of divergence. The only new backend
surface is the write path (`POST /bulk`).

## Frontend Design

### Staged change set: the core state machine

All staging logic lives in a single hook, `useStagedChangeSet<T>`, so it can be unit-tested in
isolation and shared across all three entities. It never calls an API.

```ts
// web-frontend/src/hooks/useStagedChangeSet.ts
type TempKey = `new-${string}`;          // client-generated key for staged creates
type RecordKey = string | TempKey;        // existing record id, or TempKey

interface StagedUpdate<T> {
  id: string;
  version: number;                        // version loaded from server (for OCC)
  changes: Partial<T>;                    // only the edited fields
}
interface StagedCreate<T> {
  tempKey: TempKey;
  values: Partial<T>;
}
interface StagedChangeSet<T> {
  updates: Map<string, StagedUpdate<T>>;
  creates: Map<TempKey, StagedCreate<T>>;
  deletes: Map<string, { id: string; version: number }>;
}
```

Operations exposed by the hook (all pure, synchronous, no I/O):

- `stageFieldEdit(key, field, value)` — records an update (or amends a create).
  If the new value equals the persisted value and no other field is dirty, the update entry is
  removed (so reverting a cell un-dirties it).
- `addRow()` — pushes a `StagedCreate` with a fresh `TempKey`.
- `stageDelete(id)` — marks an existing record for deletion; a record with both an update and a
  delete is treated as a delete (R6.5). Deleting a `StagedCreate` row removes it outright (R6.4).
- `unstageDelete(id)` / `removeCreate(tempKey)` — reverse operations.
- `discardAll()` — clears all three maps.
- `summary` — `{ creates, updates, deletes }` counts for the toolbar (R3.4).
- `isDirty(key)`, `cellIsDirty(key, field)` — drive visual indicators (R3.1–R3.3).

**Keying for pagination safety (R4.6):** the staged change set is keyed by stable identity
(`id` or `TempKey`), held in the hook which lives above the table and *outside* the per-page
data. Changing pages only swaps the fetched page data; the staged maps are untouched. When a
page renders, each row's displayed value is `stagedValue(key, field) ?? serverValue`, so edits
re-appear when the user returns to a page (R4.3).

### Components

- **`BulkEditPage<T>`** — route component (`/{entity}/bulk-edit`). Owns `useStagedChangeSet`,
  the React Query paginated read (`useQuery` on the existing list endpoint), the current page
  state, and `useBulkMutation`. Guards entry on role (R1.2) and shows a navigation-away warning
  when dirty (R7.5, via `beforeunload` + router block).
- **`BulkEditTable`** — a CloudScape `Table` with `submitEdit`/`ariaLabels` inline editing.
  Each column's `editConfig.editingCell` renders the type-appropriate control (R2.2):
  `Input` (text), `Input type="number"`, `DatePicker`, `Select` (enum like `venueType`,
  `ActivityStatus`), and an async entity `Select` reusing the existing `AsyncEntitySelect` for
  reference fields (`geographicAreaId`, `activityTypeId`). Row-level styling marks created /
  deleted / dirty rows (R3). A deleted row disables its cell editing (R6.2).
- **`BulkEditToolbar`** — "Add Row", "Discard Changes", "Apply Changes" buttons plus the live
  change-set summary. Apply is disabled while there are validation errors (R2.6) or the set is
  empty (R3.5); both are disabled while a mutation is in flight (R8.6).
- **`useBulkMutation<T>`** — React Query mutation that serializes the staged change set into a
  `Bulk_Mutation_Request` and POSTs it. On success: clear the set, invalidate/refetch the
  current page, toast a summary (R8.4). On failure: keep the set, surface per-change errors,
  and tag conflicting rows for version-conflict reconciliation (R11.3).

### Per-entity configuration

A small config object per entity keeps the components generic:

```ts
interface BulkEntityConfig<T> {
  entityPath: 'venues' | 'participants' | 'activities';
  columns: BulkColumnDef<T>[];     // field, header, cell renderer, editor, validators
  emptyRow: () => Partial<T>;      // defaults for a staged create
  clientValidate: (row: Partial<T>) => FieldErrors; // mirrors single-record rules (R2.5, R5.3)
}
```

Field-level client validation mirrors the server rules already encoded in each service
(e.g., venue latitude ∈ [-90, 90], longitude ∈ [-180, 180], required `name`/`address`),
so the user sees errors before Apply, but the server remains the source of truth (R2.5, R9.3).

### Frontend validation vs. server authority

Client validation is advisory and only gates the Apply button for a better UX. The backend
re-validates everything (R9.3); the frontend never assumes a change is valid just because it
passed client checks.

## Backend Design

### Request / response contract

One new endpoint per entity, mounted on the existing router:

```
POST /api/venues/bulk
POST /api/participants/bulk
POST /api/activities/bulk
```

Request body (`BulkMutationRequest<TCreate, TUpdate>`):

```jsonc
{
  "creates": [ { "clientKey": "new-abc", "data": { /* entity create fields */ } } ],
  "updates": [ { "id": "uuid", "version": 3, "data": { /* changed fields only */ } } ],
  "deletes": [ { "id": "uuid", "version": 5 } ]
}
```

Success response (`200`):

```jsonc
{
  "success": true,
  "applied": { "created": 1, "updated": 2, "deleted": 1 },
  "results": {
    "creates": [ { "clientKey": "new-abc", "status": "created", "record": { /* ... */ } } ],
    "updates": [ { "id": "uuid", "status": "updated", "record": { /* ... */ } } ],
    "deletes": [ { "id": "uuid", "status": "deleted" } ]
  }
}
```

Failure response (`409` for version conflicts, `422` for validation/reference/geo failures,
`400` for malformed/oversized requests) — **no changes applied** (R10.2–R10.3):

```jsonc
{
  "success": false,
  "applied": { "created": 0, "updated": 0, "deleted": 0 },
  "code": "BULK_VALIDATION_FAILED",            // or BULK_VERSION_CONFLICT, etc.
  "message": "No changes were applied. 2 of 4 changes failed.",
  "errors": [
    { "ref": { "id": "uuid" },          "code": "VERSION_CONFLICT",  "message": "..." },
    { "ref": { "clientKey": "new-x" },  "code": "VALIDATION_ERROR",  "message": "..." }
  ]
}
```

The response always echoes a stable `ref` (either `id` or `clientKey`) so the frontend can map
each result/error back to the exact row (R9.5, R11.3).

### Service layer

Each entity service gains a `bulkMutate()` method. The shared, generic orchestration lives in a
`BulkMutationService` helper to avoid three copies of the transaction/validation/authorization
skeleton; the per-entity service supplies the entity-specific validators and Prisma operations
via a small adapter.

```ts
// backend-api/src/services/bulk-mutation.service.ts
interface BulkEntityAdapter<TCreate, TUpdate> {
  entityType: 'VENUE' | 'PARTICIPANT' | 'ACTIVITY';
  maxChanges: number;                                   // R9.7
  validateCreate(tx, data, authCtx): Promise<void>;     // reuses existing create validation
  validateUpdate(tx, id, data, authCtx): Promise<Existing>; // existence + field + ref + geo
  assertDeletable(tx, id, authCtx): Promise<void>;      // existence + geo + reference checks
  create(tx, data): Promise<Record>;
  update(tx, id, expectedVersion, data): Promise<Record>; // version-checked
  delete(tx, id): Promise<void>;
}

async bulkMutate(req, authCtx): Promise<BulkResult> {
  this.assertSize(req);                                 // R9.6/R9.7 → 400 before any work
  return this.prisma.$transaction(async (tx) => {       // R10.1
    const errors = [];
    // 1. validate everything first (collect, do not abort on first)
    // 2. if any errors → throw BulkError(errors) → transaction rolls back (R10.2)
    // 3. apply deletes, then updates (version-checked), then creates
    // 4. return per-change results
  });
}
```

Key points:

- **Validate-then-apply within one transaction.** All validation runs inside the transaction
  against `tx` so existence/version/reference checks see a consistent snapshot. If any change is
  invalid, the service throws, Prisma rolls back, and the route maps the thrown `BulkError` to
  the per-change error response. This guarantees "all or nothing" (R10.1–R10.4).
- **Version checks (R11).** `update(tx, id, expectedVersion, data)` performs
  `updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } })`
  and treats a `count === 0` result as `VERSION_CONFLICT` for that row — the same optimistic
  pattern the single-record update already relies on, extended to batch.
- **Geographic authorization (R12).** Reuse `GeographicAuthorizationService.evaluateAccess` for
  each affected record and target area (e.g., a venue's `geographicAreaId` on create/update),
  exactly as the single-record services do. Failures become `403`-class per-change errors and
  roll back the whole transaction; denials are logged via the existing
  `logAuthorizationDenial`.
- **Ordering.** Apply deletes before updates/creates to avoid transient unique-constraint
  collisions (e.g., re-using a freed `email`), and surface any residual constraint error as a
  per-change `VALIDATION_ERROR`.
- **Audit (R13.3).** Emit audit-log entries per applied change, mirroring the single-record
  `AuditLoggingMiddleware` semantics (action type derived from create/update/delete, entityType,
  entityId). Because audit happens on commit, no entries are written on rollback.

### Route wiring

Mirror the existing single-record route middleware chain:

```ts
this.router.post(
  '/bulk',
  this.authMiddleware.authenticate(),
  this.authorizationMiddleware.requireEditor(),          // R13.1/R13.2
  ValidationMiddleware.validateBody(VenueBulkMutationSchema),
  this.bulkMutate.bind(this)
);
```

The route handler extracts `authorizedAreaIds` / `hasGeographicRestrictions` via
`extractAuthorizationContext`, calls `service.bulkMutate(req.body, authCtx)`, and maps the
result or a thrown `BulkError` to the response envelope and status (200 / 400 / 403 / 409 / 422
/ 500) consistent with existing handlers.

### Validation schemas

Add Zod schemas (`VenueBulkMutationSchema`, `ParticipantBulkMutationSchema`,
`ActivityBulkMutationSchema`) in `validation.schemas.ts`, composed from the existing per-entity
create/update schemas so field rules are defined once. The schema enforces array shape, the
presence of `version` on updates/deletes, and a top-level item-count ceiling (R9.7) producing a
`400` before any DB work.

## Data Model

No schema changes. The feature relies entirely on existing fields, including the `version`
column already present on `Venue`, `Participant`, and `Activity`.

Editable fields (authoritative list, matching Requirement 2.7):

| Entity      | Editable fields |
|-------------|-----------------|
| Venue       | name, address, geographicAreaId, latitude, longitude, venueType |
| Participant | name, email, phone, nickname, dateOfBirth, dateOfRegistration, notes |
| Activity    | name, activityTypeId, startDate, endDate, status, additionalParticipantCount, notes |

System-managed fields (`id`, `version`, `createdAt`, `updatedAt`) are never editable (R2.4).

## Error Handling

| Condition | Status | Code | Behavior |
|-----------|--------|------|----------|
| Malformed body / over size cap | 400 | `VALIDATION_ERROR` / `BULK_TOO_LARGE` | No DB work |
| Not an Editor_User | 403 | (middleware) | No DB work |
| Field/reference validation fails on any change | 422 | `BULK_VALIDATION_FAILED` | Rollback, per-change errors |
| Geo-auth denied on any change | 422 (per-change 403) | `GEOGRAPHIC_AUTHORIZATION_DENIED` | Rollback, logged |
| Version mismatch on any update | 409 | `BULK_VERSION_CONFLICT` | Rollback, conflicting ids reported |
| Unexpected failure | 500 | `INTERNAL_ERROR` | Rollback |
| All changes valid | 200 | — | Commit, per-change results |

The frontend maps each `ref` in `errors[]` to a row, shows inline messages, keeps the staged
change set (R8.5, R11.3), and for version conflicts offers a per-row "refresh and reconcile".

## Testing Strategy

### Backend unit tests (mocked Prisma, per entity) — R14.1

Using `createMockPrismaClient()` and a mocked `$transaction` (callback invoked with a mock `tx`):

- Mixed create + update + delete all valid → one transaction, correct per-change results.
- Field-level validation failure on one change → throws, no `tx` writes committed, per-change error.
- Reference-integrity failure (e.g., unknown `geographicAreaId` / `activityTypeId`) → rollback.
- Version conflict (update's `updateMany` count 0) → `BULK_VERSION_CONFLICT`, rollback.
- Geographic authorization denial on a create/update/delete → `403`-class error, rollback, denial logged.
- Over-cap request → `400` before any `tx` call.
- Empty change set → `200` with zero counts (and no `$transaction` side effects).

### Backend integration tests (real test DB, per entity) — R14.2/R14.3/R14.4

Following the project's isolation rules (unique suffixes, deterministic predefined data,
`TestHelpers.cleanupTestData`, `prisma.$disconnect`):

- **Happy path:** seed N records, POST a mixed change set, assert all committed and counts match.
- **Atomic rollback:** seed records, POST a change set where exactly one change is invalid
  (bad reference, stale version, or unauthorized area); assert the response reports failure AND
  that **every** record is byte-for-byte unchanged and no staged create/delete took effect
  (explicit "database equals pre-state" assertion — R14.3).
- **Version conflict:** load a record, bump its version out-of-band, POST an update with the
  stale version; assert 409 and no changes.
- **Authorization:** a non-editor token → 403; an editor restricted to area A attempting to
  touch an area-B record → rollback.

### Frontend tests (Vitest) — R14.5/R14.6

- `useStagedChangeSet` unit tests for every operation and the pagination-preservation invariant.
- A `BulkEditPage` test with a mocked API asserting **no POST occurs** until Apply is clicked,
  that Discard clears state and calls nothing, and that an Apply failure keeps the staged set.

## Rollout / Compatibility

Additive only (R15). New routes, new frontend route and components, new Zod schemas, new tests.
No migration, no change to existing single-record or merge/import endpoints, and the existing
Venues/Participants/Activities list and detail pages keep working unchanged. The feature can be
shipped behind the existing role gate without a feature flag, or gated by one if desired.
