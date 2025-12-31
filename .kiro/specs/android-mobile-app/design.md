# Design Document: Android Mobile App Package

## Overview

The Android Mobile App is a native Android application that enables community organizers to manage activities, participants, and view analytics from Android devices. The application follows an offline-first architecture using Room database for local persistence, with background synchronization when connectivity is available. The app implements Material Design 3 guidelines and supports Android 8.0 (API level 26) and later.

### Key Design Decisions

1. **Offline-First Architecture**: Room database serves as the single source of truth, enabling full functionality without network connectivity. This decision prioritizes user experience in areas with unreliable connectivity.

2. **MVVM Architecture**: The app uses Model-View-ViewModel pattern with Android Architecture Components (ViewModel, LiveData/Flow) to separate concerns and enable testability.

3. **Material Design 3**: Adopting Google's latest design system ensures consistency with Android platform conventions and provides modern UI components out of the box.

4. **Dependency Injection with Hilt**: Dagger/Hilt provides compile-time dependency injection, improving testability and reducing boilerplate compared to manual dependency management.

5. **WorkManager for Background Sync**: WorkManager handles background synchronization with guaranteed execution and battery optimization, superior to custom background services.

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Presentation Layer                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Activities  │  │  Fragments   │  │  ViewModels  │     │
│  │  & Dialogs   │  │  & Adapters  │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                        Domain Layer                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Use Cases   │  │   Domain     │  │  Validators  │     │
│  │              │  │   Models     │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                         Data Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Repositories │  │ Room Database│  │ Retrofit API │     │
│  │              │  │   (Local)    │  │   (Remote)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │ WorkManager  │  │  Encrypted   │                        │
│  │ (Sync Queue) │  │ Preferences  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

### Layer Responsibilities

**Presentation Layer**:
- Activities host fragments and manage navigation
- Fragments display UI and handle user interactions
- ViewModels manage UI state and business logic
- Adapters bind data to RecyclerViews

**Domain Layer**:
- Use cases encapsulate business logic
- Domain models represent core entities
- Validators ensure data integrity

**Data Layer**:
- Repositories abstract data sources (local and remote)
- Room database provides local persistence
- Retrofit handles API communication
- WorkManager queues offline operations
- EncryptedSharedPreferences stores credentials

## Components and Interfaces

### 1. Data Models

#### Room Entities

```kotlin
@Entity(tableName = "activity_types")
data class ActivityTypeEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String?,
    val isPredefined: Boolean,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(tableName = "participant_roles")
data class ParticipantRoleEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String?,
    val isPredefined: Boolean,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(tableName = "participants")
data class ParticipantEntity(
    @PrimaryKey val id: String,
    val name: String,
    val email: String,
    val phone: String?,
    val notes: String?,
    val homeVenueId: String?,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "participant_address_history",
    foreignKeys = [
        ForeignKey(
            entity = ParticipantEntity::class,
            parentColumns = ["id"],
            childColumns = ["participantId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = VenueEntity::class,
            parentColumns = ["id"],
            childColumns = ["venueId"],
            onDelete = ForeignKey.RESTRICT
        )
    ]
)
data class ParticipantAddressHistoryEntity(
    @PrimaryKey val id: String,
    val participantId: String,
    val venueId: String,
    val effectiveFrom: Long,
    val effectiveTo: Long?,
    val createdAt: Long
)

@Entity(
    tableName = "venues",
    foreignKeys = [
        ForeignKey(
            entity = GeographicAreaEntity::class,
            parentColumns = ["id"],
            childColumns = ["geographicAreaId"],
            onDelete = ForeignKey.RESTRICT
        )
    ]
)
data class VenueEntity(
    @PrimaryKey val id: String,
    val name: String,
    val address: String,
    val geographicAreaId: String,
    val latitude: Double?,
    val longitude: Double?,
    val venueType: String?, // PUBLIC_BUILDING or PRIVATE_RESIDENCE
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "geographic_areas",
    foreignKeys = [
        ForeignKey(
            entity = GeographicAreaEntity::class,
            parentColumns = ["id"],
            childColumns = ["parentGeographicAreaId"],
            onDelete = ForeignKey.RESTRICT
        )
    ]
)
data class GeographicAreaEntity(
    @PrimaryKey val id: String,
    val name: String,
    val areaType: String, // NEIGHBOURHOOD, COMMUNITY, CITY, etc.
    val parentGeographicAreaId: String?,
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(tableName = "activities")
data class ActivityEntity(
    @PrimaryKey val id: String,
    val name: String,
    val description: String?,
    val activityTypeId: String,
    val startDate: Long,
    val endDate: Long?,
    val status: String, // PLANNED, ACTIVE, COMPLETED
    val createdAt: Long,
    val updatedAt: Long
)

@Entity(
    tableName = "activity_venue_history",
    foreignKeys = [
        ForeignKey(
            entity = ActivityEntity::class,
            parentColumns = ["id"],
            childColumns = ["activityId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = VenueEntity::class,
            parentColumns = ["id"],
            childColumns = ["venueId"],
            onDelete = ForeignKey.RESTRICT
        )
    ]
)
data class ActivityVenueHistoryEntity(
    @PrimaryKey val id: String,
    val activityId: String,
    val venueId: String,
    val effectiveFrom: Long,
    val effectiveTo: Long?,
    val createdAt: Long
)

@Entity(
    tableName = "activity_participant_assignments",
    foreignKeys = [
        ForeignKey(
            entity = ActivityEntity::class,
            parentColumns = ["id"],
            childColumns = ["activityId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ParticipantEntity::class,
            parentColumns = ["id"],
            childColumns = ["participantId"],
            onDelete = ForeignKey.CASCADE
        ),
        ForeignKey(
            entity = ParticipantRoleEntity::class,
            parentColumns = ["id"],
            childColumns = ["roleId"],
            onDelete = ForeignKey.RESTRICT
        )
    ],
    indices = [
        Index(value = ["activityId", "participantId"], unique = true)
    ]
)
data class ActivityParticipantAssignmentEntity(
    @PrimaryKey val id: String,
    val activityId: String,
    val participantId: String,
    val roleId: String,
    val createdAt: Long
)

@Entity(tableName = "sync_queue")
data class SyncQueueEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val operation: String, // CREATE, UPDATE, DELETE
    val entityType: String, // ACTIVITY, PARTICIPANT, etc.
    val entityId: String,
    val payload: String, // JSON representation
    val createdAt: Long,
    val retryCount: Int = 0
)
```

