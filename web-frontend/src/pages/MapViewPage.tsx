import { useState, useEffect, useCallback } from 'react';
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
import { 
  FilterGroupingPanel, 
  type FilterGroupingState, 
  type FilterProperty, 
  type GroupingDimension as FilterGroupingDimension 
} from '../components/common/FilterGroupingPanel';

type MapMode = 'activitiesByType' | 'activitiesByCategory' | 'participantHomes' | 'venues';

export default function MapViewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
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
  const [propertyFilterOptions, setPropertyFilterOptions] = useState<PropertyFilterProps.FilteringOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Bidirectional cache: label ↔ UUID for populations
  const [labelToUuidCache, setLabelToUuidCache] = useState<Map<string, string>>(new Map());
  const [uuidToLabelCache, setUuidToLabelCache] = useState<Map<string, string>>(new Map());

  // Helper to add to cache
  const addToCache = (uuid: string, label: string) => {
    setLabelToUuidCache(prev => new Map(prev).set(label, uuid));
    setUuidToLabelCache(prev => new Map(prev).set(uuid, label));
  };

  // Helper to get UUID from label
  const getUuidFromLabel = (label: string): string | undefined => {
    return labelToUuidCache.get(label);
  };

  // Helper to get label from UUID
  const getLabelFromUuid = (uuid: string): string | undefined => {
    return uuidToLabelCache.get(uuid);
  };

  // Extract individual values from consolidated tokens
  const extractValuesFromToken = (token: PropertyFilterProps.Token): string[] => {
    if (!token.value) return [];
    return token.value.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0);
  };

  // FilterGroupingPanel configuration
  const filteringProperties: FilterProperty[] = [
    {
      key: 'population',
      propertyLabel: 'Population',
      groupValuesLabel: 'Population values',
      operators: ['='],
    },
  ];

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

  // Async loading of population values
  const handleLoadItems: PropertyFilterProps['onLoadItems'] = async ({ detail }) => {
    const { filteringProperty, filteringText } = detail;
    
    if (!filteringProperty || filteringProperty.key !== 'population') return;

    setIsLoadingOptions(true);

    try {
      const populations = await PopulationService.getPopulations();
      const filtered = populations.filter(pop => 
        !filteringText || pop.name.toLowerCase().includes(filteringText.toLowerCase())
      );
      
      // Add to cache and create options with labels as values
      filtered.forEach(pop => addToCache(pop.id, pop.name));
      const options = filtered.map(pop => ({
        propertyKey: 'population',
        value: pop.name,
        label: pop.name,
      }));

      setPropertyFilterOptions(options);
    } catch (error) {
      console.error('Error loading population options:', error);
      setPropertyFilterOptions([]);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // Initialize PropertyFilter from URL parameters
  useEffect(() => {
    const initializeFiltersFromUrl = async () => {
      const popIds = searchParams.getAll('populationIds');
      if (popIds.length === 0) return;

      const popLabels: string[] = [];
      for (const id of popIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          try {
            const populations = await PopulationService.getPopulations();
            const population = populations.find(p => p.id === id);
            if (population) {
              label = population.name;
              addToCache(population.id, population.name);
            }
          } catch (error) {
            console.error('Error fetching population:', error);
          }
        }
        if (label) {
          popLabels.push(label);
        }
      }

      if (popLabels.length > 0) {
        setPropertyFilterQuery({
          tokens: [{
            propertyKey: 'population',
            operator: '=',
            value: popLabels.join(', '),
          }],
          operation: 'and',
        });
      }
    };

    if (propertyFilterQuery.tokens.length === 0) {
      initializeFiltersFromUrl();
    }
  }, []);

  // Fetch populations for cache warming
  const { data: allPopulations = [] } = useQuery({
    queryKey: ['populations'],
    queryFn: PopulationService.getPopulations,
  });

  // Warm cache when populations load
  useEffect(() => {
    if (allPopulations.length > 0) {
      allPopulations.forEach(pop => addToCache(pop.id, pop.name));
    }
  }, [allPopulations]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    // Update mode
    params.set('mode', mapMode);
    
    // Update date range
    params.delete('startDate');
    params.delete('endDate');
    params.delete('relativePeriod');
    
    if (dateRange) {
      if (dateRange.type === 'relative' && dateRange.amount && dateRange.unit) {
        // Store as relative (e.g., "-90d", "-6m")
        const unitChar = dateRange.unit.charAt(0); // 'd', 'w', 'm', 'y'
        params.set('relativePeriod', `-${dateRange.amount}${unitChar}`);
      } else if (dateRange.type === 'absolute' && dateRange.startDate && dateRange.endDate) {
        // Store as absolute dates
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);
      }
    }
    
    // Update population filters (extract UUIDs from labels)
    params.delete('populationIds');
    const populationLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'population' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const populationIds = populationLabels
      .map(label => getUuidFromLabel(label))
      .filter(Boolean) as string[];
    
    if (populationIds.length > 0) {
      populationIds.forEach(id => params.append('populationIds', id));
    }
    
    setSearchParams(params, { replace: true });
  }, [mapMode, dateRange, propertyFilterQuery, searchParams, setSearchParams]);

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
              onLoadItems={handleLoadItems}
              filteringOptions={propertyFilterOptions}
              filteringStatusType={isLoadingOptions ? 'loading' : 'finished'}
              isLoading={false}
              disablePopulationFilter={mapMode === 'venues'}
            />

            {/* Map */}
            <div style={{ height: 'calc(100vh - 400px)', minHeight: '500px' }}>
              <MapView 
                mode={mapMode}
                populationIds={selectedPopulationIds}
                startDate={absoluteDates.startDate}
                endDate={absoluteDates.endDate}
                onLoadingStateChange={setMapLoadingState}
                externalIsCancelled={mapLoadingState.isCancelled}
              />
            </div>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
