import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Popover from '@cloudscape-design/components/popover';
import Icon from '@cloudscape-design/components/icon';
import Spinner from '@cloudscape-design/components/spinner';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Badge from '@cloudscape-design/components/badge';
import { AnalyticsService, type EngagementMetricsParams } from '../../services/api/analytics.service';
import { activityCategoryService } from '../../services/api/activity-category.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VenueService } from '../../services/api/venue.service';
import { PopulationService } from '../../services/api/population.service';
import { InteractiveLegend, useInteractiveLegend, type LegendItem } from '../common/InteractiveLegend';
import { ActivityLifecycleChart } from './ActivityLifecycleChart';
import { 
  FilterGroupingPanel, 
  type FilterGroupingState, 
  type FilterProperty, 
  type GroupingDimension as FilterGroupingDimension 
} from '../common/FilterGroupingPanel';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { GroupingDimension } from '../../utils/constants';
import { generateEngagementSummaryCSV, downloadBlob } from '../../utils/csv.utils';
import { generateEngagementSummaryFilename } from '../../utils/csv-filename.utils';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import type { AreaType } from '../../types';

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

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// Bar chart styling constants
const BAR_CHART_MAX_BAR_SIZE = 60;
const BAR_CHART_GAP = 0;
const BAR_CHART_CATEGORY_GAP = '20%';

// LocalStorage key for Activities chart view mode
const ACTIVITIES_CHART_VIEW_MODE_KEY = 'activitiesChartViewMode';

// View mode options
type ActivitiesViewMode = 'type' | 'category';

// Custom tick component for geographic breakdown chart Y-axis
// Renders area name with area type badge underneath using CloudScape Badge component
interface GeographicAreaTickProps {
  x?: number;
  y?: number;
  payload?: {
    value: string; // This will be the geographicAreaName
    index: number;
  };
  areaTypeMap: Map<string, string>; // Map from area name to area type
}

const GeographicAreaTick: React.FC<GeographicAreaTickProps> = ({ x = 0, y = 0, payload, areaTypeMap }) => {
  if (!payload) return null;
  
  const areaName = payload.value;
  const areaType = areaTypeMap.get(areaName);
  
  if (!areaType) {
    // Fallback to just rendering the name if no area type found
    return (
      <g transform={`translate(${x},${y})`}>
        <text x={0} y={0} dy={4} textAnchor="end" fill="#666" fontSize={12}>
          {areaName}
        </text>
      </g>
    );
  }
  
  const badgeColor = getAreaTypeBadgeColor(areaType as AreaType);
  
  return (
    <g transform={`translate(${x},${y})`}>
      {/* Area name on first line */}
      <text x={0} y={-12} dy={4} textAnchor="end" fill="#666" fontSize={12} fontWeight="500">
        {areaName}
      </text>
      {/* Area type badge on second line using foreignObject to embed CloudScape Badge */}
      <foreignObject x={-180} y={0} width={180} height={24}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <Badge color={badgeColor}>{areaType}</Badge>
        </div>
      </foreignObject>
    </g>
  );
};

interface EngagementDashboardProps {
  runReportTrigger?: number; // Increment this to trigger report execution
  onLoadingChange?: (isLoading: boolean) => void; // Callback to notify parent of loading state
}