#### Domain Models

```kotlin
data class ActivityType(
    val id: String,
    val name: String,
    val description: String?,
    val isPredefined: Boolean
)

data class ParticipantRole(
    val id: String,
    val name: String,
    val description: String?,
    val isPredefined: Boolean
)

data class Participant(
    val id: String,
    val name: String,
    val email: String,
    val phone: String?,
    val notes: String?,
    val homeVenueId: String?
)

data class ParticipantAddressHistory(
    val id: String,
    val participantId: String,
    val venueId: String,
    val venue: Venue?,
    val effectiveFrom: LocalDateTime,
    val effectiveTo: LocalDateTime?
)

data class Venue(
    val id: String,
    val name: String,
    val address: String,
    val geographicAreaId: String,
    val geographicArea: GeographicArea?,
    val latitude: Double?,
    val longitude: Double?,
    val venueType: VenueType?
)

enum class VenueType {
    PUBLIC_BUILDING, PRIVATE_RESIDENCE
}

data class GeographicArea(
    val id: String,
    val name: String,
    val areaType: GeographicAreaType,
    val parentGeographicAreaId: String?,
    val parent: GeographicArea?,
    val children: List<GeographicArea>?
)

enum class GeographicAreaType {
    NEIGHBOURHOOD, COMMUNITY, CITY, CLUSTER, COUNTY, PROVINCE, STATE, COUNTRY, CONTINENT, HEMISPHERE, WORLD
}

data class GeographicAreaStatistics(
    val geographicAreaId: String,
    val totalActivities: Int,
    val totalParticipants: Int,
    val activeActivities: Int,
    val ongoingActivities: Int
)

data class Activity(
    val id: String,
    val name: String,
    val description: String?,
    val activityType: ActivityType,
    val startDate: LocalDate,
    val endDate: LocalDate?,
    val status: ActivityStatus,
    val venues: List<ActivityVenueHistory>?
)

data class ActivityVenueHistory(
    val id: String,
    val activityId: String,
    val venueId: String,
    val venue: Venue?,
    val effectiveFrom: LocalDateTime,
    val effectiveTo: LocalDateTime?
)

enum class ActivityStatus {
    PLANNED, ACTIVE, COMPLETED
}

data class ActivityParticipantAssignment(
    val id: String,
    val activity: Activity,
    val participant: Participant,
    val role: ParticipantRole
)

data class User(
    val id: String,
    val email: String,
    val name: String,
    val role: UserRole
)

enum class UserRole {
    ADMINISTRATOR, EDITOR, READ_ONLY
}
```

### 2. Room Database

```kotlin
@Database(
    entities = [
        ActivityTypeEntity::class,
        ParticipantRoleEntity::class,
        ParticipantEntity::class,
        ActivityEntity::class,
        ActivityParticipantAssignmentEntity::class,
        VenueEntity::class,
        GeographicAreaEntity::class,
        ParticipantAddressHistoryEntity::class,
        ActivityVenueHistoryEntity::class,
        SyncQueueEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class CommunityDatabase : RoomDatabase() {
    abstract fun activityTypeDao(): ActivityTypeDao
    abstract fun participantRoleDao(): ParticipantRoleDao
    abstract fun participantDao(): ParticipantDao
    abstract fun activityDao(): ActivityDao
    abstract fun venueDao(): VenueDao
    abstract fun geographicAreaDao(): GeographicAreaDao
    abstract fun participantAddressHistoryDao(): ParticipantAddressHistoryDao
    abstract fun activityVenueHistoryDao(): ActivityVenueHistoryDao
    abstract fun assignmentDao(): ActivityParticipantAssignmentDao
    abstract fun syncQueueDao(): SyncQueueDao
}
```

### 3. Data Access Objects (DAOs)

