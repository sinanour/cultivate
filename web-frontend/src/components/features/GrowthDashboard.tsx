import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import PropertyFilter from '@cloudscape-design/components/property-filter';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import Popover from '@cloudscape-design/components/popover';
import Icon from '@cloudscape-design/components/icon';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AnalyticsService, type GrowthMetricsParams } from '../../services/api/analytics.service';
import { PopulationService } from '../../services/api/population.service';
import { activityCategoryService } from '../../services/api/activity-category.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VenueService } from '../../services/api/venue.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { useDebouncedLoading } from '../../hooks/useDebouncedLoading';
import { InteractiveLegend, useInteractiveLegend, type LegendItem } from '../common/InteractiveLegend';
import type { TimePeriod } from '../../utils/constants';
import { isValidUUID, setMultiValueParam, getValidatedUUIDs } from '../../utils/url-params.utils';

// Helper function to convert YYYY-MM-DD to ISO datetime string
function toISODateTime(dateString: string, isEndOfDay = false): string {
  const date = new Date(dateString);
  if (isEndOfDay) {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }
  return date.toISOString();
}

// Consistent color palette for activity types/categories
const COLOR_PALETTE = [
  '#0088FE', // Blue
  '#00C49F', // Green
  '#FFBB28', // Yellow
  '#FF8042', // Orange
  '#8884D8', // Purple
  '#82CA9D', // Light Green
  '#FFC658', // Light Orange
  '#8DD1E1', // Light Blue
  '#D084D0', // Pink
  '#A4DE6C', // Lime
];

// Get consistent color for a group name
function getColorForGroup(groupName: string, allGroups: string[]): string {
  const index = allGroups.indexOf(groupName);
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}

type ViewMode = 'all' | 'type' | 'category';

