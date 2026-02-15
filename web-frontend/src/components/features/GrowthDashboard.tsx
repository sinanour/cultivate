import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import Popover from '@cloudscape-design/components/popover';
import Icon from '@cloudscape-design/components/icon';
import Spinner from '@cloudscape-design/components/spinner';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { AnalyticsService, type GrowthMetricsParams } from '../../services/api/analytics.service';
import { PopulationService } from '../../services/api/population.service';
import { activityCategoryService } from '../../services/api/activity-category.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VenueService } from '../../services/api/venue.service';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { useAuth } from '../../hooks/useAuth';
import { InteractiveLegend, useInteractiveLegend, type LegendItem } from '../common/InteractiveLegend';
import { 
  FilterGroupingPanel, 
  type FilterGroupingState, 
  type FilterProperty, 
  type GroupingDimension as FilterGroupingDimension 
} from '../common/FilterGroupingPanel';
import type { TimePeriod } from '../../utils/constants';
import { PullToRefreshWrapper } from '../common/PullToRefreshWrapper';
import { invalidatePageCaches, getDashboardQueryKeys } from '../../utils/cache-invalidation.utils';

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

interface GrowthDashboardProps {
  runReportTrigger?: number; // Increment this to trigger report execution
  onLoadingChange?: (isLoading: boolean) => void; // Callback to notify parent of loading state
}