```kotlin
@Dao
interface ActivityTypeDao {
    @Query("SELECT * FROM activity_types ORDER BY name ASC")
    fun getAllFlow(): Flow<List<ActivityTypeEntity>>
    
    @Query("SELECT * FROM activity_types WHERE id = :id")
    suspend fun getById(id: String): ActivityTypeEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(activityType: ActivityTypeEntity)
    
    @Update
    suspend fun update(activityType: ActivityTypeEntity)
    
    @Delete
    suspend fun delete(activityType: ActivityTypeEntity)
    
    @Query("SELECT COUNT(*) FROM activities WHERE activityTypeId = :typeId")
    suspend fun countActivitiesUsingType(typeId: String): Int
}

@Dao
interface ParticipantRoleDao {
    @Query("SELECT * FROM participant_roles ORDER BY name ASC")
    fun getAllFlow(): Flow<List<ParticipantRoleEntity>>
    
    @Query("SELECT * FROM participant_roles WHERE id = :id")
    suspend fun getById(id: String): ParticipantRoleEntity?
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(role: ParticipantRoleEntity)
    
    @Update
    suspend fun update(role: ParticipantRoleEntity)
    
    @Delete
    suspend fun delete(role: ParticipantRoleEntity)
    
    @Query("SELECT COUNT(*) FROM activity_participant_assignments WHERE roleId = :roleId")
    suspend fun countAssignmentsUsingRole(roleId: String): Int
}

@Dao
interface ParticipantDao {
    @Query("SELECT * FROM participants ORDER BY name ASC")
    fun getAllFlow(): Flow<List<ParticipantEntity>>
    
    @Query("SELECT * FROM participants WHERE id = :id")
    suspend fun getById(id: String): ParticipantEntity?
    
    @Query("SELECT * FROM participants WHERE name LIKE '%' || :query || '%' OR email LIKE '%' || :query || '%'")
    fun searchFlow(query: String): Flow<List<ParticipantEntity>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(participant: ParticipantEntity)
    
    @Update
    suspend fun update(participant: ParticipantEntity)
    
    @Delete
    suspend fun delete(participant: ParticipantEntity)
}

@Dao
interface ActivityDao {
    @Query("SELECT * FROM activities ORDER BY startDate DESC")
    fun getAllFlow(): Flow<List<ActivityEntity>>
    
    @Query("SELECT * FROM activities WHERE id = :id")
    suspend fun getById(id: String): ActivityEntity?
    
    @Query("SELECT * FROM activities WHERE activityTypeId = :typeId")
    fun getByTypeFlow(typeId: String): Flow<List<ActivityEntity>>
    
    @Query("SELECT * FROM activities WHERE status = :status")
    fun getByStatusFlow(status: String): Flow<List<ActivityEntity>>
    
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(activity: ActivityEntity)
    
    @Update
    suspend fun update(activity: ActivityEntity)
    
    @Delete
    suspend fun delete(activity: ActivityEntity)
}

@Dao
interface ActivityParticipantAssignmentDao {
    @Query("SELECT * FROM activity_participant_assignments WHERE activityId = :activityId")
    fun getByActivityFlow(activityId: String): Flow<List<ActivityParticipantAssignmentEntity>>
    
    @Query("SELECT * FROM activity_participant_assignments WHERE participantId = :participantId")
    fun getByParticipantFlow(participantId: String): Flow<List<ActivityParticipantAssignmentEntity>>
    
    @Insert(onConflict = OnConflictStrategy.ABORT)
    suspend fun insert(assignment: ActivityParticipantAssignmentEntity)
    
    @Delete
    suspend fun delete(assignment: ActivityParticipantAssignmentEntity)
}

@Dao
interface SyncQueueDao {
    @Query("SELECT * FROM sync_queue ORDER BY createdAt ASC")
    suspend fun getAll(): List<SyncQueueEntity>
    
    @Query("SELECT COUNT(*) FROM sync_queue")
    fun getPendingCountFlow(): Flow<Int>
    
    @Insert
    suspend fun insert(item: SyncQueueEntity)
    
    @Delete
    suspend fun delete(item: SyncQueueEntity)
    
    @Query("DELETE FROM sync_queue")
    suspend fun deleteAll()
}
```

### 4. Repositories

```kotlin
interface ActivityTypeRepository {
    fun getAllFlow(): Flow<List<ActivityType>>
    suspend fun getById(id: String): ActivityType?
    suspend fun create(activityType: ActivityType): Result<ActivityType>
    suspend fun update(activityType: ActivityType): Result<ActivityType>
    suspend fun delete(id: String): Result<Unit>
}

class ActivityTypeRepositoryImpl @Inject constructor(
    private val activityTypeDao: ActivityTypeDao,
    private val apiService: CommunityApiService,
    private val syncQueueDao: SyncQueueDao,
    private val connectivityManager: ConnectivityManager
) : ActivityTypeRepository {
    
    override fun getAllFlow(): Flow<List<ActivityType>> {
        return activityTypeDao.getAllFlow().map { entities ->
            entities.map { it.toDomainModel() }
        }
    }
    
    override suspend fun getById(id: String): ActivityType? {
        return activityTypeDao.getById(id)?.toDomainModel()
    }
    
    override suspend fun create(activityType: ActivityType): Result<ActivityType> {
        val entity = activityType.toEntity()
        
        return if (connectivityManager.isConnected()) {
            try {
                val response = apiService.createActivityType(entity.toDto())
                activityTypeDao.insert(response.toEntity())
                Result.success(response.toDomainModel())
            } catch (e: Exception) {
                queueOperation("CREATE", "ACTIVITY_TYPE", entity)
                activityTypeDao.insert(entity)
                Result.success(activityType)
            }
        } else {
            queueOperation("CREATE", "ACTIVITY_TYPE", entity)
            activityTypeDao.insert(entity)
            Result.success(activityType)
        }
    }
    
    override suspend fun update(activityType: ActivityType): Result<ActivityType> {
        val entity = activityType.toEntity()
        
        return if (connectivityManager.isConnected()) {
            try {
                val response = apiService.updateActivityType(entity.id, entity.toDto())
                activityTypeDao.update(response.toEntity())
                Result.success(response.toDomainModel())
            } catch (e: Exception) {
                queueOperation("UPDATE", "ACTIVITY_TYPE", entity)
                activityTypeDao.update(entity)
                Result.success(activityType)
            }
        } else {
            queueOperation("UPDATE", "ACTIVITY_TYPE", entity)
            activityTypeDao.update(entity)
            Result.success(activityType)
        }
    }
    
    override suspend fun delete(id: String): Result<Unit> {
        val count = activityTypeDao.countActivitiesUsingType(id)
        if (count > 0) {
            return Result.failure(Exception("Cannot delete activity type with $count activities"))
        }
        
        val entity = activityTypeDao.getById(id) ?: return Result.failure(Exception("Not found"))
        
        return if (connectivityManager.isConnected()) {
            try {
                apiService.deleteActivityType(id)
                activityTypeDao.delete(entity)
                Result.success(Unit)
            } catch (e: Exception) {
                queueOperation("DELETE", "ACTIVITY_TYPE", entity)
                activityTypeDao.delete(entity)
                Result.success(Unit)
            }
        } else {
            queueOperation("DELETE", "ACTIVITY_TYPE", entity)
            activityTypeDao.delete(entity)
            Result.success(Unit)
        }
    }
    
    private suspend fun queueOperation(operation: String, entityType: String, entity: Any) {
        val payload = Json.encodeToString(entity)
        syncQueueDao.insert(
            SyncQueueEntity(
                operation = operation,
                entityType = entityType,
                entityId = (entity as? ActivityTypeEntity)?.id ?: "",
                payload = payload,
                createdAt = System.currentTimeMillis()
            )
        )
    }
}
```

### 5. API Service (Retrofit)