export function GrowthDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();

  // Initialize state from URL parameters
  const [period, setPeriod] = useState<TimePeriod>(() => {
    const urlPeriod = searchParams.get('period');
    return (urlPeriod as TimePeriod) || 'MONTH';
  });

  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    // First check URL parameter (new name)
    const urlGroupBy = searchParams.get('growthGroupBy');
    if (urlGroupBy === 'all' || urlGroupBy === 'type' || urlGroupBy === 'category') {
      return urlGroupBy;
    }
    
    // Backward compatibility: check old param name
    const oldGroupBy = searchParams.get('groupBy');
    if (oldGroupBy === 'all' || oldGroupBy === 'type' || oldGroupBy === 'category') {
      return oldGroupBy;
    }
    
    // Then check localStorage
    const stored = localStorage.getItem('growthChartViewMode');
    if (stored === 'all' || stored === 'type' || stored === 'category') {
      return stored;
    }
    
    // Default to 'all'
    return 'all';
  });

  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(() => {
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
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
    if (startDate && endDate) {
      return {
        type: 'absolute',
        startDate,
        endDate,
      };
    }

    return null;
  });

  // PropertyFilter configuration with bidirectional label-UUID cache
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });
  const [propertyFilterOptions, setPropertyFilterOptions] = useState<PropertyFilterProps.FilteringOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  
  // Bidirectional cache: label ↔ UUID
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

  // Consolidate tokens: merge multiple tokens for the same property into a single token with comma-separated values
  // Also de-duplicates values to prevent the same value from appearing multiple times
  const consolidateTokens = (query: PropertyFilterProps.Query): PropertyFilterProps.Query => {
    const tokensByProperty = new Map<string, PropertyFilterProps.Token[]>();
    
    // Group tokens by property key
    query.tokens.forEach(token => {
      const key = token.propertyKey || '';
      if (!tokensByProperty.has(key)) {
        tokensByProperty.set(key, []);
      }
      tokensByProperty.get(key)!.push(token);
    });
    
    // Consolidate tokens for each property
    const consolidatedTokens: PropertyFilterProps.Token[] = [];
    tokensByProperty.forEach((tokens, propertyKey) => {
      if (tokens.length === 0) return;
      
      // Get all values for this property (only = operator)
      const allValues = tokens
        .filter(t => t.operator === '=')
        .flatMap(t => extractValuesFromToken(t)); // Split comma-separated values
      
      // De-duplicate values (case-sensitive comparison)
      const uniqueValues = Array.from(new Set(allValues));
      
      if (uniqueValues.length > 0) {
        // Create a single token with comma-separated unique values
        consolidatedTokens.push({
          propertyKey,
          operator: '=',
          value: uniqueValues.join(', '),
        });
      }
    });
    
    return {
      ...query,
      tokens: consolidatedTokens,
    };
  };

  // Extract individual values from consolidated tokens (split comma-separated values)
  const extractValuesFromToken = (token: PropertyFilterProps.Token): string[] => {
    if (!token.value) return [];
    // Split by comma and trim whitespace
    return token.value.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0);
  };

  const filteringProperties: PropertyFilterProps.FilteringProperty[] = [
    {
      key: 'activityCategory',
      propertyLabel: 'Activity Category',
      groupValuesLabel: 'Activity Category values',
      operators: ['='],
    },
    {
      key: 'activityType',
      propertyLabel: 'Activity Type',
      groupValuesLabel: 'Activity Type values',
      operators: ['='],
    },
    {
      key: 'venue',
      propertyLabel: 'Venue',
      groupValuesLabel: 'Venue values',
      operators: ['='],
    },
    {
      key: 'population',
      propertyLabel: 'Population',
      groupValuesLabel: 'Population values',
      operators: ['='],
    },
  ];

  // Async loading of property values with cache population
  const handleLoadItems = async ({ detail }: { detail: PropertyFilterProps.LoadItemsDetail }) => {
    const { filteringProperty, filteringText } = detail;
    
    if (!filteringProperty) return;

    setIsLoadingOptions(true);

    try {
      let options: PropertyFilterProps.FilteringOption[] = [];

      if (filteringProperty.key === 'activityCategory') {
        const categories = await activityCategoryService.getActivityCategories();
        const filtered = categories.filter(cat => 
          !filteringText || cat.name.toLowerCase().includes(filteringText.toLowerCase())
        );
        
        // Add to cache and create options with labels as values
        filtered.forEach(cat => addToCache(cat.id, cat.name));
        options = filtered.map(cat => ({
          propertyKey: 'activityCategory',
          value: cat.name, // Use label as value for display
          label: cat.name,
        }));
      } else if (filteringProperty.key === 'activityType') {
        const types = await ActivityTypeService.getActivityTypes();
        const filtered = types.filter(type => 
          !filteringText || type.name.toLowerCase().includes(filteringText.toLowerCase())
        );
        
        // Add to cache and create options with labels as values
        filtered.forEach(type => addToCache(type.id, type.name));
        options = filtered.map(type => ({
          propertyKey: 'activityType',
          value: type.name, // Use label as value for display
          label: type.name,
        }));
      } else if (filteringProperty.key === 'venue') {
        const venuesResponse = await VenueService.getVenues(undefined, undefined, selectedGeographicAreaId, filteringText || undefined);
        
        // Add to cache and create options with labels as values
        venuesResponse.data.forEach(venue => addToCache(venue.id, venue.name));
        options = venuesResponse.data.map(venue => ({
          propertyKey: 'venue',
          value: venue.name, // Use label as value for display
          label: venue.name,
        }));
      } else if (filteringProperty.key === 'population') {
        const populations = await PopulationService.getPopulations();
        const filtered = populations.filter(pop => 
          !filteringText || pop.name.toLowerCase().includes(filteringText.toLowerCase())
        );
        
        // Add to cache and create options with labels as values
        filtered.forEach(pop => addToCache(pop.id, pop.name));
        options = filtered.map(pop => ({
          propertyKey: 'population',
          value: pop.name, // Use label as value for display
          label: pop.name,
        }));
      }

      setPropertyFilterOptions(options);
    } catch (error) {
      console.error('Error loading property filter options:', error);
      setPropertyFilterOptions([]);
    } finally {
      setIsLoadingOptions(false);
    }
  };

  // Initialize PropertyFilter from URL parameters (convert UUIDs to labels)
  useEffect(() => {
    const initializeFiltersFromUrl = async () => {
      const tokensByProperty = new Map<string, string[]>();
      
      // Activity Categories - use correct param name with validation
      const catIds = getValidatedUUIDs(searchParams, 'activityCategoryIds');
      const catLabels: string[] = [];
      for (const id of catIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          // Cache miss - fetch the category to get its label
          try {
            const categories = await activityCategoryService.getActivityCategories();
            const category = categories.find(c => c.id === id);
            if (category) {
              label = category.name;
              addToCache(category.id, category.name);
            } else {
              console.warn(`Invalid activity category ID in URL: ${id}`);
              continue;
            }
          } catch (error) {
            console.error('Error fetching activity category:', error);
            continue;
          }
        }
        if (label) {
          catLabels.push(label);
        }
      }
      if (catLabels.length > 0) {
        tokensByProperty.set('activityCategory', catLabels);
      }
      
      // Activity Types - use correct param name with validation
      const typeIds = getValidatedUUIDs(searchParams, 'activityTypeIds');
      const typeLabels: string[] = [];
      for (const id of typeIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          // Cache miss - fetch the type to get its label
          try {
            const types = await ActivityTypeService.getActivityTypes();
            const type = types.find(t => t.id === id);
            if (type) {
              label = type.name;
              addToCache(type.id, type.name);
            } else {
              console.warn(`Invalid activity type ID in URL: ${id}`);
              continue;
            }
          } catch (error) {
            console.error('Error fetching activity type:', error);
            continue;
          }
        }
        if (label) {
          typeLabels.push(label);
        }
      }
      if (typeLabels.length > 0) {
        tokensByProperty.set('activityType', typeLabels);
      }
      
      // Venues - use correct param name with validation
      const venueIds = getValidatedUUIDs(searchParams, 'venueIds');
      const venueLabels: string[] = [];
      for (const id of venueIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          // Cache miss - fetch the venue to get its label
          try {
            const venuesResponse = await VenueService.getVenues();
            const venue = venuesResponse.data.find(v => v.id === id);
            if (venue) {
              label = venue.name;
              addToCache(venue.id, venue.name);
            } else {
              console.warn(`Invalid venue ID in URL: ${id}`);
              continue;
            }
          } catch (error) {
            console.error('Error fetching venue:', error);
            continue;
          }
        }
        if (label) {
          venueLabels.push(label);
        }
      }
      if (venueLabels.length > 0) {
        tokensByProperty.set('venue', venueLabels);
      }
      
      // Populations - use correct param name with validation
      const popIds = getValidatedUUIDs(searchParams, 'populationIds');
      const popLabels: string[] = [];
      for (const id of popIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          // Cache miss - fetch the population to get its label
          try {
            const populations = await PopulationService.getPopulations();
            const population = populations.find(p => p.id === id);
            if (population) {
              label = population.name;
              addToCache(population.id, population.name);
            } else {
              console.warn(`Invalid population ID in URL: ${id}`);
              continue;
            }
          } catch (error) {
            console.error('Error fetching population:', error);
            continue;
          }
        }
        if (label) {
          popLabels.push(label);
        }
      }
      if (popLabels.length > 0) {
        tokensByProperty.set('population', popLabels);
      }
      
      // Create consolidated tokens (one token per property with comma-separated values)
      const tokens: PropertyFilterProps.Token[] = [];
      tokensByProperty.forEach((labels, propertyKey) => {
        if (labels.length > 0) {
          tokens.push({
            propertyKey,
            operator: '=',
            value: labels.join(', '), // Comma-separated values in single token
          });
        }
      });

      if (tokens.length > 0) {
        setPropertyFilterQuery({ tokens, operation: 'and' });
      }
    };
    
    // Only initialize once on mount
    if (propertyFilterQuery.tokens.length === 0) {
      initializeFiltersFromUrl();
    }
  }, []); // Empty dependency array - run once on mount

  // Sync state to URL whenever filters change
  useEffect(() => {
    // Start with empty params - write only what this dashboard owns
    const params = new URLSearchParams();

    // CRITICAL: Add global geographic area filter if active
    // Read from context (not URL) to ensure it's always included
    if (selectedGeographicAreaId) {
      params.set('geographicArea', selectedGeographicAreaId);
    }

    // Dashboard-specific params
    params.set('period', period);
    params.set('growthGroupBy', viewMode);

    // Shared date range
    if (dateRange) {
      if (dateRange.type === 'absolute') {
        params.set('startDate', dateRange.startDate);
        params.set('endDate', dateRange.endDate);
      } else if (dateRange.type === 'relative') {
        // Convert relative date range to compact format (e.g., "-90d", "-6m")
        const unitChar = dateRange.unit.charAt(0); // 'd', 'w', 'm', 'y'
        params.set('relativePeriod', `-${dateRange.amount}${unitChar}`);
      }
    }

    // Shared PropertyFilter tokens (extract UUIDs inline to avoid stale closures)
    // Tokens now contain comma-separated values, so we need to split them
    const activityCategoryIds = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t))
      .map(label => getUuidFromLabel(label))
      .filter((uuid): uuid is string => !!uuid && isValidUUID(uuid));
    setMultiValueParam(params, 'activityCategoryIds', activityCategoryIds);

    const activityTypeIds = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t))
      .map(label => getUuidFromLabel(label))
      .filter((uuid): uuid is string => !!uuid && isValidUUID(uuid));
    setMultiValueParam(params, 'activityTypeIds', activityTypeIds);

    const venueIds = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'venue' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t))
      .map(label => getUuidFromLabel(label))
      .filter((uuid): uuid is string => !!uuid && isValidUUID(uuid));
    setMultiValueParam(params, 'venueIds', venueIds);

    const populationIds = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'population' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t))
      .map(label => getUuidFromLabel(label))
      .filter((uuid): uuid is string => !!uuid && isValidUUID(uuid));
    setMultiValueParam(params, 'populationIds', populationIds);

    setSearchParams(params, { replace: true });
  }, [period, viewMode, dateRange, propertyFilterQuery, selectedGeographicAreaId]);
  // Note: selectedGeographicAreaId IS in dependencies - we want to update URL when it changes
  // This is safe because we're reading from context, not from URL (no circular dependency)

  // Store view mode in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('growthChartViewMode', viewMode);
    } catch (error) {
      console.error('Failed to save view mode to localStorage:', error);
    }
  }, [viewMode]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['growthMetrics', dateRange, period, selectedGeographicAreaId, propertyFilterQuery, viewMode],
    queryFn: () => {
      // Convert date range to ISO datetime format for API
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (dateRange) {
        if (dateRange.type === 'absolute') {
          startDate = toISODateTime(dateRange.startDate, false);
          endDate = toISODateTime(dateRange.endDate, true);
        } else if (dateRange.type === 'relative') {
          // Calculate relative date range
          const now = new Date();
          const start = new Date(now);
          
          // Calculate start date based on relative amount and unit
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
          
          startDate = start.toISOString();
          endDate = now.toISOString();
        }
      }
      
      // Extract filters from PropertyFilter tokens (convert labels to UUIDs)
      // Tokens now contain comma-separated values, so we need to split them
      const activityCategoryLabels = propertyFilterQuery.tokens
        .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const activityCategoryIds = activityCategoryLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const activityTypeLabels = propertyFilterQuery.tokens
        .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const activityTypeIds = activityTypeLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const venueLabels = propertyFilterQuery.tokens
        .filter(t => t.propertyKey === 'venue' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const venueIds = venueLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const populationLabels = propertyFilterQuery.tokens
        .filter(t => t.propertyKey === 'population' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const populationIds = populationLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const params: GrowthMetricsParams = {
        startDate,
        endDate,
        period,
        activityCategoryIds: activityCategoryIds.length > 0 ? activityCategoryIds : undefined,
        activityTypeIds: activityTypeIds.length > 0 ? activityTypeIds : undefined,
        geographicAreaIds: selectedGeographicAreaId ? [selectedGeographicAreaId] : undefined,
        venueIds: venueIds.length > 0 ? venueIds : undefined,
        populationIds: populationIds.length > 0 ? populationIds : undefined,
        groupBy: viewMode === 'all' ? undefined : viewMode,
      };
      
      return AnalyticsService.getGrowthMetrics(params);
    },
    placeholderData: (previousData) => previousData, // Prevent flicker by keeping stale data visible while fetching
  });

  // Debounce loading state to prevent flicker from quick requests (500ms delay)
  const debouncedLoading = useDebouncedLoading(isLoading, 500);

  // Prepare data for grouped view (before hooks)
  const groupNames = metrics?.groupedTimeSeries ? Object.keys(metrics.groupedTimeSeries).sort() : [];
  const groupColors = groupNames.reduce((acc, name) => {
    acc[name] = getColorForGroup(name, groupNames);
    return acc;
  }, {} as Record<string, string>);

  // Prepare legend items for interactive legends (before hooks)
  const participantLegendItems: LegendItem[] = viewMode === 'all' 
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `uniqueParticipants_${name}`,
      }));

  const activityLegendItems: LegendItem[] = viewMode === 'all'
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `uniqueActivities_${name}`,
      }));

  const participationLegendItems: LegendItem[] = viewMode === 'all'
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `totalParticipation_${name}`,
      }));

  // Use interactive legend hooks (MUST be called before any conditional returns)
  const participantLegend = useInteractiveLegend('growth-participants', participantLegendItems);
  const activityLegend = useInteractiveLegend('growth-activities', activityLegendItems);
  const participationLegend = useInteractiveLegend('growth-participation', participationLegendItems);

  if (isLoading) {
    return <LoadingSpinner text="Loading growth metrics..." />;
  }

  // Check if we have data - either in timeSeries (all mode) or groupedTimeSeries (type/category mode)
  const hasData = metrics && (
    viewMode === 'all' 
      ? (metrics.timeSeries && metrics.timeSeries.length > 0)
      : (metrics.groupedTimeSeries && Object.keys(metrics.groupedTimeSeries).length > 0)
  );

  const timeSeriesData = metrics?.timeSeries || [];

  // Calculate absolute deltas from start to end of period
  // For grouped mode, calculate total across all groups
  let activityGrowth = 0;
  let participantGrowth = 0;
  let participationGrowth = 0;

  if (hasData) {
    if (viewMode === 'all' && timeSeriesData.length >= 2) {
      activityGrowth = timeSeriesData[timeSeriesData.length - 1].uniqueActivities - timeSeriesData[0].uniqueActivities;
      participantGrowth = timeSeriesData[timeSeriesData.length - 1].uniqueParticipants - timeSeriesData[0].uniqueParticipants;
      participationGrowth = timeSeriesData[timeSeriesData.length - 1].totalParticipation - timeSeriesData[0].totalParticipation;
    } else if (viewMode !== 'all' && metrics?.groupedTimeSeries) {
      // Sum up growth across all groups
      Object.values(metrics.groupedTimeSeries).forEach(groupData => {
        if (groupData.length >= 2) {
          activityGrowth += groupData[groupData.length - 1].uniqueActivities - groupData[0].uniqueActivities;
          participantGrowth += groupData[groupData.length - 1].uniqueParticipants - groupData[0].uniqueParticipants;
          participationGrowth += groupData[groupData.length - 1].totalParticipation - groupData[0].totalParticipation;
        }
      });
    }
  }

  // Merge grouped time series data into a single dataset for charts
  const mergedTimeSeriesData = viewMode === 'all' ? timeSeriesData : (() => {
    if (!metrics?.groupedTimeSeries) return timeSeriesData;

    // Get all unique dates across all groups
    const allDates = new Set<string>();
    Object.values(metrics.groupedTimeSeries).forEach(series => {
      series.forEach(item => allDates.add(item.date));
    });

    // Create merged data structure
    return Array.from(allDates).sort().map(date => {
      const dataPoint: any = { date };
      
      // Add data for each group
      groupNames.forEach(groupName => {
        const groupData = metrics.groupedTimeSeries![groupName];
        const item = groupData.find(d => d.date === date);
        dataPoint[`uniqueParticipants_${groupName}`] = item?.uniqueParticipants || 0;
        dataPoint[`uniqueActivities_${groupName}`] = item?.uniqueActivities || 0;
        dataPoint[`totalParticipation_${groupName}`] = item?.totalParticipation || 0;
      });

      return dataPoint;
    });
  })();

  return (
    <SpaceBetween size="l">
      <Container
        header={
          <Header variant="h3">Filters and Grouping</Header>
        }
      >
        <SpaceBetween size="m">
          <DateRangePicker
            value={dateRange}
            onChange={({ detail }) => {
              setDateRange(detail.value || null);
            }}
            placeholder="All history"
            dateOnly={true}
            relativeOptions={[
              { key: 'previous-30-days', amount: 30, unit: 'day', type: 'relative' },
                  { key: 'previous-90-days', amount: 90, unit: 'day', type: 'relative' },
                  { key: 'previous-6-months', amount: 6, unit: 'month', type: 'relative' },
                  { key: 'previous-1-year', amount: 1, unit: 'year', type: 'relative' },
                ]}
                isValidRange={() => ({ valid: true })}
                i18nStrings={{
                  todayAriaLabel: 'Today',
                  nextMonthAriaLabel: 'Next month',
                  previousMonthAriaLabel: 'Previous month',
                  customRelativeRangeDurationLabel: 'Duration',
                  customRelativeRangeDurationPlaceholder: 'Enter duration',
                  customRelativeRangeOptionLabel: 'Custom range',
                  customRelativeRangeOptionDescription: 'Set a custom range in the past',
                  customRelativeRangeUnitLabel: 'Unit of time',
                  formatRelativeRange: (value) => {
                    const unit = value.amount === 1 
                      ? value.unit 
                      : value.unit === 'day' ? 'days' 
                      : value.unit === 'week' ? 'weeks' 
                      : value.unit === 'month' ? 'months' 
                      : 'years';
                    return `Last ${value.amount} ${unit}`;
                  },
                  formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
                  dateTimeConstraintText: 'Select a date range for growth analysis.',
                  relativeModeTitle: 'Relative range',
                  absoluteModeTitle: 'Absolute range',
                  relativeRangeSelectionHeading: 'Choose a range',
                  startDateLabel: 'Start date',
                  endDateLabel: 'End date',
                  clearButtonLabel: 'Clear and dismiss',
                  cancelButtonLabel: 'Cancel',
                  applyButtonLabel: 'Apply',
                }}
              />

          {/* PropertyFilter for Activity Category, Activity Type, Venue, and Population */}
          <PropertyFilter
            query={propertyFilterQuery}
            onChange={({ detail }) => {
              // Consolidate tokens to ensure one token per property with comma-separated values
              const consolidated = consolidateTokens(detail);
              setPropertyFilterQuery(consolidated);
            }}
            filteringProperties={filteringProperties}
            filteringOptions={propertyFilterOptions}
            filteringLoadingText="Loading options..."
            filteringStatusType={isLoadingOptions ? 'loading' : 'finished'}
            onLoadItems={handleLoadItems}
            hideOperations={true}
            i18nStrings={{
              filteringAriaLabel: 'Filter growth data',
              dismissAriaLabel: 'Dismiss',
              filteringPlaceholder: 'Filter by activity category, type, venue, or population',
              groupValuesText: 'Values',
              groupPropertiesText: 'Properties',
              operatorsText: 'Operators',
              operationAndText: 'and',
              operationOrText: 'or',
              operatorLessText: 'Less than',
              operatorLessOrEqualText: 'Less than or equal',
              operatorGreaterText: 'Greater than',
              operatorGreaterOrEqualText: 'Greater than or equal',
              operatorContainsText: 'Contains',
              operatorDoesNotContainText: 'Does not contain',
              operatorEqualsText: 'Equals',
              operatorDoesNotEqualText: 'Does not equal',
              editTokenHeader: 'Edit filter',
              propertyText: 'Property',
              operatorText: 'Operator',
              valueText: 'Value',
              cancelActionText: 'Cancel',
              applyActionText: 'Apply',
              allPropertiesLabel: 'All properties',
              tokenLimitShowMore: 'Show more',
              tokenLimitShowFewer: 'Show fewer',
              clearFiltersText: 'Clear filters',
              removeTokenButtonAriaLabel: (token) => `Remove token ${token.propertyKey} ${token.operator} ${token.value}`,
              enteredTextLabel: (text) => `Use: "${text}"`,
            }}
            filteringEmpty="No matching options"
            filteringFinishedText="End of results"
          />

          <div>
            <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Group By</Box>
            <SpaceBetween size="s" direction="horizontal">
              <SegmentedControl
                selectedId={viewMode}
                onChange={({ detail }) => setViewMode(detail.selectedId as ViewMode)}
                label="Activity grouping mode"
                options={[
                  { id: 'all', text: 'All' },
                  { id: 'category', text: 'Activity Category' },
                  { id: 'type', text: 'Activity Type' },
                ]}
              />
              <SegmentedControl
                selectedId={period}
                onChange={({ detail }) => setPeriod(detail.selectedId as TimePeriod)}
                label="Time period aggregation"
                options={[
                  { id: 'DAY', text: 'Daily' },
                  { id: 'WEEK', text: 'Weekly' },
                  { id: 'MONTH', text: 'Monthly' },
                  { id: 'YEAR', text: 'Yearly' },
                ]}
              />
            </SpaceBetween>
          </div>
        </SpaceBetween>
      </Container>

      {/* Only display growth numbers in "All" view mode and when data is available */}
      {viewMode === 'all' && hasData && (
        <ColumnLayout columns={3} variant="text-grid">
          <Container>
            <Box variant="awsui-key-label">Activity Growth</Box>
            <Box fontSize="display-l" fontWeight="bold" color={activityGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
              {activityGrowth >= 0 ? '+' : ''}{activityGrowth}
            </Box>
          </Container>
          <Container>
            <SpaceBetween size="xs" direction="horizontal">
              <Box variant="awsui-key-label">Participant Growth</Box>
              <Popover
                dismissButton={false}
                position="top"
                size="small"
                triggerType="custom"
                content={
                  <Box variant="p">
                    <strong>Unique Participants:</strong> The count of distinct individuals involved in activities. 
                    The same person involved in multiple activities is counted only once.
                  </Box>
                }
              >
                <Icon name="status-info" variant="link" />
              </Popover>
            </SpaceBetween>
            <Box fontSize="display-l" fontWeight="bold" color={participantGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
              {participantGrowth >= 0 ? '+' : ''}{participantGrowth}
            </Box>
          </Container>
          <Container>
            <SpaceBetween size="xs" direction="horizontal">
              <Box variant="awsui-key-label">Participation Growth</Box>
              <Popover
                dismissButton={false}
                position="top"
                size="small"
                triggerType="custom"
                content={
                  <Box variant="p">
                    <strong>Total Participation:</strong> The sum of all participant-activity associations. 
                    The same person involved in 3 activities contributes 3 to this count.
                  </Box>
                }
              >
                <Icon name="status-info" variant="link" />
              </Popover>
            </SpaceBetween>
            <Box fontSize="display-l" fontWeight="bold" color={participationGrowth >= 0 ? 'text-status-success' : 'text-status-error'}>
              {participationGrowth >= 0 ? '+' : ''}{participationGrowth}
            </Box>
          </Container>
        </ColumnLayout>
      )}

      {/* Display charts or empty state */}
      {!hasData ? (
        <Container>
          <Box textAlign="center" padding="xxl">
            <b>No data available for the selected filters</b>
            <Box variant="p" color="text-body-secondary" margin={{ top: 'xs' }}>
              Try adjusting your filters or date range to see growth metrics.
            </Box>
          </Box>
        </Container>
      ) : null}
      
      {/* Always render charts to prevent unmounting - show loading state inline */}
      {debouncedLoading && (
        <Box textAlign="center" padding="s">
          <LoadingSpinner text="Updating growth metrics..." />
        </Box>
      )}
      
      <Container header={<Header variant="h3">Unique Activities Over Time</Header>}>
        {viewMode !== 'all' && activityLegendItems.length > 0 && (
          <InteractiveLegend
            chartId="growth-activities"
            series={activityLegendItems}
            onVisibilityChange={activityLegend.handleVisibilityChange}
          />
        )}
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergedTimeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis 
                label={{ value: 'Unique Activities', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              {viewMode === 'all' ? (
                <Line
                  type="monotone"
                  dataKey="uniqueActivities"
                  stroke="#00C49F"
                  strokeWidth={2}
                  name="Unique Activities"
                />
              ) : (
                groupNames
                  .filter((groupName) => activityLegend.isSeriesVisible(groupName))
                  .map((groupName) => (
                    <Line
                      key={groupName}
                      type="monotone"
                      dataKey={`uniqueActivities_${groupName}`}
                      stroke={groupColors[groupName]}
                      strokeWidth={2}
                      name={groupName}
                    />
                  ))
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box textAlign="center" padding="l">
            <b>No data available</b>
          </Box>
        )}
      </Container>

      <Container header={<Header variant="h3">Unique Participants Over Time</Header>}>
        {viewMode !== 'all' && participantLegendItems.length > 0 && (
          <InteractiveLegend
            chartId="growth-participants"
            series={participantLegendItems}
            onVisibilityChange={participantLegend.handleVisibilityChange}
          />
        )}
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergedTimeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis 
                label={{ value: 'Unique Participants', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              {viewMode === 'all' ? (
                <Line
                  type="monotone"
                  dataKey="uniqueParticipants"
                  stroke="#0088FE"
                  strokeWidth={2}
                  name="Unique Participants"
                />
              ) : (
                groupNames
                  .filter((groupName) => participantLegend.isSeriesVisible(groupName))
                  .map((groupName) => (
                    <Line
                      key={groupName}
                      type="monotone"
                      dataKey={`uniqueParticipants_${groupName}`}
                      stroke={groupColors[groupName]}
                      strokeWidth={2}
                      name={groupName}
                    />
                  ))
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box textAlign="center" padding="l">
            <b>No data available</b>
          </Box>
        )}
      </Container>

      <Container header={<Header variant="h3">Total Participation Over Time</Header>}>
        {viewMode !== 'all' && participationLegendItems.length > 0 && (
          <InteractiveLegend
            chartId="growth-participation"
            series={participationLegendItems}
            onVisibilityChange={participationLegend.handleVisibilityChange}
          />
        )}
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergedTimeSeriesData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis 
                label={{ value: 'Total Participation', angle: -90, position: 'insideLeft' }}
              />
              <Tooltip />
              {viewMode === 'all' ? (
                <Line
                  type="monotone"
                  dataKey="totalParticipation"
                  stroke="#FFBB28"
                  strokeWidth={2}
                  name="Total Participation"
                />
              ) : (
                groupNames
                  .filter((groupName) => participationLegend.isSeriesVisible(groupName))
                  .map((groupName) => (
                    <Line
                      key={groupName}
                      type="monotone"
                      dataKey={`totalParticipation_${groupName}`}
                      stroke={groupColors[groupName]}
                      strokeWidth={2}
                      name={groupName}
                    />
                  ))
              )}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <Box textAlign="center" padding="l">
            <b>No data available</b>
          </Box>
        )}
      </Container>
    </SpaceBetween>
  );
}
