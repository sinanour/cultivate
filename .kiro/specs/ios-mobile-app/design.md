# Design Document: iOS Mobile App Package

## Overview

The iOS Mobile App is a native application built with Swift and SwiftUI that provides community organizers with tools to manage activities, participants, and view analytics. The application follows an offline-first architecture using Core Data for local persistence and URLSession for API communication. It supports iOS 16.0+ on both iPhone and iPad devices.

**Key Design Principles:**
- **Offline-First**: All data is cached locally and operations work without connectivity
- **Native Experience**: Follows Apple Human Interface Guidelines and uses native iOS patterns
- **Reactive Architecture**: Uses Combine framework for data flow and state management
- **Secure by Default**: Credentials stored in Keychain, all API calls authenticated
- **Accessible**: Full VoiceOver support, Dynamic Type, and accessibility features

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     SwiftUI Views                        │
│  (Activities, Participants, Analytics, Settings)         │
└────────────────┬────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────┐
│                    View Models                           │
│         (ObservableObject + @Published)                  │
└────┬───────────────────────────────────┬────────────────┘
     │                                   │
┌────▼──────────────┐          ┌────────▼────────────────┐
│  Service Layer    │          │   Core Data Stack       │
│  - APIService     │◄────────►│   - Models              │
│  - AuthService    │          │   - Context             │
│  - SyncService    │          │   - Persistence         │
└────┬──────────────┘          └─────────────────────────┘
     │
┌────▼──────────────┐
│  Network Layer    │
│  - URLSession     │
│  - Keychain       │
└───────────────────┘
```

**Design Rationale:**
- **MVVM Pattern**: Separates UI (Views) from business logic (ViewModels) and data (Models)
- **Service Layer**: Encapsulates API communication, authentication, and synchronization logic
- **Core Data**: Provides robust offline storage with relationship management and querying
- **Combine**: Enables reactive data flow from Core Data through ViewModels to Views

### Component Responsibilities

**Views (SwiftUI)**
- Render UI based on ViewModel state
- Handle user interactions
- Display loading, error, and empty states
- Support accessibility features

**ViewModels**
- Manage view state using `@Published` properties
- Coordinate between Services and Views
- Handle business logic and validation
- Manage loading and error states

**Services**
- **APIService**: HTTP requests to backend API
- **AuthService**: Authentication, token management, Keychain storage
- **SyncService**: Background synchronization of offline operations
- **NotificationService**: Push notification registration and handling

**Core Data Stack**
- Entity definitions matching backend models
- Relationships between entities
- Fetch requests and predicates
- Background context for sync operations

## Components and Interfaces

### 1. Authentication System

**AuthService**
```swift
class AuthService: ObservableObject {
    @Published var isAuthenticated: Bool
    @Published var currentUser: User?
    @Published var userRole: UserRole?
    
    func login(email: String, password: String) async throws -> AuthResponse
    func logout()
    func refreshToken() async throws
    func storeCredentials(_ credentials: Credentials)
    func retrieveCredentials() -> Credentials?
    func clearCredentials()
}
```

**Design Decisions:**
- **Keychain Storage**: Credentials stored securely in iOS Keychain (not UserDefaults)
- **Token Refresh**: Automatic token refresh on 401 responses
- **ObservableObject**: Publishes authentication state changes to all views
- **Async/Await**: Modern Swift concurrency for network operations

### 2. Core Data Models

**Entity Definitions:**

```swift
// ActivityType
@objc(ActivityType)
class ActivityType: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var name: String
    @NSManaged var isPredefined: Bool
    @NSManaged var activities: Set<Activity>
}

// ParticipantRole
@objc(ParticipantRole)
class ParticipantRole: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var name: String
    @NSManaged var isPredefined: Bool
    @NSManaged var assignments: Set<ActivityParticipant>
}

// Participant
@objc(Participant)
class Participant: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var name: String
    @NSManaged var email: String
    @NSManaged var phone: String?
    @NSManaged var notes: String?
    @NSManaged var homeVenueId: UUID?
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var activityAssignments: Set<ActivityParticipant>
    @NSManaged var addressHistory: Set<ParticipantAddressHistory>
}

// ParticipantAddressHistory
@objc(ParticipantAddressHistory)
class ParticipantAddressHistory: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var participantId: UUID
    @NSManaged var venueId: UUID
    @NSManaged var effectiveFrom: Date
    @NSManaged var effectiveTo: Date?
    @NSManaged var participant: Participant
    @NSManaged var venue: Venue
}