```kotlin
interface CommunityApiService {
    @POST("auth/login")
    suspend fun login(@Body credentials: LoginRequest): LoginResponse
    
    @GET("activity-types")
    suspend fun getActivityTypes(): List<ActivityTypeDto>
    
    @POST("activity-types")
    suspend fun createActivityType(@Body dto: ActivityTypeDto): ActivityTypeDto
    
    @PUT("activity-types/{id}")
    suspend fun updateActivityType(@Path("id") id: String, @Body dto: ActivityTypeDto): ActivityTypeDto
    
    @DELETE("activity-types/{id}")
    suspend fun deleteActivityType(@Path("id") id: String)
    
    @GET("participant-roles")
    suspend fun getParticipantRoles(): List<ParticipantRoleDto>
    
    @POST("participant-roles")
    suspend fun createParticipantRole(@Body dto: ParticipantRoleDto): ParticipantRoleDto
    
    @PUT("participant-roles/{id}")
    suspend fun updateParticipantRole(@Path("id") id: String, @Body dto: ParticipantRoleDto): ParticipantRoleDto
    
    @DELETE("participant-roles/{id}")
    suspend fun deleteParticipantRole(@Path("id") id: String)
    
    @GET("participants")
    suspend fun getParticipants(): List<ParticipantDto>
    
    @POST("participants")
    suspend fun createParticipant(@Body dto: ParticipantDto): ParticipantDto
    
    @PUT("participants/{id}")
    suspend fun updateParticipant(@Path("id") id: String, @Body dto: ParticipantDto): ParticipantDto
    
    @DELETE("participants/{id}")
    suspend fun deleteParticipant(@Path("id") id: String)
    
    @GET("activities")
    suspend fun getActivities(): List<ActivityDto>
    
    @POST("activities")
    suspend fun createActivity(@Body dto: ActivityDto): ActivityDto
    
    @PUT("activities/{id}")
    suspend fun updateActivity(@Path("id") id: String, @Body dto: ActivityDto): ActivityDto
    
    @DELETE("activities/{id}")
    suspend fun deleteActivity(@Path("id") id: String)
    
    @GET("activities/{id}/assignments")
    suspend fun getActivityAssignments(@Path("id") activityId: String): List<AssignmentDto>
    
    @POST("activities/{id}/assignments")
    suspend fun createAssignment(@Path("id") activityId: String, @Body dto: AssignmentDto): AssignmentDto
    
    @DELETE("assignments/{id}")
    suspend fun deleteAssignment(@Path("id") id: String)
    
    @GET("analytics/engagement")
    suspend fun getEngagementMetrics(
        @Query("startDate") startDate: String?, 
        @Query("endDate") endDate: String?,
        @Query("geographicAreaId") geographicAreaId: String?
    ): EngagementMetricsDto
    
    @GET("analytics/growth")
    suspend fun getGrowthMetrics(
        @Query("period") period: String,
        @Query("geographicAreaId") geographicAreaId: String?
    ): GrowthMetricsDto
    
    @GET("analytics/geographic")
    suspend fun getGeographicBreakdown(): List<GeographicEngagementDto>
    
    @GET("venues")
    suspend fun getVenues(): List<VenueDto>
    
    @GET("venues/{id}")
    suspend fun getVenue(@Path("id") id: String): VenueDto
    
    @GET("venues/search")
    suspend fun searchVenues(@Query("query") query: String): List<VenueDto>
    
    @POST("venues")
    suspend fun createVenue(@Body dto: VenueDto): VenueDto
    
    @PUT("venues/{id}")
    suspend fun updateVenue(@Path("id") id: String, @Body dto: VenueDto): VenueDto
    
    @DELETE("venues/{id}")
    suspend fun deleteVenue(@Path("id") id: String)
    
    @GET("venues/{id}/activities")
    suspend fun getVenueActivities(@Path("id") id: String): List<ActivityDto>
    
    @GET("venues/{id}/participants")
    suspend fun getVenueParticipants(@Path("id") id: String): List<ParticipantDto>
    
    @GET("geographic-areas")
    suspend fun getGeographicAreas(): List<GeographicAreaDto>
    
    @GET("geographic-areas/{id}")
    suspend fun getGeographicArea(@Path("id") id: String): GeographicAreaDto
    
    @POST("geographic-areas")
    suspend fun createGeographicArea(@Body dto: GeographicAreaDto): GeographicAreaDto
    
    @PUT("geographic-areas/{id}")
    suspend fun updateGeographicArea(@Path("id") id: String, @Body dto: GeographicAreaDto): GeographicAreaDto
    
    @DELETE("geographic-areas/{id}")
    suspend fun deleteGeographicArea(@Path("id") id: String)
    
    @GET("geographic-areas/{id}/children")
    suspend fun getGeographicAreaChildren(@Path("id") id: String): List<GeographicAreaDto>
    
    @GET("geographic-areas/{id}/ancestors")
    suspend fun getGeographicAreaAncestors(@Path("id") id: String): List<GeographicAreaDto>
    
    @GET("geographic-areas/{id}/venues")
    suspend fun getGeographicAreaVenues(@Path("id") id: String): List<VenueDto>
    
    @GET("geographic-areas/{id}/statistics")
    suspend fun getGeographicAreaStatistics(@Path("id") id: String): GeographicAreaStatisticsDto
    
    @GET("participants/{id}/address-history")
    suspend fun getParticipantAddressHistory(@Path("id") participantId: String): List<ParticipantAddressHistoryDto>
    
    @GET("activities/{id}/venues")
    suspend fun getActivityVenues(@Path("id") activityId: String): List<ActivityVenueHistoryDto>
    
    @POST("activities/{id}/venues")
    suspend fun associateActivityVenue(@Path("id") activityId: String, @Body dto: ActivityVenueAssociationDto): ActivityVenueHistoryDto
    
    @DELETE("activities/{activityId}/venues/{venueId}")
    suspend fun removeActivityVenue(@Path("activityId") activityId: String, @Path("venueId") venueId: String)
}
```

### 6. ViewModels

