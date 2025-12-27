# Participant Activities Display - Missing Implementation

## Date
December 26, 2025

## Issue Summary

The ParticipantDetail page has a placeholder "Activities" container that is not fully implemented. According to the requirements and design specifications, this container should display all activities that the participant is assigned to, along with their roles.

## Current State

**File:** `web-frontend/src/components/features/ParticipantDetail.tsx`

**Current Implementation:**
```tsx
<Container header={<Header variant="h3">Activities</Header>}>
  <Box textAlign="center" color="inherit">
    <b>Activities list</b>
    <Box padding={{ bottom: 's' }} variant="p" color="inherit">
      Activity assignments will be displayed here once implemented.
    </Box>
  </Box>
</Container>
```

## Requirements

### Requirement 4.10 (Web Frontend)
**Acceptance Criteria:**
> THE Web_App SHALL display a detail view showing participant information **and their activities**

### Design Specification (Web Frontend)
**ParticipantDetail Component:**
- Shows participant information in detail view
- **Lists all activities the participant is assigned to**
- **Displays roles for each activity assignment**
- Shows address history table in reverse chronological order
- Provides interface to add new address history records
- Provides interface to edit existing address history records
- Provides interface to delete address history records

## Root Cause

### Missing Backend API Endpoint

The backend API does not expose an endpoint to retrieve a participant's activities. While the `AssignmentRepository` has a `findByParticipantId` method that returns assignments with activity and role information, there is no corresponding HTTP endpoint.

**What Exists:**
- ✅ `AssignmentRepository.findByParticipantId(participantId)` - Returns assignments with activity and role
- ✅ `GET /activities/:activityId/participants` - Returns participants for an activity

**What's Missing:**
- ❌ `GET /participants/:id/activities` - Should return activities for a participant

### Missing Frontend Service Method

The frontend `ParticipantService` does not have a method to fetch participant activities.

**What Exists:**
- ✅ `ParticipantService.getParticipant(id)` - Fetches participant details
- ✅ `ParticipantAddressHistoryService.getAddressHistory(participantId)` - Fetches address history

**What's Missing:**
- ❌ `ParticipantService.getParticipantActivities(id)` - Should fetch participant's activities

## Proposed Solution

### 1. Backend API Changes

#### Add Endpoint to API Contract

**File:** `docs/API_CONTRACT.md`

Add new endpoint under the "Participants" section:

```markdown
### Get Participant Activities

**Endpoint**: `GET /participants/:id/activities`

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    {
      "id": "string (UUID)",
      "activityId": "string (UUID)",
      "participantId": "string (UUID)",
      "roleId": "string (UUID)",
      "notes": "string | null",
      "activity": {
        "id": "string (UUID)",
        "name": "string",
        "activityTypeId": "string (UUID)",
        "activityType": {
          "id": "string (UUID)",
          "name": "string",
          "isPredefined": "boolean"
        },
        "status": "PLANNED | ACTIVE | COMPLETED | CANCELLED",
        "startDate": "string (ISO 8601)",
        "endDate": "string | null (ISO 8601)",
        "isOngoing": "boolean"
      },
      "role": {
        "id": "string (UUID)",
        "name": "string",
        "isPredefined": "boolean"
      },
      "createdAt": "string (ISO 8601)"
    }
  ]
}
```

**Errors**:
- 404: Participant not found
```

#### Backend Implementation Tasks

**File:** `.kiro/specs/backend-api/tasks.md`

Add new task:

```markdown
- [ ] X. Add participant activities endpoint
  - [ ] X.1 Add route GET /participants/:id/activities
    - Use existing AssignmentRepository.findByParticipantId method
    - Return assignments with activity and role populated
    - _Requirements: Backend API 3.X (new requirement needed)_
  
  - [ ] X.2 Add ParticipantService.getParticipantActivities method
    - Validate participant exists
    - Call AssignmentRepository.findByParticipantId
    - Return formatted response
    - _Requirements: Backend API 3.X_
  
  - [ ] X.3 Write unit tests for participant activities endpoint
    - Test successful retrieval
    - Test participant not found error
    - Test empty activities list
    - _Requirements: Backend API 3.X_
```

#### Backend Requirements Update

**File:** `.kiro/specs/backend-api/requirements.md`

Add new acceptance criterion under Requirement 3 (Participant Management):

```markdown
3.X. WHEN requesting a participant's activities, THE Backend_API SHALL return all activity assignments for that participant with activity and role details
```

### 2. Frontend Changes

#### Frontend Service Implementation

**File:** `web-frontend/src/services/api/participant.service.ts`

Add new method:

```typescript
async getParticipantActivities(id: string): Promise<Assignment[]> {
  const response = await apiClient.get<APIResponse<Assignment[]>>(
    `/participants/${id}/activities`
  );
  return response.data.data;
}
```

#### Frontend Component Implementation

**File:** `web-frontend/src/components/features/ParticipantDetail.tsx`

Replace the placeholder Activities container with:

```tsx
const { data: activities = [], isLoading: isLoadingActivities } = useQuery({
  queryKey: ['participantActivities', id],
  queryFn: () => ParticipantService.getParticipantActivities(id!),
  enabled: !!id,
});

