# Participant Activities Endpoint - Specification Update

## Date
December 26, 2025

## Overview

Updated the backend-api specification to include a new endpoint for retrieving a participant's activity assignments. This endpoint addresses a missing feature identified in the web-frontend implementation where the ParticipantDetail page needs to display all activities a participant is assigned to.

## Changes Made

### 1. Requirements Document

**File:** `.kiro/specs/backend-api/requirements.md`

**Added Acceptance Criterion 3.18:**
```markdown
18. THE API SHALL provide a GET /api/participants/:id/activities endpoint that returns all activity assignments for the participant with activity and role details
```

This requirement ensures the backend provides the necessary data for the frontend to display a participant's activities.

### 2. Design Document

**File:** `.kiro/specs/backend-api/design.md`

**Updated Service Layer Description:**
- Updated ParticipantService description to include: "retrieves participant activity assignments"

**Added Route Handler:**
```
GET /api/v1/participants/:id/activities -> Get participant's activity assignments
```

**Added Correctness Property 18A:**
```markdown
**Property 18A: Participant activities retrieval**
*For any* existing participant, retrieving their activities should return all assignments with complete activity and role details.
**Validates: Requirements 3.18**
```

### 3. Tasks Document

**File:** `.kiro/specs/backend-api/tasks.md`

**Updated Task 7.4 (Create participant routes):**
- Added `GET /api/participants/:id/activities` to the list of routes
- Updated requirements reference to include 3.18

**Updated Task 7.3 (Property tests):**
- Added **Property 18A: Participant Activities Retrieval** to the test list
- Updated requirements validation to include 3.18

### 4. API Contract

**File:** `docs/API_CONTRACT.md`

**Added New Endpoint:**

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

## Implementation Notes

### Existing Infrastructure

The backend already has the necessary infrastructure to implement this endpoint:

1. **AssignmentRepository.findByParticipantId(participantId)**
   - Already exists and returns assignments with activity and role populated
   - Orders by createdAt descending
   - Includes nested activity with activityType
   - Includes nested role

2. **ParticipantRepository.findById(id)**
   - Already exists for validating participant existence

### Implementation Steps

The implementation should be straightforward:

1. **Add Service Method:**
   ```typescript
   async getParticipantActivities(participantId: string) {
     // Validate participant exists
     const participant = await this.participantRepository.findById(participantId);
     if (!participant) {
       throw new Error('Participant not found');
     }
     
     // Get assignments with activity and role details
     return this.assignmentRepository.findByParticipantId(participantId);
   }
   ```

2. **Add Route Handler:**
   ```typescript
   router.get('/participants/:id/activities', authenticate, async (req, res, next) => {
     try {
       const activities = await participantService.getParticipantActivities(req.params.id);
       res.json({ success: true, data: activities });
     } catch (error) {
       next(error);
     }
   });
   ```

3. **Add Tests:**
   - Test successful retrieval with populated activity and role
   - Test 404 when participant not found
   - Test empty array when participant has no activities
   - Test ordering (most recent first)

## Benefits

1. **Completes Feature:** Enables the frontend to display participant activities as specified in requirements
2. **Leverages Existing Code:** Uses existing repository method, minimal new code needed
3. **Consistent API Design:** Follows same pattern as other nested resource endpoints
4. **Symmetric Operations:** Complements the existing `/activities/:id/participants` endpoint

## Related Frontend Changes

Once this backend endpoint is implemented, the frontend needs:

1. **Service Method:** Add `ParticipantService.getParticipantActivities(id)` 
2. **Component Update:** Replace placeholder in ParticipantDetail with activities table
3. **Display:** Show activity name, type, role, status, dates, and notes
4. **Navigation:** Provide links to activity detail pages

See `.kiro/specs/web-frontend/PARTICIPANT_ACTIVITIES_MISSING.md` for complete frontend implementation details.

## Testing Strategy

### Unit Tests
- Test service method validates participant exists
- Test service method returns assignments from repository
- Test route handler returns 404 for non-existent participant
- Test route handler returns empty array for participant with no activities
- Test route handler returns properly formatted response

### Property Test
- **Property 18A:** For any existing participant, retrieving their activities should return all assignments with complete activity and role details
- Validates that the response includes all required nested fields
- Validates that assignments are correctly associated with the participant

### Integration Tests
- Test complete request/response cycle
- Test with participant having multiple activities
- Test with participant having no activities
- Test authentication requirement
- Test response format matches API contract

## Priority

**High Priority** - This is a core feature specified in the original requirements (Requirement 4.10) that was overlooked during initial implementation. It's essential for community organizers to see which activities a participant is involved in.

## Files Updated

### Specification Documents
1. ✅ `.kiro/specs/backend-api/requirements.md` - Added requirement 3.18
2. ✅ `.kiro/specs/backend-api/design.md` - Added route, updated service description, added Property 18A
3. ✅ `.kiro/specs/backend-api/tasks.md` - Updated task 7.4 and 7.3
4. ✅ `docs/API_CONTRACT.md` - Added endpoint documentation

### Implementation Files (To Be Updated)
- ⏭️ `backend-api/src/services/participant.service.ts` - Add getParticipantActivities method
- ⏭️ `backend-api/src/routes/participant.routes.ts` - Add GET /:id/activities route
- ⏭️ `backend-api/src/__tests__/routes/participant.routes.test.ts` - Add tests

## Next Steps

1. ✅ Update backend specifications
2. ⏭️ Implement backend endpoint
3. ⏭️ Write backend tests
4. ⏭️ Update frontend service
5. ⏭️ Implement frontend component
6. ⏭️ Write frontend tests
7. ⏭️ Update user documentation

## Conclusion

The backend-api specification has been updated to include the missing participant activities endpoint. The implementation should be straightforward since the underlying repository method already exists. This completes the specification alignment needed to fully implement the ParticipantDetail activities display feature.