// Venue
@objc(Venue)
class Venue: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var name: String
    @NSManaged var address: String
    @NSManaged var geographicAreaId: UUID
    @NSManaged var latitude: Double
    @NSManaged var longitude: Double
    @NSManaged var venueType: String? // "PUBLIC_BUILDING" or "PRIVATE_RESIDENCE"
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var geographicArea: GeographicArea
    @NSManaged var activityVenueHistory: Set<ActivityVenueHistory>
    @NSManaged var participantAddressHistory: Set<ParticipantAddressHistory>
}

// GeographicArea
@objc(GeographicArea)
class GeographicArea: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var name: String
    @NSManaged var areaType: String // NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD
    @NSManaged var parentGeographicAreaId: UUID?
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var parent: GeographicArea?
    @NSManaged var children: Set<GeographicArea>
    @NSManaged var venues: Set<Venue>
}

// Activity
@objc(Activity)
class Activity: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var name: String
    @NSManaged var activityDescription: String?
    @NSManaged var startDate: Date
    @NSManaged var endDate: Date?
    @NSManaged var status: String
    @NSManaged var createdAt: Date
    @NSManaged var updatedAt: Date
    @NSManaged var activityType: ActivityType
    @NSManaged var participants: Set<ActivityParticipant>
    @NSManaged var venueHistory: Set<ActivityVenueHistory>
}

// ActivityVenueHistory
@objc(ActivityVenueHistory)
class ActivityVenueHistory: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var activityId: UUID
    @NSManaged var venueId: UUID
    @NSManaged var effectiveFrom: Date
    @NSManaged var effectiveTo: Date?
    @NSManaged var activity: Activity
    @NSManaged var venue: Venue
}

// ActivityParticipant (Join Table)
@objc(ActivityParticipant)
class ActivityParticipant: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var activity: Activity
    @NSManaged var participant: Participant
    @NSManaged var role: ParticipantRole
    @NSManaged var assignedAt: Date
}

// PendingOperation (Sync Queue)
@objc(PendingOperation)
class PendingOperation: NSManagedObject {
    @NSManaged var id: UUID
    @NSManaged var operationType: String // "CREATE", "UPDATE", "DELETE"
    @NSManaged var entityType: String
    @NSManaged var entityId: UUID
    @NSManaged var payload: Data?
    @NSManaged var createdAt: Date
    @NSManaged var retryCount: Int
}
```

**Design Rationale:**
- **Relationships**: Core Data manages foreign key relationships automatically
- **Cascade Rules**: Deleting ActivityType/ParticipantRole prevents deletion if referenced
- **Sync Queue**: PendingOperation tracks offline changes for later synchronization
- **Timestamps**: Track creation and modification for conflict resolution

### 3. API Service

**APIService Interface**
```swift
class APIService {
    private let baseURL: URL
    private let session: URLSession
    private let authService: AuthService
    
    // Activity Types
    func fetchActivityTypes() async throws -> [ActivityTypeDTO]
    func createActivityType(_ dto: CreateActivityTypeDTO) async throws -> ActivityTypeDTO
    func updateActivityType(id: UUID, _ dto: UpdateActivityTypeDTO) async throws -> ActivityTypeDTO
    func deleteActivityType(id: UUID) async throws
    
    // Participant Roles
    func fetchParticipantRoles() async throws -> [ParticipantRoleDTO]
    func createParticipantRole(_ dto: CreateParticipantRoleDTO) async throws -> ParticipantRoleDTO
    func updateParticipantRole(id: UUID, _ dto: UpdateParticipantRoleDTO) async throws -> ParticipantRoleDTO
    func deleteParticipantRole(id: UUID) async throws
    
    // Participants
    func fetchParticipants() async throws -> [ParticipantDTO]
    func createParticipant(_ dto: CreateParticipantDTO) async throws -> ParticipantDTO
    func updateParticipant(id: UUID, _ dto: UpdateParticipantDTO) async throws -> ParticipantDTO
    func deleteParticipant(id: UUID) async throws
    
