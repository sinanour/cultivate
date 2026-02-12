# Record Merge Feature - Implementation Status

## ✅ Completed (100% Backend + API Service)

### Backend Implementation
- ✅ **Merge Types & Infrastructure** (`backend-api/src/types/merge.types.ts`)
  - Base interfaces for merge services
  - Request/response types
  - Entity type definitions

- ✅ **Merge Services** (`backend-api/src/services/merge/`)
  - `ParticipantMergeService` - Migrates address history, assignments, populations
  - `ActivityMergeService` - Migrates assignments, venue history
  - `VenueMergeService` - Migrates activity/participant history
  - `GeographicAreaMergeService` - Migrates children, venues, authorizations
  - `ActivityTypeMergeService` - Migrates activity references
  - `PopulationMergeService` - Migrates participant memberships

- ✅ **API Routes** (`backend-api/src/routes/merge.routes.ts`)
  - POST `/api/v1/participants/:destinationId/merge`
  - POST `/api/v1/activities/:destinationId/merge`
  - POST `/api/v1/venues/:destinationId/merge`
  - POST `/api/v1/geographic-areas/:destinationId/merge`
  - POST `/api/v1/activity-types/:destinationId/merge`
  - POST `/api/v1/populations/:destinationId/merge`

- ✅ **Testing**
  - All 686 backend tests passing
  - Backend compiles with no errors/warnings

- ✅ **Frontend API Service** (`web-frontend/src/services/api/merge.service.ts`)
  - Client methods for all entity types
  - Type-safe request/response handling

## 🚧 Remaining Frontend Components

### Task 11: MergeInitiationModal Component
**Location**: `web-frontend/src/components/merge/MergeInitiationModal.tsx`

**Purpose**: Dialog for selecting source and destination records

**Key Features**:
- Pre-populate source with current entity
- Search/select destination entity
- Swap button to reverse source/destination
- Validation (source ≠ destination)
- Route to reconciliation (complex) or confirmation (simple)

**Props Interface**:
```typescript
interface MergeInitiationModalProps {
  entityType: 'participant' | 'activity' | 'venue' | 'geographicArea' | 'activityType' | 'population';
  currentEntityId: string;
  currentEntityName: string;
  isOpen: boolean;
  onDismiss: () => void;
  onConfirm: (sourceId: string, destinationId: string) => void;
}
```

**CloudScape Components**:
- `Modal` - Container
- `Select` or `Autosuggest` - Entity selection
- `Button` - Swap, Cancel, Confirm
- `FormField` - Field labels
- `Alert` - Validation errors

### Task 12: FieldReconciliationRow Component
**Location**: `web-frontend/src/components/merge/FieldReconciliationRow.tsx`

**Purpose**: Single field reconciliation with source, selector, and destination

**Key Features**:
- Read-only source field display
- Editable destination field
- SegmentedControl for "Take Source" / "Keep Target"
- Default to "Keep Target"
- Auto-switch to "Keep Target" on manual edit

**Props Interface**:
```typescript
interface FieldReconciliationRowProps {
  fieldName: string;
  fieldLabel: string;
  sourceValue: any;
  destinationValue: any;
  fieldType: 'text' | 'number' | 'date' | 'select';
  options?: { label: string; value: string }[];
  onDestinationChange: (value: any) => void;
  onSelectionChange: (selection: 'source' | 'target') => void;
  currentSelection: 'source' | 'target';
}
```

**CloudScape Components**:
- `FormField` - Wrapper for each column
- `Input` - Text fields
- `DatePicker` - Date fields
- `Select` - Dropdown fields
- `SegmentedControl` - Source/Target selector

### Task 13: ReconciliationPage Component
**Location**: `web-frontend/src/pages/merge/ReconciliationPage.tsx`

**Purpose**: Three-column layout for field-by-field reconciliation

**Key Features**:
- Fetch source and destination entities
- Render FieldReconciliationRow for each field
- Track reconciled values and selections
- Submit button with confirmation dialog
- Success/error handling

**State Management**:
```typescript
interface ReconciliationState {
  reconciledFields: Record<string, any>;
  fieldSelections: Record<string, 'source' | 'target'>;
  isSubmitting: boolean;
  showConfirmation: boolean;
}
```

**CloudScape Components**:
- `ContentLayout` - Page wrapper
- `ColumnLayout` with `columns={3}` - Three-column layout
- `SpaceBetween` - Vertical spacing
- `Button` - Submit, Cancel

**Field Positioning**:
- Source fields: positions 1, 4, 7, 10...
- Selectors: positions 2, 5, 8, 11...
- Destination fields: positions 3, 6, 9, 12...

### Task 14: MergeConfirmationDialog Component
**Location**: `web-frontend/src/components/merge/MergeConfirmationDialog.tsx`

**Purpose**: Final confirmation before executing merge

**Key Features**:
- Display source and destination names
- Warning about irreversible action
- Confirm and cancel buttons

**Props Interface**:
```typescript
interface MergeConfirmationDialogProps {
  entityType: string;
  sourceName: string;
  destinationName: string;
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}
```

**CloudScape Components**:
- `Modal` - Container
- `Box` - Content wrapper
- `Alert` type="warning" - Warning message
- `Button` - Confirm (variant="primary"), Cancel

### Task 15: Simple Entity Merge Flow
**Location**: Integrate into `MergeInitiationModal.tsx`