```kotlin
@HiltViewModel
class ActivityTypeViewModel @Inject constructor(
    private val repository: ActivityTypeRepository
) : ViewModel() {
    
    val activityTypes: StateFlow<List<ActivityType>> = repository.getAllFlow()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())
    
    private val _uiState = MutableStateFlow<UiState>(UiState.Idle)
    val uiState: StateFlow<UiState> = _uiState.asStateFlow()
    
    fun createActivityType(name: String, description: String?) {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            val activityType = ActivityType(
                id = UUID.randomUUID().toString(),
                name = name,
                description = description,
                isPredefined = false
            )
            val result = repository.create(activityType)
            _uiState.value = if (result.isSuccess) {
                UiState.Success("Activity type created")
            } else {
                UiState.Error(result.exceptionOrNull()?.message ?: "Unknown error")
            }
        }
    }
    
    fun updateActivityType(id: String, name: String, description: String?) {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            val activityType = ActivityType(
                id = id,
                name = name,
                description = description,
                isPredefined = false
            )
            val result = repository.update(activityType)
            _uiState.value = if (result.isSuccess) {
                UiState.Success("Activity type updated")
            } else {
                UiState.Error(result.exceptionOrNull()?.message ?: "Unknown error")
            }
        }
    }
    
    fun deleteActivityType(id: String) {
        viewModelScope.launch {
            _uiState.value = UiState.Loading
            val result = repository.delete(id)
            _uiState.value = if (result.isSuccess) {
                UiState.Success("Activity type deleted")
            } else {
                UiState.Error(result.exceptionOrNull()?.message ?: "Cannot delete")
            }
        }
    }
}

sealed class UiState {
    object Idle : UiState()
    object Loading : UiState()
    data class Success(val message: String) : UiState()
    data class Error(val message: String) : UiState()
}
```

### 7. Background Synchronization

```kotlin
@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted context: Context,
    @Assisted params: WorkerParameters,
    private val syncQueueDao: SyncQueueDao,
    private val apiService: CommunityApiService
) : CoroutineWorker(context, params) {
    
    override suspend fun doWork(): Result {
        val queuedItems = syncQueueDao.getAll()
        
        if (queuedItems.isEmpty()) {
            return Result.success()
        }
        
        var failureCount = 0
        
        for (item in queuedItems) {
            try {
                when (item.entityType) {
                    "ACTIVITY_TYPE" -> syncActivityType(item)
                    "PARTICIPANT_ROLE" -> syncParticipantRole(item)
                    "PARTICIPANT" -> syncParticipant(item)
                    "ACTIVITY" -> syncActivity(item)
                    "ASSIGNMENT" -> syncAssignment(item)
                }
                syncQueueDao.delete(item)
            } catch (e: Exception) {
                failureCount++
                if (item.retryCount >= 3) {
                    // Notify user of conflict
                    showConflictNotification(item)
                    syncQueueDao.delete(item)
                }
            }
        }
        
        return if (failureCount == 0) {
            Result.success()
        } else {
            Result.retry()
        }
    }
    
    private suspend fun syncActivityType(item: SyncQueueEntity) {
        val entity = Json.decodeFromString<ActivityTypeEntity>(item.payload)
        when (item.operation) {
            "CREATE" -> apiService.createActivityType(entity.toDto())
            "UPDATE" -> apiService.updateActivityType(entity.id, entity.toDto())
            "DELETE" -> apiService.deleteActivityType(entity.id)
        }
    }
    
    private fun showConflictNotification(item: SyncQueueEntity) {
        // Show notification to user about sync conflict
    }
}
```

### 8. Authentication Manager

```kotlin
class AuthManager @Inject constructor(
    private val encryptedPrefs: SharedPreferences,
    private val apiService: CommunityApiService
) {
    
    suspend fun login(email: String, password: String): Result<User> {
        return try {
            val response = apiService.login(LoginRequest(email, password))
            encryptedPrefs.edit()
                .putString("access_token", response.accessToken)
                .putString("refresh_token", response.refreshToken)
                .putString("user_id", response.user.id)
                .putString("user_email", response.user.email)
                .putString("user_name", response.user.name)
                .putString("user_role", response.user.role)
                .apply()
            Result.success(response.user.toDomainModel())
        } catch (e: Exception) {
            Result.failure(e)
        }
    }
    
    fun logout() {
        encryptedPrefs.edit().clear().apply()
    }
    
    fun getCurrentUser(): User? {
        val id = encryptedPrefs.getString("user_id", null) ?: return null
        val email = encryptedPrefs.getString("user_email", null) ?: return null
        val name = encryptedPrefs.getString("user_name", null) ?: return null
        val roleStr = encryptedPrefs.getString("user_role", null) ?: return null
        val role = UserRole.valueOf(roleStr)
        
        return User(id, email, name, role)
    }
    
    fun getAccessToken(): String? {
        return encryptedPrefs.getString("access_token", null)
    }
    
    fun isAuthenticated(): Boolean {
        return getAccessToken() != null
    }
}
```

### 9. Connectivity Manager

```kotlin
class ConnectivityManager @Inject constructor(
    @ApplicationContext private val context: Context
) {
    
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
    
    fun isConnected(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }
    
    fun observeConnectivity(): Flow<Boolean> = callbackFlow {
        val callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                trySend(true)
            }
            
            override fun onLost(network: Network) {
                trySend(false)
            }
        }
        
        val request = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        
        connectivityManager.registerNetworkCallback(request, callback)
        
        awaitClose {
            connectivityManager.unregisterNetworkCallback(callback)
        }
    }
}
```

### 10. Validators

```kotlin
object EmailValidator {
    private val EMAIL_PATTERN = Patterns.EMAIL_ADDRESS
    
    fun isValid(email: String): Boolean {
        return email.isNotBlank() && EMAIL_PATTERN.matcher(email).matches()
    }
}

object ParticipantValidator {
    fun validate(name: String, email: String): ValidationResult {
        val errors = mutableListOf<String>()
        
        if (name.isBlank()) {
            errors.add("Name is required")
        }
        
        if (email.isBlank()) {
            errors.add("Email is required")
        } else if (!EmailValidator.isValid(email)) {
            errors.add("Email format is invalid")
        }
        
        return if (errors.isEmpty()) {
            ValidationResult.Valid
        } else {
            ValidationResult.Invalid(errors)
        }
    }
}

sealed class ValidationResult {
    object Valid : ValidationResult()
    data class Invalid(val errors: List<String>) : ValidationResult()
}
```