    // Activities
    func fetchActivities() async throws -> [ActivityDTO]
    func createActivity(_ dto: CreateActivityDTO) async throws -> ActivityDTO
    func updateActivity(id: UUID, _ dto: UpdateActivityDTO) async throws -> ActivityDTO
    func deleteActivity(id: UUID) async throws
    func markActivityComplete(id: UUID) async throws -> ActivityDTO
    
    // Activity Participants
    func assignParticipant(_ dto: AssignParticipantDTO) async throws -> ActivityParticipantDTO
    func unassignParticipant(activityId: UUID, participantId: UUID) async throws
    
    // Venues
    func fetchVenues() async throws -> [VenueDTO]
    func fetchVenue(id: UUID) async throws -> VenueDTO
    func searchVenues(query: String) async throws -> [VenueDTO]
    func createVenue(_ dto: CreateVenueDTO) async throws -> VenueDTO
    func updateVenue(id: UUID, _ dto: UpdateVenueDTO) async throws -> VenueDTO
    func deleteVenue(id: UUID) async throws
    func fetchVenueActivities(id: UUID) async throws -> [ActivityDTO]
    func fetchVenueParticipants(id: UUID) async throws -> [ParticipantDTO]
    
    // Geographic Areas
    func fetchGeographicAreas() async throws -> [GeographicAreaDTO]
    func fetchGeographicArea(id: UUID) async throws -> GeographicAreaDTO
    func createGeographicArea(_ dto: CreateGeographicAreaDTO) async throws -> GeographicAreaDTO
    func updateGeographicArea(id: UUID, _ dto: UpdateGeographicAreaDTO) async throws -> GeographicAreaDTO
    func deleteGeographicArea(id: UUID) async throws
    func fetchGeographicAreaChildren(id: UUID) async throws -> [GeographicAreaDTO]
    func fetchGeographicAreaAncestors(id: UUID) async throws -> [GeographicAreaDTO]
    func fetchGeographicAreaVenues(id: UUID) async throws -> [VenueDTO]
    func fetchGeographicAreaStatistics(id: UUID) async throws -> GeographicAreaStatisticsDTO
    
    // Participant Address History
    func fetchParticipantAddressHistory(participantId: UUID) async throws -> [ParticipantAddressHistoryDTO]
    
    // Analytics
    func fetchEngagementMetrics(startDate: Date?, endDate: Date?, geographicAreaId: UUID?) async throws -> EngagementMetricsDTO
    func fetchGrowthAnalytics(period: String, geographicAreaId: UUID?) async throws -> GrowthAnalyticsDTO
    func fetchGeographicBreakdown() async throws -> [GeographicEngagementDTO]
}
```

**Design Decisions:**
- **Async/Await**: Modern Swift concurrency for cleaner async code
- **DTO Pattern**: Data Transfer Objects separate API models from Core Data models
- **Automatic Auth**: Injects Bearer token from AuthService into all requests
- **Error Handling**: Throws typed errors for network, auth, and validation failures

### 4. Synchronization Service

**SyncService**
```swift
class SyncService {
    private let apiService: APIService
    private let coreDataStack: CoreDataStack
    private let networkMonitor: NWPathMonitor
    
    @Published var isOnline: Bool
    @Published var pendingOperationCount: Int
    @Published var isSyncing: Bool
    
    func startMonitoring()
    func stopMonitoring()
    func syncPendingOperations() async throws
    func queueOperation(_ operation: PendingOperation)
    private func retryWithBackoff(attempt: Int) async
}
```

**Synchronization Strategy:**
1. **Queue Operations**: When offline, create/update/delete operations are queued in Core Data
2. **Monitor Connectivity**: NWPathMonitor detects when network becomes available
3. **Automatic Sync**: When online, process queue in FIFO order
4. **Exponential Backoff**: Retry failed operations with increasing delays (1s, 2s, 4s, 8s, 16s)
5. **Conflict Resolution**: Last-write-wins strategy (server timestamp comparison)

**Design Rationale:**
- **Background Tasks**: Uses URLSession background configuration for sync during app suspension
- **Atomic Operations**: Each queued operation is independent and can be retried
- **User Feedback**: Displays pending operation count and sync status in UI

### 5. View Models

**Example: ActivityListViewModel**
```swift
class ActivityListViewModel: ObservableObject {
    @Published var activities: [Activity] = []
    @Published var filteredActivities: [Activity] = []
    @Published var isLoading: Bool = false
    @Published var error: Error?
    @Published var filterType: ActivityType?
    @Published var filterStatus: ActivityStatus?
    @Published var sortOrder: SortOrder = .startDateDescending
    