export function EngagementDashboard({ runReportTrigger = 0, onLoadingChange }: EngagementDashboardProps = {}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Initialize state from URL parameters
  const initializeDateRange = (): FilterGroupingState['dateRange'] => {
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
  };

  const initializeGroupByDimensions = (): string[] => {
    // Check new param name first
    const groupByParam = searchParams.get('engagementGroupBy');
    
    // Backward compatibility: check old param name
    const oldGroupByParam = !groupByParam ? searchParams.get('groupBy') : null;
    
    const paramToUse = groupByParam || oldGroupByParam;
    
    if (!paramToUse) return [];
    
    const dimensions = paramToUse.split(',');
    const validDimensions = ['activityCategory', 'activityType', 'venue', 'geographicArea', 'population'];
    
    return dimensions.filter(dim => validDimensions.includes(dim));
  };

  const [dateRange, setDateRange] = useState<FilterGroupingState['dateRange']>(initializeDateRange);
  const [groupByDimensions, setGroupByDimensions] = useState<string[]>(initializeGroupByDimensions);
  
  // Run Report pattern: track whether report has been executed
  const [hasRunReport, setHasRunReport] = useState(false);
  
  // Ref to trigger FilterGroupingPanel's internal update
  const triggerFilterUpdate = useRef<(() => void) | null>(null);
  
  // Track applied state (only updated when Run Report is clicked via handleFilterUpdate)
  const [appliedDateRange, setAppliedDateRange] = useState<FilterGroupingState['dateRange']>(null);
  const [appliedFilterQuery, setAppliedFilterQuery] = useState<PropertyFilterProps.Query>({ tokens: [], operation: 'and' });
  const [appliedGroupByDimensions, setAppliedGroupByDimensions] = useState<string[]>([]);
  
  // Activities chart view mode state with localStorage persistence
  const [activitiesViewMode, setActivitiesViewMode] = useState<ActivitiesViewMode>(() => {
    try {
      const stored = localStorage.getItem(ACTIVITIES_CHART_VIEW_MODE_KEY);
      return (stored === 'category' || stored === 'type') ? stored : 'type';
    } catch {
      // If localStorage is unavailable, default to 'type'
      return 'type';
    }
  });
  
  const { selectedGeographicAreaId, selectedGeographicArea, setGeographicAreaFilter } = useGlobalGeographicFilter();
  const { user } = useAuth();
  const notification = useNotification();

  // PropertyFilter configuration with bidirectional label-UUID cache
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });
  const [isExportingEngagementSummary, setIsExportingEngagementSummary] = useState(false);
  
  // Bidirectional cache: label ↔ UUID
  const [labelToUuid, setLabelToUuid] = useState<Map<string, string>>(new Map());

  // Helper to add to cache
  const addToCache = (uuid: string, label: string) => {
    setLabelToUuid(prev => new Map(prev).set(label, uuid));
  };

  // Helper to get UUID from label
  const getUuidFromLabel = (label: string): string | undefined => {
    return labelToUuid.get(label);
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
    { value: 'activityCategory', label: 'Activity Category' },
    { value: 'activityType', label: 'Activity Type' },
    { value: 'venue', label: 'Venue' },
    { value: 'geographicArea', label: 'Geographic Area' },
  ];

  // Handler for FilterGroupingPanel updates
  // This is called when Run Report button triggers it via the ref
  const handleFilterUpdate = useCallback((state: FilterGroupingState) => {
    // Always update pending state (for display in FilterGroupingPanel)
    setDateRange(state.dateRange);
    setPropertyFilterQuery(state.filterTokens);
    if (Array.isArray(state.grouping)) {
      setGroupByDimensions(state.grouping);
    }
    
    // Update applied state (used in queryKey) - this will be called after hasRunReport is set to true
    setAppliedDateRange(state.dateRange);
    setAppliedFilterQuery(state.filterTokens);
    if (Array.isArray(state.grouping)) {
      setAppliedGroupByDimensions(state.grouping);
    }
  }, []);

  // Persist activities view mode to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVITIES_CHART_VIEW_MODE_KEY, activitiesViewMode);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [activitiesViewMode]);

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['engagementMetrics', appliedDateRange, selectedGeographicAreaId, appliedFilterQuery, appliedGroupByDimensions, runReportTrigger],
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
      // Support multiple values per property (OR logic within dimension)
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
      
      const params: EngagementMetricsParams = {
        startDate,
        endDate,
        geographicAreaIds: selectedGeographicAreaId ? [selectedGeographicAreaId] : undefined,
        activityCategoryIds: activityCategoryIds.length > 0 ? activityCategoryIds : undefined,
        activityTypeIds: activityTypeIds.length > 0 ? activityTypeIds : undefined,
        venueIds: venueIds.length > 0 ? venueIds : undefined,
        populationIds: populationIds.length > 0 ? populationIds : undefined,
        groupBy: appliedGroupByDimensions.map(d => d as GroupingDimension),
      };
      
      return AnalyticsService.getEngagementMetrics(params);
    },
    enabled: hasRunReport, // Only fetch when report has been run
    placeholderData: (previousData) => previousData, // Prevent flicker by keeping stale data visible while fetching
  });

  // Separate query for geographic breakdown
  const { data: geographicBreakdown } = useQuery({
    queryKey: ['geographicBreakdown', appliedDateRange, selectedGeographicAreaId, appliedFilterQuery, runReportTrigger],
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
      // Support multiple values per property (OR logic within dimension)
      // Tokens now contain comma-separated values, so we need to split them
      const activityCategoryLabels = propertyFilterQuery.tokens
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
      
      return AnalyticsService.getGeographicAnalytics(
        selectedGeographicAreaId || undefined, // parentGeographicAreaId
        startDate,
        endDate,
        activityCategoryIds.length > 0 ? activityCategoryIds : undefined,
        activityTypeIds.length > 0 ? activityTypeIds : undefined,
        venueIds.length > 0 ? venueIds : undefined,
        populationIds.length > 0 ? populationIds : undefined
      );
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
      // This ensures handleFilterUpdate will update the applied state
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
    // The spinner will be shown in the header via the renderHeaderWithLoading helper
    return content;
  };

  // Helper to render header with loading indicator
  const renderHeaderWithLoading = (title: string, actions?: React.ReactNode) => {
    return (
      <Header 
        variant="h3"
        actions={actions}
      >
        <SpaceBetween size="xs" direction="horizontal">
          <span>{title}</span>
          {hasRunReport && isLoading && (
            <Spinner size="normal" />
          )}
        </SpaceBetween>
      </Header>
    );
  };

  // Notify parent of loading state changes
  useEffect(() => {
    if (onLoadingChange) {
      onLoadingChange(isLoading);
    }
  }, [isLoading, onLoadingChange]);

  // Prepare data BEFORE any conditional returns (for hooks)
  const hasDateRange = !!dateRange;
  
  // Prepare legend items for Activities chart (before hooks)
  const activitiesLegendItems: LegendItem[] = hasDateRange
    ? [
        { name: 'At Start', color: '#0088FE', dataKey: 'At Start' },
        { name: 'At End', color: '#00C49F', dataKey: 'At End' },
      ]
    : [
        { name: 'Count', color: '#00C49F', dataKey: 'Count' },
      ];

  // Prepare legend items for Role Distribution chart (before hooks)
  const roleDistributionChartData = (metrics?.roleDistribution || []).map(role => ({
    name: role.roleName,
    value: role.count,
  }));

  const roleDistributionLegendItems: LegendItem[] = roleDistributionChartData.map((role, index) => ({
    name: role.name,
    color: COLORS[index % COLORS.length],
    dataKey: role.name,
  }));

  // Create a color map for role distribution to maintain consistent colors when filtering
  const roleColorMap = roleDistributionChartData.reduce((acc, role, index) => {
    acc[role.name] = COLORS[index % COLORS.length];
    return acc;
  }, {} as Record<string, string>);

  // Prepare legend items for Geographic Breakdown chart (before hooks)
  const geographicBreakdownLegendItems: LegendItem[] = [
    { name: 'Activities', color: '#0088FE', dataKey: 'activityCount' },
    { name: 'Participants', color: '#00C49F', dataKey: 'participantCount' },
    { name: 'Participation', color: '#FFBB28', dataKey: 'participationCount' },
  ];

  // Prepare legend items for Activity Category Pie Chart (before hooks)
  const activityCategoryPieData = (metrics?.activitiesByCategory || [])
    .map(category => ({
      name: category.activityCategoryName,
      value: category.activitiesAtEnd, // Use current count of activities
    }))
    .filter(item => item.value > 0);

  const activityCategoryLegendItems: LegendItem[] = activityCategoryPieData.map((category, index) => ({
    name: category.name,
    color: COLORS[index % COLORS.length],
    dataKey: category.name,
  }));

  // Create color map for Activity Category Pie Chart
  const categoryColorMap = activityCategoryPieData.reduce((acc, category, index) => {
    acc[category.name] = COLORS[index % COLORS.length];
    return acc;
  }, {} as Record<string, string>);

  // MUST call all hooks before any conditional returns
  const activitiesLegend = useInteractiveLegend('engagement-activities', activitiesLegendItems);
  const roleDistributionLegend = useInteractiveLegend('role-distribution', roleDistributionLegendItems);
  const geographicBreakdownLegend = useInteractiveLegend('geographic-breakdown', geographicBreakdownLegendItems);
  const activityCategoryLegend = useInteractiveLegend('activity-category-pie', activityCategoryLegendItems);

  // Export handler for Engagement Summary table
  const handleExportEngagementSummary = () => {
    if (!metrics) return;
    
    setIsExportingEngagementSummary(true);
    
    try {
      // Generate CSV from current metrics and grouping dimensions
      const csvBlob = generateEngagementSummaryCSV(
        metrics,
        metrics.groupingDimensions || []
      );
      
      // Extract filter values for filename (support multiple values per property)
      const activityCategoryTokens = propertyFilterQuery.tokens.filter(
        t => t.propertyKey === 'activityCategory' && t.operator === '='
      );
      const activityTypeTokens = propertyFilterQuery.tokens.filter(
        t => t.propertyKey === 'activityType' && t.operator === '='
      );
      const venueTokens = propertyFilterQuery.tokens.filter(
        t => t.propertyKey === 'venue' && t.operator === '='
      );
      const populationTokens = propertyFilterQuery.tokens.filter(
        t => t.propertyKey === 'population' && t.operator === '='
      );
      
      // Extract date range
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (dateRange?.type === 'absolute') {
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      } else if (dateRange?.type === 'relative' && dateRange.amount && dateRange.unit) {
        // Calculate absolute dates from relative range for filename
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
        
        startDate = start.toISOString().split('T')[0];
        endDate = end.toISOString().split('T')[0];
      }
      
      // Generate filename with active filters (use first value if multiple)
      const filename = generateEngagementSummaryFilename({
        geographicArea: selectedGeographicArea,
        startDate,
        endDate,
        activityCategoryName: activityCategoryTokens[0]?.value,
        activityTypeName: activityTypeTokens[0]?.value,
        venueName: venueTokens[0]?.value,
        populationNames: populationTokens.map(t => t.value).filter((v): v is string => !!v),
      });
      
      // Trigger download
      downloadBlob(csvBlob, filename);
      
      // Show success notification
      notification.showSuccess('Engagement Summary exported successfully');
    } catch (error) {
      console.error('Error exporting Engagement Summary:', error);
      notification.showError(
        `Failed to export Engagement Summary: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    } finally {
      setIsExportingEngagementSummary(false);
    }
  };

  // No longer show full-page loading spinner - we'll show spinners in individual components
  // if (isLoading) {
  //   return <LoadingSpinner text="Loading engagement metrics..." />;
  // }

  // Prepare chart data for activities by type (use empty arrays if no data yet)
  const endLabel = hasDateRange ? 'At End' : 'Count';
  
  const activitiesByTypeChartData = (metrics?.activitiesByType || [])
    .map(type => {
      // Construct object with keys in correct order for legend
      const dataPoint: any = { name: type.activityTypeName };
      if (hasDateRange) {
        dataPoint['At Start'] = type.activitiesAtStart;
        dataPoint['At End'] = type.activitiesAtEnd;
      } else {
        dataPoint['Count'] = type.activitiesAtEnd;
      }
      return dataPoint;
    })
    .filter(item => {
      // Filter out items with 0 counts
      if (hasDateRange) {
        return item['At Start'] > 0 || item['At End'] > 0;
      }
      return item['Count'] > 0;
    })
    .sort((a, b) => (b as any)[endLabel] - (a as any)[endLabel]); // Sort by count descending

  // Prepare chart data for activities by category
  const activitiesByCategoryChartData = (metrics?.activitiesByCategory || [])
    .map(category => {
      // Construct object with keys in correct order for legend
      const dataPoint: any = { name: category.activityCategoryName };
      if (hasDateRange) {
        dataPoint['At Start'] = category.activitiesAtStart;
        dataPoint['At End'] = category.activitiesAtEnd;
      } else {
        dataPoint['Count'] = category.activitiesAtEnd;
      }
      return dataPoint;
    })
    .filter(item => {
      // Filter out items with 0 counts
      if (hasDateRange) {
        return item['At Start'] > 0 || item['At End'] > 0;
      }
      return item['Count'] > 0;
    })
    .sort((a, b) => (b as any)[endLabel] - (a as any)[endLabel]); // Sort by count descending

  // Select chart data based on view mode
  const activitiesChartData = activitiesViewMode === 'type' 
    ? activitiesByTypeChartData 
    : activitiesByCategoryChartData;

  return (
    <SpaceBetween size="l">
      {/* Filters Section */}
      <Container
        header={<Header variant="h3">Filters and Grouping</Header>}
      >
        <FilterGroupingPanel
          filterProperties={filteringProperties}
          groupingMode="additive"
          groupingDimensions={groupingDimensionsConfig}
          initialDateRange={dateRange}
          initialFilterTokens={propertyFilterQuery}
          initialGrouping={groupByDimensions}
          onUpdate={handleFilterUpdate}
          onRegisterTrigger={(trigger) => { triggerFilterUpdate.current = trigger; }}
          isLoading={isLoading}
          hideUpdateButton={true}
        />
      </Container>

      {/* Engagement Summary Table - Always visible */}
      <Container 
        header={
          <Header 
            variant="h3"
            actions={
              user?.role !== 'READ_ONLY' && (
                <Button
                  iconName="download"
                  onClick={handleExportEngagementSummary}
                  loading={isExportingEngagementSummary}
                  disabled={isExportingEngagementSummary}
                >
                  Export CSV
                </Button>
              )
            }
          >
            <SpaceBetween size="xs" direction="horizontal">
              <span>Engagement Summary</span>
              <Popover
                dismissButton={false}
                position="top"
                size="medium"
                triggerType="custom"
                content={
                  <SpaceBetween size="s">
                    <Box variant="p">
                      <strong>Participant Count:</strong> The count of distinct individuals involved in activities. 
                      The same person involved in multiple activities is counted only once.
                    </Box>
                    <Box variant="p">
                      <strong>Participation:</strong> The sum of all participant-activity associations. 
                      The same person involved in 3 activities contributes 3 to this count.
                    </Box>
                  </SpaceBetween>
                }
              >
                <Icon name="status-info" variant="link" />
              </Popover>
              {hasRunReport && isLoading && (
                <Spinner size="normal" />
              )}
            </SpaceBetween>
          </Header>
        }
      >
        {renderWithLoadingState(
          <Table
            columnDefinitions={[
            // First column for dimension label or "Total"
            {
              id: 'label',
              header: metrics?.groupingDimensions && metrics.groupingDimensions.length > 0 
                ? metrics.groupingDimensions[0].replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
                : 'Summary',
              cell: (item: any) => {
                // For the Total row
                if (item.isTotal) {
                  return <Box fontWeight="bold">Total</Box>;
                }
                
                // For dimensional breakdown rows
                const dimension = metrics?.groupingDimensions?.[0];
                if (!dimension) return '-';
                
                const nameValue = item.dimensions[dimension];
                const idValue = item.dimensions[`${dimension}Id`];
                
                // Render hyperlinks for specific dimensions
                if (dimension === GroupingDimension.ACTIVITY_CATEGORY) {
                  if (idValue) {
                    return (
                      <Link 
                        href={`/configuration`}
                        onFollow={(e) => {
                          e.preventDefault();
                          navigate('/configuration');
                        }}
                      >
                        {nameValue}
                      </Link>
                    );
                  }
                  return nameValue || '-';
                } else if (dimension === GroupingDimension.ACTIVITY_TYPE) {
                  if (idValue) {
                    return (
                      <Link 
                        href={`/configuration`}
                        onFollow={(e) => {
                          e.preventDefault();
                          navigate('/configuration');
                        }}
                      >
                        {nameValue}
                      </Link>
                    );
                  }
                  return nameValue || '-';
                } else if (dimension === GroupingDimension.VENUE) {
                  if (idValue) {
                    return (
                      <Link 
                        href={`/venues/${idValue}`}
                        onFollow={(e) => {
                          e.preventDefault();
                          navigate(`/venues/${idValue}`);
                        }}
                      >
                        {nameValue}
                      </Link>
                    );
                  }
                  return nameValue || '-';
                } else if (dimension === GroupingDimension.GEOGRAPHIC_AREA) {
                  if (idValue) {
                    return (
                      <Link 
                        href={`/geographic-areas/${idValue}`}
                        onFollow={(e) => {
                          e.preventDefault();
                          navigate(`/geographic-areas/${idValue}`);
                        }}
                      >
                        {nameValue}
                      </Link>
                    );
                  }
                  return nameValue || '-';
                }
                
                return nameValue || '-';
              },
              sortingField: 'label',
            },
            // Additional dimension columns (if multiple dimensions selected)
            ...(metrics?.groupingDimensions && metrics.groupingDimensions.length > 1 
              ? metrics.groupingDimensions.slice(1).map(dimension => ({
                  id: dimension,
                  header: dimension.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                  cell: (item: any) => {
                    // For Total row, leave blank
                    if (item.isTotal) {
                      return '';
                    }
                    
                    const nameValue = item.dimensions[dimension];
                    const idValue = item.dimensions[`${dimension}Id`];
                    
                    // Render hyperlinks for specific dimensions
                    if (dimension === GroupingDimension.ACTIVITY_CATEGORY) {
                      if (idValue) {
                        return (
                          <Link 
                            href={`/configuration`}
                            onFollow={(e) => {
                              e.preventDefault();
                              navigate('/configuration');
                            }}
                          >
                            {nameValue}
                          </Link>
                        );
                      }
                      return nameValue || '-';
                    } else if (dimension === GroupingDimension.ACTIVITY_TYPE) {
                      if (idValue) {
                        return (
                          <Link 
                            href={`/configuration`}
                            onFollow={(e) => {
                              e.preventDefault();
                              navigate('/configuration');
                            }}
                          >
                            {nameValue}
                          </Link>
                        );
                      }
                      return nameValue || '-';
                    } else if (dimension === GroupingDimension.VENUE) {
                      if (idValue) {
                        return (
                          <Link 
                            href={`/venues/${idValue}`}
                            onFollow={(e) => {
                              e.preventDefault();
                              navigate(`/venues/${idValue}`);
                            }}
                          >
                            {nameValue}
                          </Link>
                        );
                      }
                      return nameValue || '-';
                    } else if (dimension === GroupingDimension.GEOGRAPHIC_AREA) {
                      if (idValue) {
                        return (
                          <Link 
                            href={`/geographic-areas/${idValue}`}
                            onFollow={(e) => {
                              e.preventDefault();
                              navigate(`/geographic-areas/${idValue}`);
                            }}
                          >
                            {nameValue}
                          </Link>
                        );
                      }
                      return nameValue || '-';
                    }
                    
                    return nameValue || '-';
                  },
                  sortingField: dimension,
                }))
              : []
            ),
            // Participant/Participation metric columns (grouped first)
            // When no date range: hide "At Start" columns (always 0) and simplify "At End" to current state
            ...(hasDateRange ? [
              {
                id: 'participantsAtStart',
                header: 'Participants at Start',
                cell: (item: any) => item.metrics.participantsAtStart,
                sortingField: 'participantsAtStart',
              },
            ] : []),
            {
              id: 'participantsAtEnd',
              header: hasDateRange ? 'Participants at End' : 'Participants',
              cell: (item: any) => item.metrics.participantsAtEnd,
              sortingField: 'participantsAtEnd',
            },
            ...(hasDateRange ? [
              {
                id: 'participationAtStart',
                header: 'Participation at Start',
                cell: (item: any) => item.metrics.participationAtStart,
                sortingField: 'participationAtStart',
              },
            ] : []),
            {
              id: 'participationAtEnd',
              header: hasDateRange ? 'Participation at End' : 'Participation',
              cell: (item: any) => item.metrics.participationAtEnd,
              sortingField: 'participationAtEnd',
            },
            // Activity metric columns (grouped second)
            ...(hasDateRange ? [
              {
                id: 'activitiesAtStart',
                header: 'Activities at Start',
                cell: (item: any) => item.metrics.activitiesAtStart,
                sortingField: 'activitiesAtStart',
              },
            ] : []),
            {
              id: 'activitiesAtEnd',
              header: hasDateRange ? 'Activities at End' : 'Activities',
              cell: (item: any) => item.metrics.activitiesAtEnd,
              sortingField: 'activitiesAtEnd',
            },
            {
              id: 'activitiesStarted',
              header: 'Activities Started',
              cell: (item: any) => item.metrics.activitiesStarted,
              sortingField: 'activitiesStarted',
            },
            {
              id: 'activitiesCompleted',
              header: 'Activities Completed',
              cell: (item: any) => item.metrics.activitiesCompleted,
              sortingField: 'activitiesCompleted',
            },
            {
              id: 'activitiesCancelled',
              header: 'Activities Cancelled',
              cell: (item: any) => item.metrics.activitiesCancelled,
              sortingField: 'activitiesCancelled',
            },
          ]}
          items={[
            // First row: Total (aggregate metrics) - use 0 as fallback if no data
            {
              isTotal: true,
              dimensions: {},
              metrics: {
                activitiesAtStart: metrics?.activitiesAtStart || 0,
                activitiesAtEnd: metrics?.activitiesAtEnd || 0,
                activitiesStarted: metrics?.activitiesStarted || 0,
                activitiesCompleted: metrics?.activitiesCompleted || 0,
                activitiesCancelled: metrics?.activitiesCancelled || 0,
                participantsAtStart: metrics?.participantsAtStart || 0,
                participantsAtEnd: metrics?.participantsAtEnd || 0,
                participationAtStart: metrics?.participationAtStart || 0,
                participationAtEnd: metrics?.participationAtEnd || 0,
              },
            },
            // Subsequent rows: Dimensional breakdowns (if any)
            ...(metrics?.groupedResults || []),
          ]}
          sortingDisabled={false}
          variant="embedded"
          empty={
            <Box textAlign="center" color="inherit">
              <b>No data available</b>
            </Box>
          }
        />,
          'Click "Run Report" to view engagement summary'
        )}
      </Container>

      {/* Activities Chart with Segmented Control */}
      <Container 
        header={
          <Header 
            variant="h3"
            actions={
              <SegmentedControl
                selectedId={activitiesViewMode}
                onChange={({ detail }) => setActivitiesViewMode(detail.selectedId as ActivitiesViewMode)}
                label="Activities chart view mode"
                options={[
                  { text: 'By Type', id: 'type' },
                  { text: 'By Category', id: 'category' },
                ]}
              />
            }
          >
            <SpaceBetween size="xs" direction="horizontal">
              <span>Activities</span>
              {hasRunReport && isLoading && (
                <Spinner size="normal" />
              )}
            </SpaceBetween>
          </Header>
        }
      >
        {renderWithLoadingState(
          activitiesChartData.length > 0 ? (
            <>
              {/* Screen reader announcement for view mode changes */}
              <div 
                role="status" 
                aria-live="polite" 
                aria-atomic="true"
                className="sr-only"
                style={{ position: 'absolute', left: '-10000px', width: '1px', height: '1px', overflow: 'hidden' }}
              >
                {activitiesViewMode === 'type' ? 'By Type view selected' : 'By Category view selected'}
              </div>
              {activitiesLegendItems.length > 1 && (
                <InteractiveLegend
                  chartId="engagement-activities"
                  series={activitiesLegendItems}
                  onVisibilityChange={activitiesLegend.handleVisibilityChange}
                />
              )}
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={activitiesChartData} barGap={BAR_CHART_GAP} barCategoryGap={BAR_CHART_CATEGORY_GAP} maxBarSize={BAR_CHART_MAX_BAR_SIZE}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  {/* Render bars in chronological order when date range is selected */}
                  {dateRange ? (
                    <>
                      {activitiesLegend.isSeriesVisible('At Start') && (
                        <Bar dataKey="At Start" fill="#0088FE" />
                      )}
                      {activitiesLegend.isSeriesVisible('At End') && (
                        <Bar dataKey="At End" fill="#00C49F" />
                      )}
                    </>
                  ) : (
                    activitiesLegend.isSeriesVisible('Count') && (
                      <Bar dataKey="Count" fill="#00C49F" />
                    )
                  )}
                </BarChart>
              </ResponsiveContainer>
            </>
          ) : (
            <Box textAlign="center" padding="l">
              <b>No activities available for the selected {activitiesViewMode === 'type' ? 'activity types' : 'activity categories'}</b>
            </Box>
          ),
          'Click "Run Report" to view activities chart'
        )}
      </Container>

      {/* Activity Lifecycle Events Chart */}
      {hasRunReport && (
        <ActivityLifecycleChart
          startDate={(() => {
            if (!dateRange) return undefined;
            if (dateRange.type === 'absolute' && dateRange.startDate) {
              return new Date(dateRange.startDate);
            }
            if (dateRange.type === 'relative' && dateRange.amount && dateRange.unit) {
              const start = new Date();
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
              return start;
            }
            return undefined;
          })()}
          endDate={(() => {
            if (!dateRange) return undefined;
            if (dateRange.type === 'absolute' && dateRange.endDate) {
              return new Date(dateRange.endDate);
            }
            if (dateRange.type === 'relative') {
              return new Date();
            }
            return undefined;
          })()}
          geographicAreaIds={selectedGeographicAreaId ? [selectedGeographicAreaId] : undefined}
          activityCategoryIds={(() => {
            const labels = propertyFilterQuery.tokens
              .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
              .flatMap(t => extractValuesFromToken(t));
            const uuids = labels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
            return uuids.length > 0 ? uuids : undefined;
          })()}
          activityTypeIds={(() => {
            const labels = propertyFilterQuery.tokens
              .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
              .flatMap(t => extractValuesFromToken(t));
            const uuids = labels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
            return uuids.length > 0 ? uuids : undefined;
          })()}
          venueIds={(() => {
            const labels = propertyFilterQuery.tokens
              .filter(t => t.propertyKey === 'venue' && t.operator === '=')
              .flatMap(t => extractValuesFromToken(t));
            const uuids = labels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
            return uuids.length > 0 ? uuids : undefined;
          })()}
          populationIds={(() => {
            const labels = propertyFilterQuery.tokens
              .filter(t => t.propertyKey === 'population' && t.operator === '=')
              .flatMap(t => extractValuesFromToken(t));
            const uuids = labels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
            return uuids.length > 0 ? uuids : undefined;
          })()}
        />
      )}

      {/* Activity Category Pie Chart and Role Distribution - Side by Side */}
      <ColumnLayout columns={2}>
        {/* Activity Category Pie Chart */}
        <Container header={renderHeaderWithLoading('Activities by Category')}>
          {renderWithLoadingState(
            activityCategoryPieData.length > 0 ? (
              <>
                {activityCategoryLegendItems.length > 0 && (
                  <InteractiveLegend
                    chartId="activity-category-pie"
                    series={activityCategoryLegendItems}
                    onVisibilityChange={activityCategoryLegend.handleVisibilityChange}
                  />
                )}
                {activityCategoryPieData.filter(cat => activityCategoryLegend.isSeriesVisible(cat.name)).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={activityCategoryPieData.filter(cat => 
                          activityCategoryLegend.isSeriesVisible(cat.name)
                        )}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {activityCategoryPieData
                          .filter(cat => activityCategoryLegend.isSeriesVisible(cat.name))
                          .map((category) => (
                            <Cell key={`cell-${category.name}`} fill={categoryColorMap[category.name]} />
                          ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box textAlign="center" padding="l">
                    <b>All categories are hidden. Toggle legend items to show data.</b>
                  </Box>
                )}
              </>
            ) : (
              <Box textAlign="center" padding="l">
                <b>No activity category data available</b>
              </Box>
            ),
            'Click "Run Report" to view category breakdown'
          )}
        </Container>

        {/* Role Distribution */}
        <Container header={renderHeaderWithLoading('Role Distribution')}>
          {renderWithLoadingState(
            roleDistributionChartData.length > 0 ? (
              <>
                {roleDistributionLegendItems.length > 0 && (
                  <InteractiveLegend
                    chartId="role-distribution"
                    series={roleDistributionLegendItems}
                    onVisibilityChange={roleDistributionLegend.handleVisibilityChange}
                  />
                )}
                {roleDistributionChartData.filter(role => roleDistributionLegend.isSeriesVisible(role.name)).length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={roleDistributionChartData.filter(role => 
                          roleDistributionLegend.isSeriesVisible(role.name)
                        )}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={(entry) => `${entry.name}: ${entry.value}`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {roleDistributionChartData
                          .filter(role => roleDistributionLegend.isSeriesVisible(role.name))
                          .map((role) => (
                            <Cell key={`cell-${role.name}`} fill={roleColorMap[role.name]} />
                          ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box textAlign="center" padding="l">
                    <b>All roles are hidden. Toggle legend items to show data.</b>
                  </Box>
                )}
              </>
            ) : (
              <Box textAlign="center" padding="l">
                <b>No role distribution data available</b>
              </Box>
            ),
            'Click "Run Report" to view role distribution'
          )}
        </Container>
      </ColumnLayout>

      {/* Geographic Breakdown */}
      <Container header={renderHeaderWithLoading('Geographic Breakdown')}>
        {renderWithLoadingState(
          geographicBreakdown && geographicBreakdown.length > 0 ? (
            <>
              <InteractiveLegend
                chartId="geographic-breakdown"
                series={geographicBreakdownLegendItems}
                onVisibilityChange={geographicBreakdownLegend.handleVisibilityChange}
              />
              <ResponsiveContainer width="100%" height={400}>
              <BarChart 
                data={geographicBreakdown} 
                layout="vertical"
                barGap={BAR_CHART_GAP} 
                maxBarSize={BAR_CHART_MAX_BAR_SIZE}
                margin={{ left: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis 
                  type="category" 
                  dataKey="geographicAreaName" 
                  width={180}
                  tick={<GeographicAreaTick 
                    areaTypeMap={new Map(
                      geographicBreakdown.map(area => [area.geographicAreaName, area.areaType])
                    )}
                  />}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div style={{ padding: '8px', backgroundColor: 'white', border: '1px solid #ccc' }}>
                          <div style={{ marginBottom: '4px', fontWeight: 'bold' }}>{data.geographicAreaName}</div>
                          <div style={{ marginBottom: '4px', fontSize: '12px' }}>
                            <Badge color={getAreaTypeBadgeColor(data.areaType as AreaType)}>{data.areaType}</Badge>
                          </div>
                          <div>Activities: {data.activityCount}</div>
                          <div>Participants: {data.participantCount}</div>
                          <div>Participation: {data.participationCount}</div>
                          {data.hasChildren && (
                            <div style={{ marginTop: '4px', fontSize: '12px', color: '#0073bb' }}>
                              Click to drill down
                            </div>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                {geographicBreakdownLegend.isSeriesVisible('Activities') && (
                  <Bar 
                    dataKey="activityCount" 
                    fill="#0088FE" 
                    name="Activities"
                    cursor="pointer"
                    onClick={(data: any) => {
                      if (data && data.hasChildren) {
                        setGeographicAreaFilter(data.geographicAreaId);
                      }
                    }}
                  />
                )}
                {geographicBreakdownLegend.isSeriesVisible('Participants') && (
                  <Bar 
                    dataKey="participantCount" 
                    fill="#00C49F" 
                    name="Participants"
                    cursor="pointer"
                    onClick={(data: any) => {
                      if (data && data.hasChildren) {
                        setGeographicAreaFilter(data.geographicAreaId);
                      }
                    }}
                  />
                )}
                {geographicBreakdownLegend.isSeriesVisible('Participation') && (
                  <Bar 
                    dataKey="participationCount" 
                    fill="#FFBB28" 
                    name="Participation"
                    cursor="pointer"
                    onClick={(data: any) => {
                      if (data && data.hasChildren) {
                        setGeographicAreaFilter(data.geographicAreaId);
                      }
                    }}
                  />
                )}
              </BarChart>
            </ResponsiveContainer>
          </>
        ) : (
          <Box textAlign="center" padding="l">
            <b>No geographic breakdown data available</b>
          </Box>
        ),
          'Click "Run Report" to view geographic breakdown'
        )}
      </Container>
    </SpaceBetween>
  );
}