export function GrowthDashboard({ runReportTrigger = 0, onLoadingChange }: GrowthDashboardProps = {}) {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const { user } = useAuth();

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

  const [dateRange, setDateRange] = useState<FilterGroupingState['dateRange']>(() => {
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

  // Run Report pattern: track whether report has been executed
  const [hasRunReport, setHasRunReport] = useState(false);

  // Ref to trigger FilterGroupingPanel's internal update
  const triggerFilterUpdate = useRef<(() => void) | null>(null);
  
  // Ref to capture current period value for handleFilterUpdate
  const periodRef = useRef(period);
  
  // Keep periodRef in sync with period state
  useEffect(() => {
    periodRef.current = period;
  }, [period]);

  // Track applied state (only updated when Run Report is clicked)
  const [appliedDateRange, setAppliedDateRange] = useState<FilterGroupingState['dateRange']>(null);
  const [appliedFilterQuery, setAppliedFilterQuery] = useState<PropertyFilterProps.Query>({ tokens: [], operation: 'and' });
  const [appliedViewMode, setAppliedViewMode] = useState<ViewMode>('all');
  const [appliedPeriod, setAppliedPeriod] = useState<TimePeriod>('MONTH');

  // PropertyFilter configuration with bidirectional label-UUID cache
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });
  
  // Bidirectional cache: label ↔ UUID
  const [labelToUuidCache, setLabelToUuidCache] = useState<Map<string, string>>(new Map());

  // Helper to add to cache
  const addToCache = (uuid: string, label: string) => {
    setLabelToUuidCache(prev => new Map(prev).set(label, uuid));
  };

  // Helper to get UUID from label
  const getUuidFromLabel = (label: string): string | undefined => {
    return labelToUuidCache.get(label);
  };

  // Extract individual values from consolidated tokens (split comma-separated values)
  const extractValuesFromToken = (token: PropertyFilterProps.Token): string[] => {
    if (!token.value) return [];
    // Split by comma and trim whitespace
    return token.value.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0);
  };

  // FilterGroupingPanel configuration with loadItems callbacks
  const filteringProperties: FilterProperty[] = useMemo(() => [
    {
      key: 'activityCategory',
      propertyLabel: 'Activity Category',
      groupValuesLabel: 'Activity Category values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const categories = await activityCategoryService.getActivityCategories();
        const filtered = categories.filter(cat => 
          !filterText || cat.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach(cat => addToCache(cat.id, cat.name));
        return filtered.map(cat => ({
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
        const types = await ActivityTypeService.getActivityTypes();
        const filtered = types.filter(type => 
          !filterText || type.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach(type => addToCache(type.id, type.name));
        return filtered.map(type => ({
          propertyKey: 'activityType',
          value: type.name,
          label: type.name,
        }));
      },
    },
    {
      key: 'venue',
      propertyLabel: 'Venue',
      groupValuesLabel: 'Venue values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const venuesResponse = await VenueService.getVenuesFlexible({
          page: 1,
          limit: 50,
          geographicAreaId: selectedGeographicAreaId,
          filter: filterText ? { name: filterText } : undefined
        });
        
        venuesResponse.data.forEach(venue => addToCache(venue.id, venue.name));
        return venuesResponse.data.map(venue => ({
          propertyKey: 'venue',
          value: venue.name,
          label: venue.name,
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
  ], [selectedGeographicAreaId]); // Depend on selectedGeographicAreaId for venue loading

  const groupingDimensionsConfig: FilterGroupingDimension[] = [
    { value: 'all', label: 'All' },
    { value: 'type', label: 'Activity Type' },
    { value: 'category', label: 'Activity Category' },
  ];

  // Handler for FilterGroupingPanel updates
  // This is called when Run Report button triggers it via the ref
  const handleFilterUpdate = useCallback((state: FilterGroupingState) => {
    // Always update pending state (for display in FilterGroupingPanel)
    setDateRange(state.dateRange);
    setPropertyFilterQuery(state.filterTokens);
    if (typeof state.grouping === 'string') {
      setViewMode(state.grouping as ViewMode);
    }
    
    // Update applied state (used in queryKey)
    setAppliedDateRange(state.dateRange);
    setAppliedFilterQuery(state.filterTokens);
    if (typeof state.grouping === 'string') {
      setAppliedViewMode(state.grouping as ViewMode);
    }
    // Use the current period value from ref (not from closure)
    setAppliedPeriod(periodRef.current);
  }, []); // No dependencies - stable callback

  // Store view mode in localStorage
  useEffect(() => {
    try {
      localStorage.setItem('growthChartViewMode', viewMode);
    } catch (error) {
      console.error('Failed to save view mode to localStorage:', error);
    }
  }, [viewMode]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['growthMetrics', appliedDateRange, appliedPeriod, selectedGeographicAreaId, appliedFilterQuery, appliedViewMode],
    queryFn: () => {
      // Convert date range to ISO datetime format for API
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (appliedDateRange) {
        if (appliedDateRange.type === 'absolute' && appliedDateRange.startDate && appliedDateRange.endDate) {
          startDate = toISODateTime(appliedDateRange.startDate, false);
          endDate = toISODateTime(appliedDateRange.endDate, true);
        } else if (appliedDateRange.type === 'relative' && appliedDateRange.amount && appliedDateRange.unit) {
          // Calculate absolute dates from relative range
          const now = new Date();
          const end = new Date(now);
          const start = new Date(now);
          
          switch (appliedDateRange.unit) {
            case 'day':
              start.setDate(start.getDate() - appliedDateRange.amount);
              break;
            case 'week':
              start.setDate(start.getDate() - (appliedDateRange.amount * 7));
              break;
            case 'month':
              start.setMonth(start.getMonth() - appliedDateRange.amount);
              break;
            case 'year':
              start.setFullYear(start.getFullYear() - appliedDateRange.amount);
              break;
          }
          
          startDate = start.toISOString();
          endDate = end.toISOString();
        }
      }
      
      // Extract filters from PropertyFilter tokens (convert labels to UUIDs)
      // Tokens now contain comma-separated values, so we need to split them
      const activityCategoryLabels = appliedFilterQuery.tokens
        .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const activityCategoryIds = activityCategoryLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const activityTypeLabels = appliedFilterQuery.tokens
        .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const activityTypeIds = activityTypeLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const venueLabels = appliedFilterQuery.tokens
        .filter(t => t.propertyKey === 'venue' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const venueIds = venueLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const populationLabels = appliedFilterQuery.tokens
        .filter(t => t.propertyKey === 'population' && t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      const populationIds = populationLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
      
      const params: GrowthMetricsParams = {
        startDate,
        endDate,
        period: appliedPeriod,
        activityCategoryIds: activityCategoryIds.length > 0 ? activityCategoryIds : undefined,
        activityTypeIds: activityTypeIds.length > 0 ? activityTypeIds : undefined,
        geographicAreaIds: selectedGeographicAreaId ? [selectedGeographicAreaId] : undefined,
        venueIds: venueIds.length > 0 ? venueIds : undefined,
        populationIds: populationIds.length > 0 ? populationIds : undefined,
        groupBy: appliedViewMode === 'all' ? undefined : appliedViewMode,
      };
      
      return AnalyticsService.getGrowthMetrics(params);
    },
    enabled: hasRunReport, // Only fetch when report has been run
    placeholderData: (previousData) => previousData, // Prevent flicker by keeping stale data visible while fetching
  });

  // Handler for Run Report button (triggered by parent via runReportTrigger prop)
  useEffect(() => {
    if (runReportTrigger > 0) {
      // Set hasRunReport to true FIRST
      setHasRunReport(true);
      // Then trigger FilterGroupingPanel to call handleFilterUpdate with its current state
      if (triggerFilterUpdate.current) {
        triggerFilterUpdate.current();
      }
    }
  }, [runReportTrigger]);

  // Notify parent of loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  // Update the renderWithLoadingState helper to use actual isLoading state
  const renderWithLoadingState = (content: React.ReactNode, emptyMessage: string = 'Click "Run Report" to view data') => {
    if (!hasRunReport) {
      return (
        <Box textAlign="center" padding="xxl" color="text-body-secondary">
          {emptyMessage}
        </Box>
      );
    }
    
    // When loading after first run, show content (don't replace with spinner)
    // The spinner will be shown in the header
    return content;
  };

  // Helper to render header with loading indicator
  const renderHeaderWithLoading = (title: string) => {
    return (
      <Header variant="h3">
        <SpaceBetween size="xs" direction="horizontal">
          <span>{title}</span>
          {hasRunReport && isLoading && (
            <Spinner size="normal" />
          )}
        </SpaceBetween>
      </Header>
    );
  };

  // Prepare data for grouped view (before hooks)
  const groupNames = metrics?.groupedTimeSeries ? Object.keys(metrics.groupedTimeSeries).sort() : [];
  const groupColors = groupNames.reduce((acc, name) => {
    acc[name] = getColorForGroup(name, groupNames);
    return acc;
  }, {} as Record<string, string>);

  // Prepare legend items for interactive legends (before hooks)
  const participantLegendItems: LegendItem[] = appliedViewMode === 'all' 
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `uniqueParticipants_${name}`,
      }));

  const activityLegendItems: LegendItem[] = appliedViewMode === 'all'
    ? []
    : groupNames.map((name) => ({
        name,
        color: groupColors[name],
        dataKey: `uniqueActivities_${name}`,
      }));

  const participationLegendItems: LegendItem[] = appliedViewMode === 'all'
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

  // No longer show full-page loading spinner - we'll show spinners in headers
  // if (isLoading) {
  //   return <LoadingSpinner text="Loading growth metrics..." />;
  // }

  // Check if we have data - either in timeSeries (all mode) or groupedTimeSeries (type/category mode)
  const hasData = metrics && (
    appliedViewMode === 'all' 
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
      Object.values(metrics.groupedTimeSeries).forEach((groupData: any) => {
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
    Object.values(metrics.groupedTimeSeries).forEach((series: any) => {
      series.forEach((item: any) => allDates.add(item.date));
    });

    // Create merged data structure
    return Array.from(allDates).sort().map(date => {
      const dataPoint: any = { date };
      
      // Add data for each group
      groupNames.forEach(groupName => {
        const groupData = metrics.groupedTimeSeries![groupName] as any;
        const item = groupData.find((d: any) => d.date === date);
        dataPoint[`uniqueParticipants_${groupName}`] = item?.uniqueParticipants || 0;
        dataPoint[`uniqueActivities_${groupName}`] = item?.uniqueActivities || 0;
        dataPoint[`totalParticipation_${groupName}`] = item?.totalParticipation || 0;
      });

      return dataPoint;
    });
  })();

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    // Invalidate caches
    await invalidatePageCaches(queryClient, {
      queryKeys: getDashboardQueryKeys('growth'),
      clearLocalStorage: false // Preserve filter selections
    });

    // Re-run the report with current filters
    if (triggerFilterUpdate.current) {
      triggerFilterUpdate.current();
    }
  }, [queryClient]);

  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
      <SpaceBetween size="l">
      {/* Filters Section */}
      <Container
        header={
          <Header variant="h3">Filters and Grouping</Header>
        }
      >
        <SpaceBetween size="m">
          {/* Time Period Selector */}
          <div>
            <Box variant="awsui-key-label" margin={{ bottom: 'xs' }}>Time Period</Box>
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
          </div>

          {/* FilterGroupingPanel */}
          <FilterGroupingPanel
            filterProperties={filteringProperties}
            groupingMode="exclusive"
            groupingDimensions={groupingDimensionsConfig}
            initialDateRange={dateRange}
            initialFilterTokens={propertyFilterQuery}
            initialGrouping={viewMode}
            onUpdate={handleFilterUpdate}
            onRegisterTrigger={(trigger) => { triggerFilterUpdate.current = trigger; }}
            isLoading={isLoading}
            hideUpdateButton={true}
              suppressVenueOptions={user?.role === 'PII_RESTRICTED'}
          />
        </SpaceBetween>
      </Container>

      {/* Only display growth numbers in "All" view mode */}
      {appliedViewMode === 'all' && hasRunReport && hasData && (
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

      {/* Unique Activities Over Time Chart */}
      <Container header={renderHeaderWithLoading('Unique Activities Over Time')}>
        {renderWithLoadingState(
          <>
            {appliedViewMode !== 'all' && activityLegendItems.length > 0 && (
              <InteractiveLegend
                chartId="growth-activities"
                series={activityLegendItems}
                onVisibilityChange={activityLegend.handleVisibilityChange}
              />
            )}
            {hasData ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mergedTimeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis 
                    label={{ value: 'Unique Activities', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
              {appliedViewMode === 'all' ? (
                    <Area
                  type="monotone"
                  dataKey="uniqueActivities"
                  stroke="#00C49F"
                      fill="#00C49F"
                  strokeWidth={2}
                  name="Unique Activities"
                      stackId={1}
                />
              ) : (
                groupNames
                  .filter((groupName) => activityLegend.isSeriesVisible(groupName))
                  .map((groupName) => (
                    <Area
                      key={groupName}
                      type="monotone"
                      dataKey={`uniqueActivities_${groupName}`}
                      stroke={groupColors[groupName]}
                      fill={groupColors[groupName]}
                      strokeWidth={2}
                      name={groupName}
                      stackId={1}
                    />
                  ))
              )}
                </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Box textAlign="center" padding="l">
            <b>No data available</b>
          </Box>
        )}
          </>,
          'Click "Run Report" to view activities over time'
        )}
      </Container>

      {/* Unique Participants Over Time Chart */}
      <Container header={renderHeaderWithLoading('Unique Participants Over Time')}>
        {renderWithLoadingState(
          <>
            {appliedViewMode !== 'all' && participantLegendItems.length > 0 && (
              <InteractiveLegend
                chartId="growth-participants"
                series={participantLegendItems}
                onVisibilityChange={participantLegend.handleVisibilityChange}
              />
            )}
            {hasData ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mergedTimeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis 
                    label={{ value: 'Unique Participants', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  {appliedViewMode === 'all' ? (
                    <Area
                      type="monotone"
                      dataKey="uniqueParticipants"
                      stroke="#0088FE"
                      fill="#0088FE"
                      strokeWidth={2}
                      name="Unique Participants"
                      stackId={1}
                    />
                  ) : (
                    groupNames
                      .filter((groupName) => participantLegend.isSeriesVisible(groupName))
                      .map((groupName) => (
                        <Area
                          key={groupName}
                          type="monotone"
                          dataKey={`uniqueParticipants_${groupName}`}
                          stroke={groupColors[groupName]}
                          fill={groupColors[groupName]}
                          strokeWidth={2}
                          name={groupName}
                          stackId={1}
                        />
                  ))
              )}
                </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Box textAlign="center" padding="l">
            <b>No data available</b>
          </Box>
        )}
          </>,
          'Click "Run Report" to view participants over time'
        )}
      </Container>

      {/* Total Participation Over Time Chart */}
      <Container header={renderHeaderWithLoading('Total Participation Over Time')}>
        {renderWithLoadingState(
          <>
            {appliedViewMode !== 'all' && participationLegendItems.length > 0 && (
              <InteractiveLegend
                chartId="growth-participation"
                series={participationLegendItems}
                onVisibilityChange={participationLegend.handleVisibilityChange}
              />
            )}
            {hasData ? (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={mergedTimeSeriesData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis 
                    label={{ value: 'Total Participation', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip />
                  {appliedViewMode === 'all' ? (
                    <Area
                      type="monotone"
                      dataKey="totalParticipation"
                      stroke="#FFBB28"
                      fill="#FFBB28"
                      strokeWidth={2}
                      name="Total Participation"
                      stackId={1}
                    />
                  ) : (
                    groupNames
                      .filter((groupName) => participationLegend.isSeriesVisible(groupName))
                      .map((groupName) => (
                        <Area
                          key={groupName}
                          type="monotone"
                          dataKey={`totalParticipation_${groupName}`}
                          stroke={groupColors[groupName]}
                          fill={groupColors[groupName]}
                          strokeWidth={2}
                          name={groupName}
                          stackId={1}
                        />
                      ))
              )}
                </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Box textAlign="center" padding="l">
            <b>No data available</b>
          </Box>
        )}
          </>,
          'Click "Run Report" to view participation over time'
        )}
      </Container>
    </SpaceBetween>
    </PullToRefreshWrapper>
  );
}