    private let apiService: APIService
    private let coreDataStack: CoreDataStack
    private let syncService: SyncService
    private var cancellables = Set<AnyCancellable>()
    
    func loadActivities() async
    func createActivity(_ dto: CreateActivityDTO) async throws
    func updateActivity(id: UUID, _ dto: UpdateActivityDTO) async throws
    func deleteActivity(_ activity: Activity) async throws
    func markComplete(_ activity: Activity) async throws
    func applyFilters()
    func applySorting()
}
```

**Design Rationale:**
- **Combine Publishers**: `@Published` properties automatically update SwiftUI views
- **Separation of Concerns**: ViewModel handles business logic, View handles presentation
- **Error Handling**: Errors published to view for display in alerts
- **Filtering/Sorting**: Client-side operations on cached data for instant feedback

## Data Models

### Data Transfer Objects (DTOs)

**ActivityTypeDTO**
```swift
struct ActivityTypeDTO: Codable {
    let id: UUID
    let name: String
    let isPredefined: Bool
}

struct CreateActivityTypeDTO: Codable {
    let name: String
}

struct UpdateActivityTypeDTO: Codable {
    let name: String
}
```

**ParticipantDTO**
```swift
struct ParticipantDTO: Codable {
    let id: UUID
    let name: String
    let email: String
    let phone: String?
    let notes: String?
    let createdAt: Date
    let updatedAt: Date
}

struct CreateParticipantDTO: Codable {
    let name: String
    let email: String
    let phone: String?
    let notes: String?
}
```

**ActivityDTO**
```swift
struct ActivityDTO: Codable {
    let id: UUID
    let name: String
    let description: String?
    let startDate: Date
    let endDate: Date?
    let status: ActivityStatus
    let activityTypeId: UUID
    let venues: [ActivityVenueHistoryDTO]?
    let createdAt: Date
    let updatedAt: Date
}

struct CreateActivityDTO: Codable {
    let name: String
    let description: String?
    let startDate: Date
    let endDate: Date?
    let activityTypeId: UUID
    let venueIds: [UUID]?
}
```

**VenueDTO**
```swift
struct VenueDTO: Codable {
    let id: UUID
    let name: String
    let address: String
    let geographicAreaId: UUID
    let latitude: Double?
    let longitude: Double?
    let venueType: String?
    let geographicArea: GeographicAreaDTO?
    let createdAt: Date
    let updatedAt: Date
}

struct CreateVenueDTO: Codable {
    let name: String
    let address: String
    let geographicAreaId: UUID
    let latitude: Double?
    let longitude: Double?
    let venueType: String?
}

struct UpdateVenueDTO: Codable {
    let name: String?
    let address: String?
    let geographicAreaId: UUID?
    let latitude: Double?
    let longitude: Double?
    let venueType: String?
}
```

**GeographicAreaDTO**
```swift
struct GeographicAreaDTO: Codable {
    let id: UUID
    let name: String
    let areaType: String
    let parentGeographicAreaId: UUID?
    let parent: GeographicAreaDTO?
    let children: [GeographicAreaDTO]?
    let createdAt: Date
    let updatedAt: Date
}

struct CreateGeographicAreaDTO: Codable {
    let name: String
    let areaType: String
    let parentGeographicAreaId: UUID?
}

struct UpdateGeographicAreaDTO: Codable {
    let name: String?
    let areaType: String?
    let parentGeographicAreaId: UUID?
}

struct GeographicAreaStatisticsDTO: Codable {
    let geographicAreaId: UUID
    let totalActivities: Int
    let totalParticipants: Int
    let activeActivities: Int
    let ongoingActivities: Int
}
```

**Temporal Tracking DTOs**
```swift
struct ParticipantAddressHistoryDTO: Codable {
    let id: UUID
    let participantId: UUID
    let venueId: UUID
    let venue: VenueDTO?
    let effectiveFrom: Date
    let effectiveTo: Date?
}

struct ActivityVenueHistoryDTO: Codable {
    let id: UUID
    let activityId: UUID
    let venueId: UUID
    let venue: VenueDTO?
    let effectiveFrom: Date
    let effectiveTo: Date?
}
```

**AnalyticsDTO**
```swift
struct EngagementMetricsDTO: Codable {
    let totalParticipants: Int
    let totalActivities: Int
    let activeActivities: Int
    let ongoingActivities: Int
    let participantsByRole: [String: Int]
    let activitiesByType: [String: Int]
    let geographicBreakdown: [GeographicEngagementDTO]?
}