## Data Models

### Entity-Domain-DTO Mapping

The application uses three types of models:

1. **Entity Models**: Room database entities with annotations
2. **Domain Models**: Clean business objects without framework dependencies
3. **DTO Models**: Data transfer objects for API communication

Mapping functions convert between these representations:

```kotlin
fun ActivityTypeEntity.toDomainModel() = ActivityType(
    id = id,
    name = name,
    description = description,
    isPredefined = isPredefined
)

fun ActivityType.toEntity() = ActivityTypeEntity(
    id = id,
    name = name,
    description = description,
    isPredefined = isPredefined,
    createdAt = System.currentTimeMillis(),
    updatedAt = System.currentTimeMillis()
)

fun ActivityTypeEntity.toDto() = ActivityTypeDto(
    id = id,
    name = name,
    description = description,
    isPredefined = isPredefined
)
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: Activity type retrieval completeness
*For any* set of activity types stored in the database, retrieving all activity types should return exactly that set with no additions or omissions.
**Validates: Requirements 2.1**

### Property 2: Activity type predefined flag accuracy
*For any* activity type, the isPredefined flag should accurately reflect whether it was created by the system or by a user.
**Validates: Requirements 2.2**

### Property 3: Activity type deletion referential integrity
*For any* activity type that is referenced by one or more activities, attempting to delete that activity type should fail and return an error.
**Validates: Requirements 2.6**

### Property 4: Participant role retrieval completeness
*For any* set of participant roles stored in the database, retrieving all roles should return exactly that set with no additions or omissions.
**Validates: Requirements 3.1**

### Property 5: Participant role predefined flag accuracy
*For any* participant role, the isPredefined flag should accurately reflect whether it was created by the system or by a user.
**Validates: Requirements 3.2**

### Property 6: Participant role deletion referential integrity
*For any* participant role that is referenced by one or more assignments, attempting to delete that role should fail and return an error.
**Validates: Requirements 3.6**

### Property 7: Participant retrieval completeness
*For any* set of participants stored in the database, retrieving all participants should return exactly that set with no additions or omissions.
**Validates: Requirements 4.1**

### Property 8: Participant search accuracy
*For any* search query and set of participants, the search results should contain only participants whose name or email contains the query string (case-insensitive).
**Validates: Requirements 4.2**

### Property 9: Participant name and email validation
*For any* participant creation or update attempt, if the name is blank or the email is blank, the operation should be rejected with a validation error.
**Validates: Requirements 4.7**

### Property 10: Participant email format validation
*For any* participant creation or update attempt with an invalid email format, the operation should be rejected with a validation error.
**Validates: Requirements 4.8**

### Property 11: Participant optional fields acceptance
*For any* participant creation or update attempt with valid name and email, the operation should succeed even if phone and notes are null or empty.
**Validates: Requirements 4.9**

### Property 12: Activity retrieval completeness
*For any* set of activities stored in the database, retrieving all activities should return exactly that set with no additions or omissions.
**Validates: Requirements 5.1**

### Property 13: Activity filtering accuracy
*For any* filter criteria (type or status) and set of activities, the filtered results should contain only activities that match the specified criteria.
**Validates: Requirements 5.2**

### Property 14: Finite activity end date validation
*For any* finite activity creation or update attempt without an end date, the operation should be rejected with a validation error.
**Validates: Requirements 5.8**

### Property 15: Ongoing activity null end date acceptance
*For any* ongoing activity creation or update attempt, the operation should succeed even if the end date is null.
**Validates: Requirements 5.9**

### Property 16: Assignment role validation
*For any* assignment creation attempt without a role specified, the operation should be rejected with a validation error.
**Validates: Requirements 6.2**

### Property 17: Assignment uniqueness constraint
*For any* assignment creation attempt where an assignment already exists for the same activity and participant combination, the operation should be rejected with a uniqueness error.
**Validates: Requirements 6.6**

### Property 18: Analytics count accuracy
*For any* point in time, the total participant count and total activity count displayed should match the actual number of participants and activities in the database.
**Validates: Requirements 7.2**

### Property 19: Analytics filtered count accuracy
*For any* point in time, the active activity count and ongoing activity count displayed should match the actual number of activities with those statuses in the database.
**Validates: Requirements 7.3**

### Property 20: Analytics percentage change calculation
*For any* two time periods with counts C1 and C2, the percentage change displayed should equal ((C2 - C1) / C1) * 100 when C1 > 0, or 0 when C1 = 0.
**Validates: Requirements 7.9**

### Property 21: Analytics cumulative count calculation
*For any* time series of counts, the cumulative count at any point should equal the sum of all counts up to and including that point.
**Validates: Requirements 7.10**

### Property 22: Login credential validation
*For any* login attempt with blank email or blank password, the operation should be rejected with a validation error.
**Validates: Requirements 8.2**

### Property 23: Credential storage round-trip
*For any* valid credentials stored in EncryptedSharedPreferences, retrieving those credentials should return values equal to what was stored.
**Validates: Requirements 8.5**

### Property 24: Authentication protection
*For any* screen requiring authentication, attempting to access it without valid credentials should be blocked and redirect to login.
**Validates: Requirements 9.1**

### Property 25: Administrator role feature access
*For any* user with ADMINISTRATOR role, all features (create, read, update, delete) should be accessible.
**Validates: Requirements 9.3**

### Property 26: Editor role feature access
*For any* user with EDITOR role, create, read, update, and delete features should be accessible.
**Validates: Requirements 9.4**

### Property 27: Read-only role feature restriction
*For any* user with READ_ONLY role, create, update, and delete features should be hidden or disabled, with only read features accessible.
**Validates: Requirements 9.5**

### Property 28: Data caching completeness
*For any* initial data load from the API, all retrieved data should be stored in the local Room database.
**Validates: Requirements 10.2**

### Property 29: Offline operation functionality
*For any* read operation when offline, the operation should succeed using cached data from the local database.
**Validates: Requirements 10.3**

### Property 30: Offline operation queuing
*For any* create, update, or delete operation when offline, the operation should be added to the sync queue and applied to local database.
**Validates: Requirements 10.4**

### Property 31: Offline feature restriction
*For any* feature requiring network connectivity when offline, that feature should be disabled or indicate unavailability.
**Validates: Requirements 10.7**

### Property 32: Connectivity restoration detection
*For any* change in network connectivity from offline to online, the app should detect this change within a reasonable time period.
**Validates: Requirements 11.1**

### Property 33: Sync queue processing on connectivity
*For any* queued operations when connectivity is restored, those operations should be processed and sent to the API.
**Validates: Requirements 11.2**

### Property 34: Sync queue clearing on success
*For any* queued operation that successfully synchronizes with the API, that operation should be removed from the sync queue.
**Validates: Requirements 11.4**

### Property 35: Sync retry with exponential backoff
*For any* queued operation that fails to synchronize, the retry delay should increase exponentially with each subsequent failure (e.g., 1s, 2s, 4s, 8s).
**Validates: Requirements 11.5**

### Property 36: Pending operation count accuracy
*For any* point in time, the displayed pending operation count should equal the actual number of items in the sync queue.
**Validates: Requirements 11.7**

### Property 37: Push notification handling
*For any* incoming push notification, the app should process the notification payload and extract relevant data without errors.
**Validates: Requirements 12.3**

### Property 38: Navigation state preservation
*For any* navigation within a section, returning to that section should restore the previous navigation state (scroll position, selected item, etc.).
**Validates: Requirements 13.3**

### Property 39: Form validation before submission
*For any* form with invalid inputs, the submit action should be blocked until all validation errors are resolved.
**Validates: Requirements 14.1**

### Property 40: Submit button state during validation
*For any* form with validation errors, the submit button should be disabled until all errors are resolved.
**Validates: Requirements 14.4**

### Property 41: Valid field value preservation
*For any* form validation failure, all fields that passed validation should retain their values.
**Validates: Requirements 14.5**

### Property 42: Application state preservation on errors
*For any* error that occurs during an operation, the application state should remain consistent and not be corrupted.
**Validates: Requirements 15.5**

### Property 43: Button state during operations
*For any* button that triggers an asynchronous operation, the button should be disabled while the operation is in progress.
**Validates: Requirements 16.2**

### Property 44: Interactive element content descriptions
*For any* interactive UI element (button, input, etc.), that element should have a non-empty content description for accessibility.
**Validates: Requirements 17.3**

### Property 45: Venue list display completeness
*For any* set of Venues stored in the database, retrieving and displaying the list should return all venues with name, address, and geographic area.
**Validates: Requirements 6A.1**

### Property 46: Venue search accuracy
*For any* search query string and set of Venues, the search results should include all and only those Venues whose name or address contains the query string (case-insensitive).
**Validates: Requirements 6A.2**

### Property 47: Venue required field validation
*For any* venue creation or update with missing required fields (name, address, or geographic area), the validation should reject the input and prevent submission.
**Validates: Requirements 6A.7**

### Property 48: Venue optional field acceptance
*For any* venue creation with or without optional latitude, longitude, and venue type fields, the submission should succeed if all required fields are valid.
**Validates: Requirements 6A.8**

### Property 49: Venue deletion prevention
*For any* Venue referenced by Activities or Participants, attempting to delete it should fail and display a dialog explaining which entities reference it.
**Validates: Requirements 6A.10, 6A.11**

### Property 50: Venue detail view completeness
*For any* Venue, the detail screen should display the venue information, associated activities, and participants using it as home address.
**Validates: Requirements 6A.9**

### Property 51: Geographic area hierarchical display
*For any* set of GeographicAreas, the list view should display them in a hierarchical structure showing parent-child relationships.
**Validates: Requirements 6B.1**

### Property 52: Geographic area required field validation
*For any* geographic area creation with missing required fields (name or area type), the validation should reject the input and prevent submission.
**Validates: Requirements 6B.5**

### Property 53: Circular relationship prevention
*For any* GeographicArea, attempting to set its parent to itself or to one of its descendants should be rejected with a validation error.
**Validates: Requirements 6B.7**

### Property 54: Geographic area deletion prevention
*For any* GeographicArea referenced by Venues or child GeographicAreas, attempting to delete it should fail and display a dialog explaining which entities reference it.
**Validates: Requirements 6B.9, 6B.10**

### Property 55: Map marker display
*For any* Venue with non-null latitude and longitude, a marker should be displayed on the map at the correct coordinates.
**Validates: Requirements 6C.2**

### Property 56: Map marker activity information
*For any* venue marker tapped on the map, the info window should display activity information for that venue.
**Validates: Requirements 6C.3**

### Property 57: Map marker visual distinction
*For any* set of venues on the map, markers should use different colors or icons based on activity type or status to visually distinguish them.
**Validates: Requirements 6C.4**

### Property 58: Map filter application
*For any* filter criteria (activity type, status, or date range) applied to the map, only venues with activities matching the criteria should display markers.
**Validates: Requirements 6C.5**

### Property 59: Participant address history display
*For any* Participant with address history, the detail screen should display all historical home addresses ordered by effectiveFrom date descending.
**Validates: Requirements 4.12**

### Property 60: Activity venue history display
*For any* Activity with venue associations, the detail screen should display all current and historical venue associations with their effective date ranges.
**Validates: Requirements 5.13**

### Property 61: Geographic area filter application
*For any* analytics screen with a geographic area filter applied, only activities and participants associated with venues in that geographic area or its descendants should be included in the metrics.
**Validates: Requirements 7.11**

### Property 62: Geographic breakdown chart display
*For any* engagement metrics, the geographic breakdown chart should correctly display engagement data grouped by geographic area.
**Validates: Requirements 7.12**

## Error Handling

### Error Categories

The application handles errors in the following categories:

1. **Validation Errors**: Input validation failures (invalid email, missing required fields)
2. **Network Errors**: API communication failures (timeout, connection refused, server errors)
3. **Database Errors**: Local storage failures (constraint violations, disk full)
4. **Authentication Errors**: Login failures, token expiration, unauthorized access
5. **Sync Errors**: Background synchronization failures, conflict resolution

### Error Handling Strategy

**Validation Errors**:
- Display inline error messages next to invalid fields
- Highlight invalid fields with error styling
- Disable submit buttons until validation passes
- Preserve valid field values when showing errors

**Network Errors**:
- Queue operations for later sync when offline
- Display user-friendly error messages (avoid technical jargon)
- Provide retry options for transient failures
- Show connection status indicator

**Database Errors**:
- Log errors for debugging
- Display generic error messages to users
- Attempt recovery where possible (e.g., retry with backoff)
- Prevent data corruption by rolling back failed transactions

**Authentication Errors**:
- Clear stored credentials on authentication failure
- Redirect to login screen
- Display specific error messages (invalid credentials, account locked)
- Handle token expiration gracefully

**Sync Errors**:
- Retry with exponential backoff (max 3 attempts)
- Notify users of conflicts requiring manual resolution
- Display pending operation count
- Allow users to view and manage sync queue

### Error Recovery

The application implements the following recovery mechanisms:

1. **Automatic Retry**: Network and sync errors trigger automatic retries with exponential backoff
2. **Graceful Degradation**: Offline mode provides full functionality with local data
3. **State Preservation**: Errors don't corrupt application state or lose user input
4. **User Notification**: Clear error messages guide users toward resolution
5. **Conflict Resolution**: Sync conflicts are detected and presented to users for manual resolution

## Testing Strategy

### Dual Testing Approach

The application uses both unit testing and property-based testing to ensure comprehensive coverage:

**Unit Tests**:
- Verify specific examples and edge cases
- Test integration points between components
- Validate error conditions and boundary values
- Test UI component behavior with specific inputs

**Property-Based Tests**:
- Verify universal properties across all inputs
- Test with randomly generated data (minimum 100 iterations per property)
- Catch edge cases that might be missed in example-based tests
- Validate invariants and business rules

Both testing approaches are complementary and necessary for comprehensive coverage.

### Testing Framework

**Unit Testing**:
- JUnit 5 for test execution
- MockK for mocking dependencies
- Turbine for testing Kotlin Flow
- Robolectric for Android framework testing

**Property-Based Testing**:
- Kotest Property Testing for generating random test data
- Custom generators for domain models
- Minimum 100 iterations per property test
- Each property test tagged with: **Feature: android-mobile-app, Property {number}: {property_text}**

### Test Organization

```
app/
├── src/
│   ├── main/
│   │   └── java/
│   └── test/
│       └── java/
│           ├── data/
│           │   ├── repository/
│           │   │   ├── ActivityTypeRepositoryTest.kt
│           │   │   └── ActivityTypeRepositoryPropertyTest.kt
│           │   └── dao/
│           │       ├── ActivityTypeDaoTest.kt
│           │       └── ActivityTypeDaoPropertyTest.kt
│           ├── domain/
│           │   ├── validator/
│           │   │   ├── EmailValidatorTest.kt
│           │   │   └── EmailValidatorPropertyTest.kt
│           │   └── usecase/
│           └── ui/
│               └── viewmodel/
│                   ├── ActivityTypeViewModelTest.kt
│                   └── ActivityTypeViewModelPropertyTest.kt
```

### Property Test Configuration

Each property test must:
1. Run minimum 100 iterations
2. Use appropriate generators for domain models
3. Include a comment tag referencing the design property
4. Test a single correctness property from the design document

Example property test:

```kotlin
class ActivityTypeRepositoryPropertyTest {
    