**Logic**:
```typescript
const isSimpleEntity = entityType === 'activityType' || entityType === 'population';

const handleConfirm = () => {
  if (isSimpleEntity) {
    // Show confirmation dialog directly
    setShowConfirmation(true);
  } else {
    // Navigate to reconciliation page
    navigate(`/merge/${entityType}/reconcile`, { 
      state: { sourceId, destinationId } 
    });
  }
};
```

### Task 16: Add Merge Buttons to Entity Detail Pages

**Files to Update**:
- `web-frontend/src/pages/participants/ParticipantDetail.tsx`
- `web-frontend/src/pages/activities/ActivityDetail.tsx`
- `web-frontend/src/pages/venues/VenueDetail.tsx`
- `web-frontend/src/pages/geographic-areas/GeographicAreaDetail.tsx`
- `web-frontend/src/pages/activity-types/ActivityTypeDetail.tsx`
- `web-frontend/src/pages/populations/PopulationDetail.tsx`

**Implementation Pattern**:
```typescript
import { ResponsiveButton } from '../../components/common/ResponsiveButton';
import { MergeInitiationModal } from '../../components/merge/MergeInitiationModal';

// In component state
const [showMergeModal, setShowMergeModal] = useState(false);

// In action buttons section
<ResponsiveButton
  icon="shrink"
  onClick={() => setShowMergeModal(true)}
>
  Merge
</ResponsiveButton>

// At end of component
<MergeInitiationModal
  entityType="participant" // or appropriate type
  currentEntityId={participant.id}
  currentEntityName={participant.name}
  isOpen={showMergeModal}
  onDismiss={() => setShowMergeModal(false)}
  onConfirm={handleMergeConfirm}
/>
```

## 📋 Implementation Checklist

### Immediate Next Steps
1. ✅ Create merge API service
2. ⬜ Create `web-frontend/src/components/merge/` directory
3. ⬜ Implement `MergeConfirmationDialog.tsx` (simplest component)
4. ⬜ Implement `FieldReconciliationRow.tsx`
5. ⬜ Implement `MergeInitiationModal.tsx`
6. ⬜ Implement `ReconciliationPage.tsx`
7. ⬜ Add merge buttons to all 6 entity detail pages
8. ⬜ Add routes for reconciliation pages
9. ⬜ Test frontend compilation
10. ⬜ Manual testing of merge flows
11. ⬜ Write frontend unit tests (optional for MVP)

### Testing Strategy
- **Manual Testing**: Test each entity type merge flow
- **Complex Entities**: Verify reconciliation page works correctly
- **Simple Entities**: Verify direct confirmation works
- **Error Handling**: Test validation errors and API errors
- **Mobile**: Test responsive layout on small screens

### Key Design Decisions
- **CloudScape Components**: Use throughout for consistency
- **Responsive Design**: ColumnLayout automatically handles mobile
- **State Management**: Local component state (no Redux needed)
- **Routing**: Use React Router for reconciliation pages
- **Error Handling**: Display API errors in Alert components

## 🔧 Development Commands

### Backend
```bash
cd backend-api
npm run build    # Compile TypeScript
npm test         # Run all tests
npm run dev      # Start development server
```

### Frontend
```bash
cd web-frontend
npm run build    # Build for production
npm run dev      # Start development server
npm test         # Run tests
npm run lint     # Check code quality
```

## 📚 Reference Documentation

### CloudScape Components Used
- [Modal](https://cloudscape.design/components/modal/)
- [ColumnLayout](https://cloudscape.design/components/column-layout/)
- [FormField](https://cloudscape.design/components/form-field/)
- [Input](https://cloudscape.design/components/input/)
- [Select](https://cloudscape.design/components/select/)
- [SegmentedControl](https://cloudscape.design/components/segmented-control/)
- [Button](https://cloudscape.design/components/button/)
- [Alert](https://cloudscape.design/components/alert/)

### API Endpoints
All endpoints require authentication and EDITOR role:
- `POST /api/v1/participants/:destinationId/merge`
- `POST /api/v1/activities/:destinationId/merge`
- `POST /api/v1/venues/:destinationId/merge`
- `POST /api/v1/geographic-areas/:destinationId/merge`
- `POST /api/v1/activity-types/:destinationId/merge`
- `POST /api/v1/populations/:destinationId/merge`

Request body:
```json
{
  "sourceId": "uuid",
  "reconciledFields": {
    "field1": "value1",
    "field2": "value2"
  }
}
```

Response (success):
```json
{
  "success": true,
  "destinationEntity": { ... },
  "message": "Records merged successfully"
}
```

Response (error):
```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional details"
}
```

## 🎯 Success Criteria

### Backend (✅ Complete)
- [x] All merge services implemented
- [x] All API routes working
- [x] Transaction atomicity ensured
- [x] Duplicate detection working
- [x] All tests passing (686/686)
- [x] No compilation errors

### Frontend (🚧 In Progress)
- [x] Merge API service created
- [ ] All merge components implemented
- [ ] Merge buttons on all detail pages
- [ ] Reconciliation flow working
- [ ] Simple entity flow working
- [ ] Frontend compiles without errors
- [ ] Manual testing complete

### Integration (⬜ Pending)
- [ ] End-to-end merge flows tested
- [ ] Error handling verified
- [ ] Mobile responsiveness confirmed
- [ ] All entity types tested

## 📝 Notes

- Backend is production-ready and fully tested
- Frontend implementation follows existing patterns in codebase
- CloudScape components ensure consistent UI/UX
- Mobile responsiveness handled by ColumnLayout
- No breaking changes to existing functionality