struct GeographicEngagementDTO: Codable {
    let geographicAreaId: UUID
    let geographicAreaName: String
    let activityCount: Int
    let participantCount: Int
}

struct GrowthAnalyticsDTO: Codable {
    let period: String
    let dataPoints: [GrowthDataPoint]
}

struct GrowthDataPoint: Codable {
    let date: Date
    let participantCount: Int
    let activityCount: Int
    let participantChange: Double
    let activityChange: Double
}
```

### Validation Rules

**Participant Validation**
- Name: Required, 1-100 characters
- Email: Required, valid email format (regex: `^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$`)
- Phone: Optional, if provided must match phone format
- Notes: Optional, max 500 characters

**Activity Validation**
- Name: Required, 1-200 characters
- Description: Optional, max 1000 characters
- Start Date: Required, cannot be in the past (for new activities)
- End Date: Optional for ongoing activities, must be after start date if provided
- Activity Type: Required, must reference existing ActivityType

**ActivityType/ParticipantRole Validation**
- Name: Required, 1-50 characters, unique within type
- Cannot delete if referenced by activities/assignments

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties. Here's the reflection to eliminate redundancy:

**Redundancies Identified:**
- Properties 2.2 and 3.2 (isPredefined tracking) can be combined into one property about entity metadata
- Properties 2.1, 3.1, 4.1, 5.1 (list display) can be combined into one property about complete data retrieval
- Properties 4.3 and 5.2 (filtering) can be combined into one property about filter correctness
- Properties 4.3 and 5.3 (sorting) can be combined into one property about sort order
- Property 6.5 is duplicate of 6.2 (role validation)
- Properties 7.2 and 7.3 (count accuracy) can be combined into one property about metric calculations
- Properties 9.3, 9.4, 9.5 (role-based features) can be combined into one property about authorization

**Properties to Keep:**
After reflection, the unique, non-redundant properties are:
1. Complete data retrieval (covers 2.1, 3.1, 4.1, 5.1)
2. Reference constraint enforcement (covers 2.6, 3.6)
3. Search functionality (4.2)
4. Filtering correctness (covers 4.3, 5.2)
5. Sorting correctness (covers 4.3, 5.3)
6. Input validation (covers 4.7, 4.8, 5.8, 6.2, 8.2, 14.1)
7. Activity type classification (5.4)
8. Duplicate prevention (6.6)
9. Metric calculation accuracy (covers 7.2, 7.3, 7.9, 7.10)
10. Keychain round-trip (8.5)
11. Role-based authorization (covers 9.3, 9.4, 9.5)
12. Offline data availability (10.2, 10.3)
13. Operation queuing (10.4)
14. Feature availability based on connectivity (10.7)
15. Connectivity detection (11.1)
16. Sync queue processing (11.2, 11.4)
17. Exponential backoff (11.5)
18. Queue count accuracy (11.7)
19. Notification handling (12.3)
20. Navigation state preservation (13.3)
21. State preservation during errors (14.5, 15.5)
22. Accessibility labels (17.3)

### Correctness Properties

Property 1: Complete Data Retrieval
*For any* set of entities (ActivityTypes, ParticipantRoles, Participants, or Activities) stored in Core Data, fetching and displaying the list should return all entities without omission.
**Validates: Requirements 2.1, 3.1, 4.1, 5.1**

Property 2: Reference Constraint Enforcement
*For any* ActivityType or ParticipantRole that is referenced by existing Activities or ActivityParticipants, attempting to delete it should fail and preserve the entity.
**Validates: Requirements 2.6, 3.6**

Property 3: Search Result Accuracy
*For any* search query string and set of Participants, the search results should include all and only those Participants whose name or email contains the query string (case-insensitive).
**Validates: Requirements 4.2**

Property 4: Filter Correctness
*For any* filter criteria (type, status, role, etc.) and set of entities, the filtered results should include all and only those entities that match the criteria.
**Validates: Requirements 4.3, 5.2**

Property 5: Sort Order Preservation
*For any* sort criteria (date, name, etc.) and sort direction (ascending/descending), the sorted list should maintain the correct ordering according to the criteria.
**Validates: Requirements 4.3, 5.3**

Property 6: Input Validation Rejection
*For any* invalid input (missing required fields, invalid email format, missing end date for finite activities, missing role for assignments, missing credentials), the validation should reject the input and prevent submission.
**Validates: Requirements 4.7, 4.8, 5.8, 6.2, 8.2, 14.1**

Property 7: Activity Classification
*For any* Activity, it should be classified as finite if endDate is non-null and ongoing if endDate is null.
**Validates: Requirements 5.4**

Property 8: Duplicate Assignment Prevention
*For any* Activity and Participant combination, attempting to create a second ActivityParticipant assignment with the same role should be rejected.
**Validates: Requirements 6.6**

Property 9: Metric Calculation Accuracy
*For any* set of Participants and Activities with date ranges, the calculated metrics (total counts, active counts, percentage changes, cumulative counts) should match the actual data when computed independently.
**Validates: Requirements 7.2, 7.3, 7.9, 7.10**

Property 10: Keychain Storage Round-Trip
*For any* valid Credentials object, storing it in Keychain and then retrieving it should produce an equivalent Credentials object.
**Validates: Requirements 8.5**

Property 11: Role-Based Feature Authorization
*For any* user with a specific role (ADMINISTRATOR, EDITOR, READ_ONLY), the available features should match the permissions defined for that role (all features for ADMINISTRATOR, create/update/delete for EDITOR, read-only for READ_ONLY).
**Validates: Requirements 9.3, 9.4, 9.5**

Property 12: Offline Data Availability
*For any* data that has been cached during initial load, querying that data while offline should return the cached values without requiring network connectivity.
**Validates: Requirements 10.2, 10.3**

Property 13: Offline Operation Queuing
*For any* create, update, or delete operation performed while offline, a corresponding PendingOperation should be added to the sync queue.
**Validates: Requirements 10.4**

Property 14: Connectivity-Based Feature Availability
*For any* feature that requires network connectivity, when the device is offline, that feature should be disabled or unavailable.
**Validates: Requirements 10.7**

Property 15: Connectivity State Detection
*For any* change in network connectivity (online to offline or offline to online), the app should detect and update its connectivity state accordingly.
**Validates: Requirements 11.1**

Property 16: Sync Queue Processing
*For any* set of PendingOperations in the queue, when connectivity is restored and synchronization succeeds, all operations should be processed and the queue should be cleared.
**Validates: Requirements 11.2, 11.4**

Property 17: Exponential Backoff Retry
*For any* failed synchronization attempt, the retry delay should follow an exponential backoff pattern (1s, 2s, 4s, 8s, 16s, etc.) based on the retry count.
**Validates: Requirements 11.5**

Property 18: Queue Count Accuracy
*For any* state of the PendingOperation queue, the displayed pending operation count should equal the actual number of operations in the queue.
**Validates: Requirements 11.7**

Property 19: Notification Processing
*For any* valid push notification received, the app should process it and extract the notification content correctly.
**Validates: Requirements 12.3**

Property 20: Navigation State Preservation
*For any* tab in the tab bar navigation, switching away from the tab and back should preserve the navigation state (current view, scroll position, etc.) within that tab.
**Validates: Requirements 13.3**

Property 21: Error State Preservation
*For any* error that occurs during an operation, the application state (data, UI state, navigation) should remain consistent and not be corrupted by the error.
**Validates: Requirements 14.5, 15.5**

Property 22: Accessibility Label Completeness
*For any* interactive UI element (buttons, text fields, toggles, etc.), it should have a non-empty accessibility label for VoiceOver support.
**Validates: Requirements 17.3**

Property 23: Venue List Display
*For any* set of Venues stored in Core Data, fetching and displaying the list should return all venues with name, address, and geographic area.
**Validates: Requirements 6A.1**

Property 24: Venue Search Accuracy
*For any* search query string and set of Venues, the search results should include all and only those Venues whose name or address contains the query string (case-insensitive).
**Validates: Requirements 6A.2**

Property 25: Venue Required Field Validation
*For any* venue creation or update with missing required fields (name, address, or geographic area), the validation should reject the input and prevent submission.
**Validates: Requirements 6A.7**

Property 26: Venue Optional Field Acceptance
*For any* venue creation with or without optional latitude, longitude, and venue type fields, the submission should succeed if all required fields are valid.
**Validates: Requirements 6A.8**

Property 27: Venue Deletion Prevention
*For any* Venue referenced by Activities or Participants, attempting to delete it should fail and display an alert explaining which entities reference it.
**Validates: Requirements 6A.10, 6A.11**

Property 28: Venue Detail View Completeness
*For any* Venue, the detail view should display the venue information, associated activities, and participants using it as home address.
**Validates: Requirements 6A.9**

Property 29: Geographic Area Hierarchical Display
*For any* set of GeographicAreas, the list view should display them in a hierarchical structure showing parent-child relationships.
**Validates: Requirements 6B.1**

Property 30: Geographic Area Required Field Validation
*For any* geographic area creation with missing required fields (name or area type), the validation should reject the input and prevent submission.
**Validates: Requirements 6B.5**

Property 31: Circular Relationship Prevention
*For any* GeographicArea, attempting to set its parent to itself or to one of its descendants should be rejected with a validation error.
**Validates: Requirements 6B.7**

Property 32: Geographic Area Deletion Prevention
*For any* GeographicArea referenced by Venues or child GeographicAreas, attempting to delete it should fail and display an alert explaining which entities reference it.
**Validates: Requirements 6B.9, 6B.10**

Property 33: Map Annotation Display
*For any* Venue with non-null latitude and longitude, an annotation should be displayed on the map at the correct coordinates.
**Validates: Requirements 6C.2**

Property 34: Map Annotation Activity Information
*For any* venue annotation tapped on the map, the annotation callout should display activity information for that venue.
**Validates: Requirements 6C.3**

Property 35: Map Annotation Visual Distinction
*For any* set of venues on the map, annotations should use different colors or symbols based on activity type or status to visually distinguish them.
**Validates: Requirements 6C.4**

Property 36: Map Filter Application
*For any* filter criteria (activity type, status, or date range) applied to the map, only venues with activities matching the criteria should display annotations.
**Validates: Requirements 6C.5**

Property 37: Participant Address History Display
*For any* Participant with address history, the detail view should display all historical home addresses ordered by effectiveFrom date descending.
**Validates: Requirements 4.12**

Property 38: Activity Venue History Display
*For any* Activity with venue associations, the detail view should display all current and historical venue associations with their effective date ranges.
**Validates: Requirements 5.13**

Property 39: Geographic Area Filter Application
*For any* analytics view with a geographic area filter applied, only activities and participants associated with venues in that geographic area or its descendants should be included in the metrics.
**Validates: Requirements 7.11**

Property 40: Geographic Breakdown Chart Display
*For any* engagement metrics, the geographic breakdown chart should correctly display engagement data grouped by geographic area.
**Validates: Requirements 7.12**

## Error Handling

### Error Types

**Network Errors**
- No connectivity: Display offline indicator, queue operations
- Timeout: Retry with exponential backoff
- Server errors (5xx): Retry with backoff, display user-friendly message
- Client errors (4xx): Display specific error message, don't retry

**Validation Errors**
- Missing required fields: Highlight field, display inline error
- Invalid format: Display format requirements, provide examples
- Constraint violations: Explain constraint, suggest resolution

**Authentication Errors**
- Invalid credentials: Display error, allow retry
- Token expired: Automatically refresh token, retry request
- Refresh failed: Navigate to login, clear stored credentials

**Data Errors**
- Core Data save failure: Rollback transaction, display error
- Sync conflict: Notify user, provide conflict resolution options
- Constraint violation: Prevent operation, explain constraint

### Error Recovery Strategies

**Automatic Recovery**
- Token refresh on 401 responses
- Retry with exponential backoff for transient failures
- Fallback to cached data when offline

**User-Initiated Recovery**
- Retry button for failed operations
- Manual sync trigger
- Conflict resolution UI for sync conflicts

**Graceful Degradation**
- Offline mode with queued operations
- Read-only mode when write operations fail
- Cached data display when sync fails

## Testing Strategy

### Dual Testing Approach

The iOS Mobile App will use both **unit tests** and **property-based tests** to ensure comprehensive coverage:

**Unit Tests** verify:
- Specific examples of correct behavior
- Edge cases (empty lists, nil values, boundary conditions)
- Error conditions (network failures, validation errors)
- Integration between components (ViewModel ↔ Service ↔ Core Data)

**Property-Based Tests** verify:
- Universal properties that hold across all inputs
- Correctness properties defined in this document
- Data integrity constraints
- Business logic invariants

Both testing approaches are complementary and necessary for comprehensive coverage.

### Property-Based Testing Configuration

**Framework**: Use [SwiftCheck](https://github.com/typelift/SwiftCheck) for property-based testing in Swift

**Configuration**:
- Minimum 100 iterations per property test
- Each test tagged with comment referencing design property
- Tag format: `// Feature: ios-mobile-app, Property {number}: {property_text}`