    // Feature: android-mobile-app, Property 1: Activity type retrieval completeness
    @Test
    fun `retrieving all activity types returns complete set`() = runTest {
        checkAll(100, Arb.list(Arb.activityType(), 0..50)) { activityTypes ->
            // Arrange: Insert activity types into database
            activityTypes.forEach { dao.insert(it.toEntity()) }
            
            // Act: Retrieve all activity types
            val retrieved = repository.getAllFlow().first()
            
            // Assert: Retrieved set matches inserted set
            retrieved.toSet() shouldBe activityTypes.toSet()
            
            // Cleanup
            activityTypes.forEach { dao.delete(it.toEntity()) }
        }
    }
}
```

### Custom Generators

Property tests use custom generators for domain models:

```kotlin
object DomainArbitraries {
    
    fun Arb.Companion.activityType(): Arb<ActivityType> = arbitrary {
        ActivityType(
            id = Arb.uuid().bind().toString(),
            name = Arb.string(1..100).bind(),
            description = Arb.string(0..500).orNull().bind(),
            isPredefined = Arb.bool().bind()
        )
    }
    
    fun Arb.Companion.participant(): Arb<Participant> = arbitrary {
        Participant(
            id = Arb.uuid().bind().toString(),
            name = Arb.string(1..100).bind(),
            email = Arb.email().bind(),
            phone = Arb.phoneNumber().orNull().bind(),
            notes = Arb.string(0..1000).orNull().bind()
        )
    }
    
    fun Arb.Companion.email(): Arb<String> = arbitrary {
        val username = Arb.string(1..20, Codepoint.alphanumeric()).bind()
        val domain = Arb.string(1..20, Codepoint.alphanumeric()).bind()
        "$username@$domain.com"
    }
    
    fun Arb.Companion.phoneNumber(): Arb<String> = arbitrary {
        val areaCode = Arb.int(100..999).bind()
        val prefix = Arb.int(100..999).bind()
        val lineNumber = Arb.int(1000..9999).bind()
        "($areaCode) $prefix-$lineNumber"
    }
}
```

### Test Coverage Goals

- **Unit Test Coverage**: Minimum 80% code coverage
- **Property Test Coverage**: All correctness properties from design document
- **Integration Test Coverage**: All repository-API interactions
- **UI Test Coverage**: Critical user flows (login, create activity, assign participant)

### Continuous Integration

Tests run automatically on:
- Every commit to feature branches
- Pull request creation and updates
- Merge to main branch

CI pipeline fails if:
- Any test fails
- Code coverage drops below 80%
- Property tests find counterexamples
- Build fails or has compilation errors
