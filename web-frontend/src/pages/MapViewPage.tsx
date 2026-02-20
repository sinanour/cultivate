import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import { MapView } from '../components/features/MapView.optimized';
import { ProgressIndicator } from '../components/common/ProgressIndicator';
import { PopulationService } from '../services/api/population.service';
import { ParticipantRoleService } from '../services/api/participant-role.service';
import { activityCategoryService } from '../services/api/activity-category.service';
import { ActivityTypeService } from '../services/api/activity-type.service';
import type { ActivityCategory, ActivityType } from '../types';
import { 
  FilterGroupingPanel, 
  type FilterGroupingState, 
  type FilterProperty, 
  type GroupingDimension as FilterGroupingDimension 
} from '../components/common/FilterGroupingPanel';

type MapMode = 'activitiesByType' | 'activitiesByCategory' | 'participantHomes' | 'venues';

export default function MapViewPage() {
  const [searchParams] = useSearchParams();
  
  // Track whether filters are ready (URL filters resolved)
  const [filtersReady, setFiltersReady] = useState(false);
  
  // Map loading state
  const [mapLoadingState, setMapLoadingState] = useState<{ 
    loadedCount: number; 
    totalCount: number; 
    isCancelled: boolean;
  }>({ loadedCount: 0, totalCount: 0, isCancelled: false });
  
  // Initialize from URL
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    const urlMode = searchParams.get('mode');
    return (urlMode as MapMode) || 'activitiesByType';
  });
  
  // Date range state
  const [dateRange, setDateRange] = useState<{ 
    startDate?: string; 
    endDate?: string;
    type?: 'absolute' | 'relative';
    amount?: number;
    unit?: 'day' | 'week' | 'month' | 'year';
  } | null>(() => {
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const relativePeriod = searchParams.get('relativePeriod');
    
    // Handle relative date range (e.g., "-90d", "-6m")
    if (relativePeriod) {
      const match = relativePeriod.match(/^-(\d+)([dwmy])$/);
      if (match) {
        const amount = parseInt(match[1], 10);
        const unitChar = match[2];
        
        let unit: 'day' | 'week' | 'month' | 'year';
        switch (unitChar) {
          case 'd':
            unit = 'day';
            break;
          case 'w':
            unit = 'week';
            break;
          case 'm':
            unit = 'month';
            break;
          case 'y':
            unit = 'year';
            break;
          default:
            return null;
        }
        
        return {
          type: 'relative',
          amount,
          unit,
        };
      }
    }
    
    // Handle absolute date range
    if (startDateStr || endDateStr) {
      return {
        startDate: startDateStr || undefined,
        endDate: endDateStr || undefined,
        type: 'absolute',
      };
    }
    return null;
  });
  
  // PropertyFilter state for populations
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });

  // Bidirectional cache: label ↔ UUID for populations
  const [labelToUuidCache, setLabelToUuidCache] = useState<Map<string, string>>(new Map());

  // Helper to add to cache
  const addToCache = useCallback((uuid: string, label: string) => {
    setLabelToUuidCache(prev => new Map(prev).set(label, uuid));
  }, []);

  // Helper to get UUID from label
  const getUuidFromLabel = (label: string): string | undefined => {
    return labelToUuidCache.get(label);
  };

  // Extract individual values from consolidated tokens
  const extractValuesFromToken = (token: PropertyFilterProps.Token): string[] => {
    if (!token.value) return [];
    return token.value.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0);
  };

  // Fetch populations for cache warming
  const { data: allPopulations = [] } = useQuery({
    queryKey: ['populations'],
    queryFn: PopulationService.getPopulations,
  });

  // Warm cache when populations load
  useEffect(() => {
    if (allPopulations && allPopulations.length > 0) {
      allPopulations.forEach(pop => addToCache(pop.id, pop.name));
    }
  }, [allPopulations, addToCache]);

  // FilterGroupingPanel configuration with loadItems callbacks
  const filteringProperties: FilterProperty[] = useMemo(() => [
    {
      key: 'activityCategory',
      propertyLabel: 'Activity Category',
      groupValuesLabel: 'Activity Category values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const categories: ActivityCategory[] = await activityCategoryService.getActivityCategories();
        const filtered = categories.filter((cat: ActivityCategory) => 
          !filterText || cat.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach((cat: ActivityCategory) => addToCache(cat.id, cat.name));
        return filtered.map((cat: ActivityCategory) => ({
          propertyKey: 'activityCategory',
          value: cat.name,
          label: cat.name,
        }));
      },
    },
    {
      key: 'activityType',
      propertyLabel: 'Activity Type',
      groupValuesLabel: 'Activity Type values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const types: ActivityType[] = await ActivityTypeService.getActivityTypes();
        const filtered = types.filter((type: ActivityType) => 
          !filterText || type.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach((type: ActivityType) => addToCache(type.id, type.name));
        return filtered.map((type: ActivityType) => ({
          propertyKey: 'activityType',
          value: type.name,
          label: type.name,
        }));
      },
    },
    {
      key: 'status',
      propertyLabel: 'Status',
      groupValuesLabel: 'Status values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const statuses = [
          { value: 'PLANNED', label: 'Planned' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ];
        
        const filtered = statuses.filter(status => 
          !filterText || status.label.toLowerCase().includes(filterText.toLowerCase())
        );
        
        return filtered.map(status => ({
          propertyKey: 'status',
          value: status.label,
          label: status.label,
        }));
      },
    },
    {
      key: 'population',
      propertyLabel: 'Population',
      groupValuesLabel: 'Population values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const populations = await PopulationService.getPopulations();
        const filtered = populations.filter(pop => 
          !filterText || pop.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach(pop => addToCache(pop.id, pop.name));
        return filtered.map(pop => ({
          propertyKey: 'population',
          value: pop.name,
          label: pop.name,
        }));
      },
    },
    // NEW: Role filter property
    {
      key: 'role',
      propertyLabel: 'Role',
      groupValuesLabel: 'Role values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const roles = await ParticipantRoleService.searchRoles(filterText);

        roles.forEach(role => addToCache(role.id, role.name));
        return roles.map(role => ({
          propertyKey: 'role',
          value: role.name,
          label: role.name,
          description: role.isPredefined ? 'Predefined role' : 'Custom role',
        }));
      },
    },
    // NEW: Age Cohort filter property
    {
      key: 'ageCohort',
      propertyLabel: 'Age Cohort',
      groupValuesLabel: 'Age Cohort values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const cohorts = [
          { value: 'Child', label: 'Child' },
          { value: 'Junior Youth', label: 'Junior Youth' },
          { value: 'Youth', label: 'Youth' },
          { value: 'Young Adult', label: 'Young Adult' },
          { value: 'Adult', label: 'Adult' },
          { value: 'Unknown', label: 'Unknown' },
        ];

        const filtered = cohorts.filter(cohort =>
          !filterText || cohort.label.toLowerCase().includes(filterText.toLowerCase())
        );

        return filtered.map(cohort => ({
          propertyKey: 'ageCohort',
          value: cohort.value,
          label: cohort.label,
        }));
      },
    },
  ], [addToCache]); // Depend on addToCache which is stable

  const groupingDimensionsConfig: FilterGroupingDimension[] = [
    { value: 'activitiesByType', label: 'Activities by Type' },
    { value: 'activitiesByCategory', label: 'Activities by Category' },
    { value: 'participantHomes', label: 'Participant Homes' },
    { value: 'venues', label: 'Venues' },
  ];

  // Handler for FilterGroupingPanel updates
  const handleFilterUpdate = (state: FilterGroupingState) => {
    setPropertyFilterQuery(state.filterTokens);
    setDateRange(state.dateRange);
    if (typeof state.grouping === 'string') {
      handleModeChange(state.grouping as MapMode);
    }
  };

  // Handler for when initial URL filters are resolved
  const handleInitialResolutionComplete = useCallback(() => {
    setFiltersReady(true);
  }, []);

  // Handle mode change
  const handleModeChange = useCallback((newMode: MapMode) => {
    setMapMode(newMode);
    // Reset cancelled state when mode changes to allow new mode to fetch data
    setMapLoadingState(prev => ({ ...prev, isCancelled: false }));
  }, []);

  // Extract population IDs from filter tokens
  const selectedPopulationIds = propertyFilterQuery.tokens
    .filter(t => t.propertyKey === 'population' && t.operator === '=')
    .flatMap(t => extractValuesFromToken(t))
    .map(label => getUuidFromLabel(label))
    .filter(Boolean) as string[];

  // Extract activity category IDs from filter tokens
  const selectedActivityCategoryIds = propertyFilterQuery.tokens
    .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
    .flatMap(t => extractValuesFromToken(t))
    .map(label => getUuidFromLabel(label))
    .filter(Boolean) as string[];

  // Extract activity type IDs from filter tokens
  const selectedActivityTypeIds = propertyFilterQuery.tokens
    .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
    .flatMap(t => extractValuesFromToken(t))
    .map(label => getUuidFromLabel(label))
    .filter(Boolean) as string[];

  // Extract status values from filter tokens
  const selectedStatuses = propertyFilterQuery.tokens
    .filter(t => t.propertyKey === 'status' && t.operator === '=')
    .flatMap(t => extractValuesFromToken(t))
    .map(label => {
      // Convert display label back to API value
      const statusMap: Record<string, string> = {
        'Planned': 'PLANNED',
        'Active': 'ACTIVE',
        'Completed': 'COMPLETED',
        'Cancelled': 'CANCELLED',
      };
      return statusMap[label] || label;
    })
    .filter(Boolean) as string[];

  // NEW: Extract role IDs from filter tokens
  const selectedRoleIds = propertyFilterQuery.tokens
    .filter(t => t.propertyKey === 'role' && t.operator === '=')
    .flatMap(t => extractValuesFromToken(t))
    .map(label => getUuidFromLabel(label))
    .filter(Boolean) as string[];

  // NEW: Extract age cohort values from filter tokens
  const selectedAgeCohorts = propertyFilterQuery.tokens
    .filter(t => t.propertyKey === 'ageCohort' && t.operator === '=')
    .flatMap(t => extractValuesFromToken(t))
    .filter(Boolean) as string[];

  // Determine which filters to pass based on map mode
  const getFiltersForMode = () => {
    const applyParticipantFilters = mapMode !== 'venues';

    const baseFilters = {
      populationIds: applyParticipantFilters ? selectedPopulationIds : [],
      activityCategoryIds: [] as string[],
      activityTypeIds: [] as string[],
      status: undefined as string | undefined,
      roleIds: applyParticipantFilters ? selectedRoleIds : [], // NEW
      ageCohorts: applyParticipantFilters ? selectedAgeCohorts : [], // NEW
    };

    // Activity category, activity type, and status filters only apply to activity modes
    if (mapMode === 'activitiesByType' || mapMode === 'activitiesByCategory') {
      baseFilters.activityCategoryIds = selectedActivityCategoryIds;
      baseFilters.activityTypeIds = selectedActivityTypeIds;
      baseFilters.status = selectedStatuses.length > 0 ? selectedStatuses.join(',') : undefined;
    }

    return baseFilters;
  };

  const modeFilters = getFiltersForMode();

  // Convert date range to absolute dates for API
  const getAbsoluteDates = (): { startDate?: string; endDate?: string } => {
    if (!dateRange) return {};
    
    if (dateRange.type === 'absolute' && dateRange.startDate && dateRange.endDate) {
      return {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };
    } else if (dateRange.type === 'relative' && dateRange.amount && dateRange.unit) {
      // Calculate absolute dates from relative range
      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      
      switch (dateRange.unit) {
        case 'day':
          start.setDate(start.getDate() - dateRange.amount);
          break;
        case 'week':
          start.setDate(start.getDate() - (dateRange.amount * 7));
          break;
        case 'month':
          start.setMonth(start.getMonth() - dateRange.amount);
          break;
        case 'year':
          start.setFullYear(start.getFullYear() - dateRange.amount);
          break;
      }
      
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    }
    
    return {};
  };

  const absoluteDates = getAbsoluteDates();

  // Handlers for pause/resume
  const handlePauseLoading = useCallback(() => {
    setMapLoadingState(prev => ({ ...prev, isCancelled: true }));
  }, []);

  const handleResumeLoading = useCallback(() => {
    setMapLoadingState(prev => ({ ...prev, isCancelled: false }));
  }, []);

  // Get entity name based on map mode
  const getEntityName = () => {
    switch (mapMode) {
      case 'activitiesByType':
      case 'activitiesByCategory':
        return 'activities';
      case 'participantHomes':
        return 'participant homes';
      case 'venues':
        return 'venues';
      default:
        return 'markers';
    }
  };

  return (
    <ContentLayout>
      <SpaceBetween size="l">
        <Container 
          header={
            <Header variant="h2">
              <Box display="inline" fontSize="heading-l" fontWeight="bold">
                <SpaceBetween direction="horizontal" size="xs">
                  <Box display="inline-block" variant="h1">
                    <SpaceBetween direction="horizontal" size="xs">
                      <span>Map View</span>
                      {mapLoadingState.loadedCount >= mapLoadingState.totalCount && mapLoadingState.totalCount > 0 && (
                        <Box display="inline" color="text-status-inactive" variant="h1" fontWeight="normal">
                          ({mapLoadingState.loadedCount})
                        </Box>
                      )}
                    </SpaceBetween>
                  </Box>
                  <ProgressIndicator
                    loadedCount={mapLoadingState.loadedCount}
                    totalCount={mapLoadingState.totalCount}
                    entityName={getEntityName()}
                    onCancel={handlePauseLoading}
                    onResume={handleResumeLoading}
                    isCancelled={mapLoadingState.isCancelled}
                  />
                </SpaceBetween>
              </Box>
            </Header>
          }
        >
          <SpaceBetween size="m">
            {/* FilterGroupingPanel */}
            <FilterGroupingPanel
              filterProperties={filteringProperties}
              groupingMode="exclusive"
              groupingDimensions={groupingDimensionsConfig}
              initialDateRange={dateRange}
              initialFilterTokens={propertyFilterQuery}
              initialGrouping={mapMode}
              onUpdate={handleFilterUpdate}
              onInitialResolutionComplete={handleInitialResolutionComplete}
              isLoading={false}
            />

            {/* Map */}
            <div style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
              <MapView 
                mode={mapMode}
                populationIds={modeFilters.populationIds}
                activityCategoryIds={modeFilters.activityCategoryIds}
                activityTypeIds={modeFilters.activityTypeIds}
                status={modeFilters.status}
                roleIds={modeFilters.roleIds}
                ageCohorts={modeFilters.ageCohorts}
                startDate={absoluteDates.startDate}
                endDate={absoluteDates.endDate}
                onLoadingStateChange={setMapLoadingState}
                externalIsCancelled={mapLoadingState.isCancelled}
                onResumeRequest={handleResumeLoading}
                readyToFetch={filtersReady}
              />
            </div>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