**Example Property Test Structure**:
```swift
func testProperty1_CompleteDataRetrieval() {
    // Feature: ios-mobile-app, Property 1: Complete Data Retrieval
    property("All stored entities are retrieved") <- forAll { (entities: [ActivityType]) in
        // Setup: Store entities in Core Data
        // Action: Fetch entities
        // Assert: Retrieved count equals stored count
        return retrievedEntities.count == entities.count
    }
}
```

### Unit Testing Strategy

**Test Organization**:
- ViewModelTests: Test ViewModel logic, state management, error handling
- ServiceTests: Test API calls, authentication, synchronization
- ValidationTests: Test input validation rules
- CoreDataTests: Test entity relationships, constraints, queries

**Key Test Scenarios**:
- Creating entities with valid and invalid data
- Deleting entities with and without references
- Filtering and sorting with various criteria
- Offline operation queuing and synchronization
- Authentication flow and token refresh
- Role-based feature availability

**Mocking Strategy**:
- Mock APIService for ViewModel tests
- Mock URLSession for Service tests
- Use in-memory Core Data stack for data tests
- Mock NetworkMonitor for connectivity tests

### Integration Testing

**End-to-End Scenarios**:
- Complete user flows (login → create activity → assign participant)
- Offline-to-online synchronization
- Error recovery flows
- Navigation state preservation

