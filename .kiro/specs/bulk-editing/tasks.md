# Implementation Plan: Bulk Editing Feature

This plan implements the bulk editing feature for Venue, Participant, and Activity per
`requirements.md` and `design.md`. Backend is built and verified first (comprehensive tests),
then the frontend. Each task references the requirements it satisfies.

## Backend

- [ ] 1. Add bulk mutation validation schemas
  - Add `VenueBulkMutationSchema`, `ParticipantBulkMutationSchema`, `ActivityBulkMutationSchema`
    to `backend-api/src/utils/validation.schemas.ts`, composed from the existing per-entity
    create/update schemas.
  - Enforce: `creates[]`/`updates[]`/`deletes[]` shape, `version` required on updates and
    deletes, `clientKey` on creates, and a top-level max item count.
  - _Requirements: 9.1, 9.2, 9.6, 9.7, 15.1_

- [ ] 2. Implement the shared `BulkMutationService`
  - Create `backend-api/src/services/bulk-mutation.service.ts` with a generic
    `bulkMutate(req, authCtx)` that: asserts size (→ 400), opens one `prisma.$transaction`,
    validates every change against a supplied `BulkEntityAdapter`, and on any error throws a
    `BulkError` carrying per-change results so the transaction rolls back.
  - Apply order: deletes → version-checked updates → creates. Return per-change results keyed by
    `id`/`clientKey`.
  - Add a `BulkError` type and per-change result/error types to `backend-api/src/types`.
  - _Requirements: 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 3. Implement version-checked batch update primitive
  - In each repository (`venue`, `participant`, `activity`), add a transaction-aware
    `updateWithVersion(tx, id, expectedVersion, data)` using
    `updateMany({ where: { id, version: expectedVersion }, data: { ...data, version: { increment: 1 } } })`
    and treat `count === 0` as a `VERSION_CONFLICT`.
  - _Requirements: 11.1, 11.2, 11.4_

- [ ] 4. Wire each entity service to the bulk helper
  - Add `bulkMutate()` to `VenueService`, `ParticipantService`, `ActivityService`, each
    providing a `BulkEntityAdapter` that reuses existing field validation, reference-integrity
    checks (geographicArea / activityType existence), geographic authorization
    (`GeographicAuthorizationService.evaluateAccess`), and delete reference checks.
  - _Requirements: 9.3, 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 5. Add the `POST /bulk` routes
  - Add the route to `venue.routes.ts`, `participant.routes.ts`, `activity.routes.ts` with the
    middleware chain: `authenticate` → `requireEditor` → `validateBody(<schema>)` → handler.
  - Handler extracts auth context via `extractAuthorizationContext`, calls `service.bulkMutate`,
    and maps success/`BulkError` to the response envelope and status (200/400/403/409/422/500).
  - _Requirements: 9.1, 9.5, 9.6, 10.3, 13.1, 13.2_

- [ ] 6. Add audit logging for bulk mutations
  - Emit per-applied-change audit entries on commit, mirroring single-record audit semantics
    (action type, entityType, entityId). Ensure no entries are written on rollback.
  - _Requirements: 13.3_

- [ ] 7. Backend unit tests (mocked Prisma) — per entity
  - For venue, participant, activity: successful mixed create/update/delete; field validation
    failure; reference-integrity failure; version conflict; geo-auth denial; over-cap → 400;
    empty change set → 200 with zero counts. Mock `$transaction` to invoke the callback with a
    mock `tx`; assert rollback paths perform no committed writes.
  - _Requirements: 14.1_

- [ ] 8. Backend integration tests (real test DB) — per entity
  - Happy path commits all changes. Atomic-rollback test: exactly one invalid change
    (bad reference / stale version / unauthorized area) → failure response AND an explicit
    assertion that every pre-existing record is unchanged and no staged create/delete took
    effect. Version-conflict and authorization (non-editor 403, cross-area rollback) cases.
  - Follow isolation rules: unique suffixes, deterministic predefined data,
    `TestHelpers.cleanupTestData`, `prisma.$disconnect`.
  - _Requirements: 14.2, 14.3, 14.4_

- [ ] 9. Build and verify backend
  - Run lint, typecheck, and `npm test` for the backend; fix all failures. Confirm the atomic
    rollback assertions pass.
  - _Requirements: 14.1, 14.2, 14.3_

## Frontend

- [ ] 10. Implement `useStagedChangeSet<T>` hook
  - Pure state machine: `stageFieldEdit`, `addRow`, `stageDelete`, `unstageDelete`,
    `removeCreate`, `discardAll`, `summary`, `isDirty`, `cellIsDirty`. Keyed by `id`/`TempKey`.
    Reverting a cell to its persisted value un-dirties it; delete supersedes update; deleting a
    staged create removes it outright.
  - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.4, 4.6, 5.1, 5.4, 5.5, 6.1, 6.3, 6.4, 6.5, 7.2_

- [ ] 11. Implement per-entity bulk config
  - `BulkEntityConfig<T>` for venue, participant, activity: column defs (header, cell renderer,
    editor control by type, client validators mirroring server rules), `emptyRow()`, and
    `clientValidate()`.
  - _Requirements: 2.2, 2.4, 2.5, 2.7, 5.3_

- [ ] 12. Implement `useBulkMutation<T>` (React Query)
  - Serialize the staged change set into a `BulkMutationRequest` and POST to `/{entity}/bulk`.
    On success: clear set, refetch current page, toast summary. On failure: keep set, map
    per-change `ref` errors to rows, flag version conflicts for reconciliation.
  - _Requirements: 8.1, 8.3, 8.4, 8.5, 11.3_

- [ ] 13. Implement `BulkEditTable`, `BulkEditToolbar`, `BulkEditPage<T>`
  - CloudScape inline-editable `Table`; type-appropriate editors incl. `AsyncEntitySelect` for
    reference fields; row styling for created/deleted/dirty rows; deleted rows disable editing.
  - Toolbar: Add Row / Discard / Apply + live summary; Apply disabled on validation errors or
    empty set; both disabled while a mutation is in flight (progress indicator).
  - Page: owns the hook, the paginated `useQuery` on the existing list endpoint, page state,
    role guard on entry, and a navigation-away warning when dirty.
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.6, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 5.2, 6.2, 7.1, 7.3, 7.4, 7.5, 8.2, 8.6_

- [ ] 14. Add route and list-page entry points
  - Register the `/{entity}/bulk-edit` route; add the "Bulk Edit" action to VenuesPage,
    ParticipantsPage, ActivitiesPage, visible/enabled only for Editor_User roles.
  - _Requirements: 1.1, 1.2, 1.5_

- [ ] 15. Frontend tests (Vitest)
  - `useStagedChangeSet` unit tests for every operation and the pagination-preservation
    invariant. `BulkEditPage` test (mocked API) asserting no POST before Apply, Discard clears
    and calls nothing, Apply failure retains the staged set.
  - _Requirements: 14.5, 14.6_

- [ ] 16. Build and verify frontend
  - Run lint, typecheck, and the Vitest suite; fix all failures.
  - _Requirements: 14.5, 14.6_

## Documentation

- [ ] 17. Update API docs
  - Document `POST /api/{venues,participants,activities}/bulk` (request/response envelope,
    status codes, per-change `ref` semantics) in `docs/API_CONTRACT.md`.
  - _Requirements: 9.1, 9.5, 15.1_