// In the render:
<Container header={<Header variant="h3">Activities</Header>}>
  {isLoadingActivities ? (
    <Box textAlign="center" padding="xxl">
      <Spinner size="large" />
    </Box>
  ) : activities.length === 0 ? (
    <Box textAlign="center" color="inherit">
      <Box variant="p" color="inherit">
        No activity assignments found.
      </Box>
    </Box>
  ) : (
    <Table
      columnDefinitions={[
        {
          id: 'activity',
          header: 'Activity',
          cell: (item) => (
            <Link href={`/activities/${item.activityId}`}>
              {item.activity.name}
            </Link>
          ),
        },
        {
          id: 'type',
          header: 'Type',
          cell: (item) => item.activity.activityType.name,
        },
        {
          id: 'role',
          header: 'Role',
          cell: (item) => item.role.name,
        },
        {
          id: 'status',
          header: 'Status',
          cell: (item) => (
            <Badge color={getStatusColor(item.activity.status)}>
              {item.activity.status}
            </Badge>
          ),
        },
        {
          id: 'dates',
          header: 'Dates',
          cell: (item) => {
            if (item.activity.isOngoing) {
              return `${formatDate(item.activity.startDate)} - Ongoing`;
            }
            return `${formatDate(item.activity.startDate)} - ${formatDate(item.activity.endDate)}`;
          },
        },
        {
          id: 'notes',
          header: 'Notes',
          cell: (item) => item.notes || '-',
        },
      ]}
      items={activities}
      variant="embedded"
      empty={
        <Box textAlign="center" color="inherit">
          <b>No activities</b>
          <Box padding={{ bottom: 's' }} variant="p" color="inherit">
            This participant is not assigned to any activities.
          </Box>
        </Box>
      }
    />
  )}
</Container>
```

#### Frontend Tasks Update

**File:** `.kiro/specs/web-frontend/tasks.md`

Add new sub-task under Task 7 (Implement participant management UI):

```markdown
- [ ] 7.7 Implement participant activities display
  - Add ParticipantService.getParticipantActivities method
  - Update ParticipantDetail to fetch and display activities
  - Display activity name, type, role, status, dates, and notes in table
  - Provide link to activity detail view
  - Show loading state while fetching
  - Show empty state when no activities
  - _Requirements: 4.10_
```

## Data Model

### Assignment Type (Frontend)

The frontend already has the `Assignment` type defined:

```typescript
interface Assignment {
  id: string;
  activityId: string;
  participantId: string;
  roleId: string;
  notes?: string;
  participant?: Participant;
  role?: ParticipantRole;
  activity?: Activity;
  createdAt: string;
}
```

This type already supports the nested `activity` and `role` objects needed for display.

## Testing Considerations

### Backend Tests
- Test GET /participants/:id/activities returns correct assignments
- Test 404 when participant not found
- Test empty array when participant has no activities
- Test activity and role are properly populated

### Frontend Tests
- Test ParticipantDetail displays activities table
- Test loading state while fetching activities
- Test empty state when no activities
- Test activity links navigate to correct detail page
- Test date formatting for finite and ongoing activities

## Priority

**High Priority** - This is a core feature specified in the requirements that is currently not implemented. Users cannot see which activities a participant is involved in, which is essential for community organizers.

## Implementation Order

1. ✅ Document the issue (this document)
2. ⏭️ Update backend API contract
3. ⏭️ Update backend requirements
4. ⏭️ Implement backend endpoint
5. ⏭️ Update frontend service
6. ⏭️ Implement frontend component
7. ⏭️ Write tests
8. ⏭️ Update user documentation

## Related Files

### Backend
- `docs/API_CONTRACT.md` - API contract documentation
- `.kiro/specs/backend-api/requirements.md` - Backend requirements
- `.kiro/specs/backend-api/design.md` - Backend design
- `.kiro/specs/backend-api/tasks.md` - Backend tasks
- `backend-api/src/repositories/assignment.repository.ts` - Already has findByParticipantId method
- `backend-api/src/services/participant.service.ts` - Needs new method
- `backend-api/src/routes/participant.routes.ts` - Needs new route

### Frontend
- `.kiro/specs/web-frontend/requirements.md` - Frontend requirements (4.10)
- `.kiro/specs/web-frontend/design.md` - Frontend design (ParticipantDetail)
- `.kiro/specs/web-frontend/tasks.md` - Frontend tasks (Task 7)
- `web-frontend/src/services/api/participant.service.ts` - Needs new method
- `web-frontend/src/components/features/ParticipantDetail.tsx` - Needs implementation
- `web-frontend/src/types/index.ts` - Assignment type already defined

## Notes

- The backend repository method already exists (`AssignmentRepository.findByParticipantId`), so the backend implementation should be straightforward
- The frontend already has the `Assignment` type with nested `activity` and `role` objects
- The design should match the existing AddressHistoryTable component style for consistency
- Consider adding a filter or sort capability if participants have many activities
- The table should be responsive and work on tablet devices (768px+)