**UI Testing**:
- Critical user paths using XCUITest
- Accessibility testing with VoiceOver
- Dark mode and Dynamic Type support
- iPad and iPhone layouts

### Test Coverage Goals

- Unit test coverage: 80%+ for business logic
- Property test coverage: All 22 correctness properties
- Integration test coverage: All critical user flows
- UI test coverage: Primary navigation paths

## Implementation Notes

### Technology Stack

- **Language**: Swift 5.9+
- **UI Framework**: SwiftUI
- **Persistence**: Core Data
- **Networking**: URLSession with async/await
- **Reactive**: Combine framework
- **Security**: Keychain Services
- **Charts**: Swift Charts (iOS 16+)
- **Testing**: XCTest, SwiftCheck

### Development Considerations

**SwiftUI Best Practices**:
- Use `@StateObject` for ViewModel ownership
- Use `@ObservedObject` for passed ViewModels
- Use `@Published` for reactive state updates
- Prefer `@Environment` for dependency injection

**Core Data Best Practices**:
- Use background contexts for sync operations
- Merge changes to main context on main thread
- Use batch operations for bulk updates
- Implement proper cascade delete rules

**Networking Best Practices**:
- Use async/await for cleaner async code
- Implement request retry logic
- Handle token refresh transparently
- Use background URLSession for sync

**Security Best Practices**:
- Store tokens in Keychain, never UserDefaults
- Use HTTPS for all API calls
- Validate SSL certificates
- Clear sensitive data on logout

### Performance Considerations

**Core Data Optimization**:
- Use batch fetch limits for large lists
- Implement pagination for API requests
- Use NSFetchedResultsController for table views
- Index frequently queried attributes

**UI Performance**:
- Use lazy loading for lists
- Implement image caching
- Debounce search input
- Use skeleton views for loading states

**Network Optimization**:
- Batch API requests when possible
- Implement request deduplication
- Use ETags for cache validation
- Compress request/response payloads

### Deployment Considerations

**App Store Requirements**:
- Privacy manifest for data collection
- App Transport Security configuration
- Background modes for sync
- Push notification entitlements

**Version Compatibility**:
- Minimum iOS 16.0 deployment target
- Support iPhone and iPad idioms
- Handle iOS version differences gracefully
- Test on multiple device sizes

**Monitoring and Analytics**:
- Crash reporting integration
- Performance monitoring
- User analytics (with privacy compliance)
- Network request logging (development only)
