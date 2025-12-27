# Web Frontend Specification Update - Participant Activities Display

## Date
December 26, 2025

## Overview

Updated the web-frontend specification to provide detailed implementation guidance for displaying participant activities in the ParticipantDetail component. While Requirement 4.10 already specified this feature, the design and tasks documents lacked specific implementation details.

## Changes Made

### 1. Design Document ✅
**File:** `.kiro/specs/web-frontend/design.md`

**Updated ParticipantService:**
Added new method:
```typescript
- `getParticipantActivities(id)`: Fetches participant's activity assignments from `/participants/:id/activities`
```

**Updated ParticipantDetail Component Description:**
Made the description more specific about what the activities display should include:
- Lists all activities the participant is assigned to **in a table**
- Displays **activity name (with link to detail), type, role, status, dates, and notes** for each assignment
- Shows **loading state** while fetching activities
- Shows **empty state** when participant has no activity assignments

**Updated Assignment Interface:**
Added the `activity` field to support nested activity data:
```typescript
interface Assignment {
  id: string;
  activityId: string;
  participantId: string;
  roleId: string;
  notes?: string;
  participant?: Participant;
  role?: ParticipantRole;
  activity?: Activity;  // ← Added this field
  createdAt: string;
}
```

### 2. Tasks Document ✅
**File:** `.kiro/specs/web-frontend/tasks.md`

**Added Task 7.7:**
```markdown
- [ ] 7.7 Implement participant activities display
  - Add getParticipantActivities(id) method to ParticipantService
  - Update ParticipantDetail to fetch participant activities using /participants/:id/activities endpoint
  - Display activities table with columns: activity name (linked), type, role, status, dates, notes
  - Show loading state while fetching activities
  - Show empty state when participant has no activities
  - Format dates using formatDate() utility
  - Handle ongoing activities (display "Ongoing" instead of end date)
  - _Requirements: 4.10_
```

### 3. Requirements Document
**File:** `.kiro/specs/web-frontend/requirements.md`

**No changes needed** - Requirement 4.10 already specifies:
> THE Web_App SHALL display a detail view showing participant information and their activities

The requirement was already correct; only the implementation details were missing from design and tasks.

## Implementation Guidance

### Service Method

**File:** `web-frontend/src/services/api/participant.service.ts`

Add this method to ParticipantService:

```typescript
async getParticipantActivities(id: string): Promise<Assignment[]> {
  const response = await apiClient.get<APIResponse<Assignment[]>>(
    `/participants/${id}/activities`
  );
  return response.data.data;
}
```

### Component Update

**File:** `web-frontend/src/components/features/ParticipantDetail.tsx`

Replace the placeholder Activities container with:

```tsx
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import Badge from '@cloudscape-design/components/badge';

// Add query for activities
const { data: activities = [], isLoading: isLoadingActivities } = useQuery({
  queryKey: ['participantActivities', id],
  queryFn: () => ParticipantService.getParticipantActivities(id!),
  enabled: !!id,
});

// Helper function for status badge colors
const getStatusColor = (status: string) => {
  switch (status) {
    case 'PLANNED': return 'blue';
    case 'ACTIVE': return 'green';
    case 'COMPLETED': return 'grey';
    case 'CANCELLED': return 'red';
    default: return 'grey';
  }
};

// Replace placeholder container with:
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

## Dependencies

### Backend API Endpoint Required

This frontend implementation depends on the backend endpoint being implemented first:

**Endpoint:** `GET /api/v1/participants/:id/activities`

**Status:** ✅ Backend specification updated (see `.kiro/specs/backend-api/PARTICIPANT_ACTIVITIES_ENDPOINT_ADDED.md`)

**Implementation:** The backend has `AssignmentRepository.findByParticipantId()` which already returns the exact data structure needed. Just needs a service method wrapper and route handler.

## Data Flow

```
1. User navigates to ParticipantDetail page
2. Component fetches participant data: GET /participants/:id
3. Component fetches address history: GET /participants/:id/address-history
4. Component fetches activities: GET /participants/:id/activities
5. Display all three sections with proper loading states
```

## Table Columns

The activities table should display:

1. **Activity** - Name with link to activity detail page
2. **Type** - Activity type name (from nested activityType)
3. **Role** - Participant's role in this activity
4. **Status** - Activity status with color-coded badge
5. **Dates** - Start and end dates (or "Ongoing" for ongoing activities)
6. **Notes** - Assignment notes (or "-" if empty)

## Testing Considerations

### Unit Tests
- Test ParticipantDetail renders activities table
- Test loading state while fetching
- Test empty state when no activities
- Test activity links have correct href
- Test date formatting for finite and ongoing activities
- Test status badge colors

### Property Test (Optional)
- **Property 10:** For any participant, the detail view should display the participant's information and all activities they are assigned to
- Validates that all assignments are displayed
- Validates that activity and role details are included

### Integration Tests
- Test complete flow: login → navigate to participant → view activities
- Test clicking activity link navigates to activity detail
- Test with participant having multiple activities
- Test with participant having no activities

## Benefits

1. ✅ **Completes Feature:** Implements Requirement 4.10 fully
2. ✅ **Consistent Design:** Matches AddressHistoryTable style and pattern
3. ✅ **User Value:** Community organizers can see participant involvement at a glance
4. ✅ **Navigation:** Links enable quick navigation to activity details
5. ✅ **Complete Information:** Shows all relevant assignment data in one view

## Files Updated

### Specification Documents
1. ✅ `.kiro/specs/web-frontend/design.md` - Updated ParticipantService, ParticipantDetail description, Assignment interface
2. ✅ `.kiro/specs/web-frontend/tasks.md` - Added Task 7.7 for implementation
3. ℹ️ `.kiro/specs/web-frontend/requirements.md` - No changes needed (4.10 already correct)

### Implementation Files (To Be Updated)
- ⏭️ `web-frontend/src/services/api/participant.service.ts` - Add getParticipantActivities method
- ⏭️ `web-frontend/src/components/features/ParticipantDetail.tsx` - Replace placeholder with table
- ⏭️ `web-frontend/src/types/index.ts` - Verify Assignment interface includes activity field

## Related Backend Work

The backend specification has been updated to support this feature:

**Backend Status:** ✅ Specification complete
- Requirement 3.18 added
- Design updated with route and Property 18A
- Tasks updated with implementation guidance
- API contract documented

See `.kiro/specs/backend-api/PARTICIPANT_ACTIVITIES_ENDPOINT_ADDED.md` for details.

## Implementation Order

1. ✅ Update web-frontend specification (this document)
2. ⏭️ Implement backend endpoint (backend-api package)
3. ⏭️ Test backend endpoint
4. ⏭️ Implement frontend service method
5. ⏭️ Implement frontend component
6. ⏭️ Test frontend component
7. ⏭️ Integration test end-to-end

## Priority

**High Priority** - This is a core feature specified in the original requirements that is currently not implemented. Users need to see which activities a participant is involved in to effectively manage community engagement.

## Conclusion

The web-frontend specification has been updated with detailed implementation guidance for displaying participant activities. The specification now provides:

- ✅ Service method definition
- ✅ Component behavior description
- ✅ Data model with nested activity field
- ✅ Implementation task with specific requirements
- ✅ Complete code examples

Combined with the backend specification updates, both packages now have complete guidance for implementing this missing feature.

**Status:** ✅ SPECIFICATION UPDATE COMPLETE  
**Ready for Implementation:** ✅ YES (after backend endpoint is implemented)  
**Estimated Frontend Implementation Time:** 30-60 minutes
