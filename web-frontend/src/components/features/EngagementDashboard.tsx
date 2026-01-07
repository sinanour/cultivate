import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import ColumnLayout from '@cloudscape-design/components/column-layout';
import Box from '@cloudscape-design/components/box';
import Button from '@cloudscape-design/components/button';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import Multiselect from '@cloudscape-design/components/multiselect';
import PropertyFilter from '@cloudscape-design/components/property-filter';
import Table from '@cloudscape-design/components/table';
import Link from '@cloudscape-design/components/link';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Popover from '@cloudscape-design/components/popover';
import Icon from '@cloudscape-design/components/icon';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import type { MultiselectProps } from '@cloudscape-design/components/multiselect';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import Badge from '@cloudscape-design/components/badge';
import { AnalyticsService, type EngagementMetricsParams } from '../../services/api/analytics.service';
import { activityCategoryService } from '../../services/api/activity-category.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { VenueService } from '../../services/api/venue.service';
import { PopulationService } from '../../services/api/population.service';
import { LoadingSpinner } from '../common/LoadingSpinner';
import { InteractiveLegend, useInteractiveLegend, type LegendItem } from '../common/InteractiveLegend';
import { ActivityLifecycleChart } from './ActivityLifecycleChart';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { useAuth } from '../../hooks/useAuth';
import { useNotification } from '../../hooks/useNotification';
import { useDebouncedLoading } from '../../hooks/useDebouncedLoading';
import { GroupingDimension } from '../../utils/constants';
import { generateEngagementSummaryCSV, downloadBlob } from '../../utils/csv.utils';
import { generateEngagementSummaryFilename } from '../../utils/csv-filename.utils';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import { isValidUUID, setMultiValueParam, getValidatedUUIDs } from '../../utils/url-params.utils';
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

export function EngagementDashboard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize state from URL parameters
  const initializeDateRange = (): DateRangePickerProps.Value | null => {
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

  const initializeGroupByDimensions = (): MultiselectProps.Options => {
    // Check new param name first
    const groupByParam = searchParams.get('engagementGroupBy');
    
    // Backward compatibility: check old param name
    const oldGroupByParam = !groupByParam ? searchParams.get('groupBy') : null;
    
    const paramToUse = groupByParam || oldGroupByParam;
    
    if (!paramToUse) return [];
    
    const dimensions = paramToUse.split(',');
    const validDimensions = ['activityCategory', 'activityType', 'venue', 'geographicArea', 'population'];
    
    return dimensions
      .filter(dim => validDimensions.includes(dim))
      .map(dim => {
        const label = dim.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        return { label, value: dim };
      });
  };

  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(initializeDateRange);
  const [groupByDimensions, setGroupByDimensions] = useState<MultiselectProps.Options>(initializeGroupByDimensions);
  
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
  const [propertyFilterOptions, setPropertyFilterOptions] = useState<PropertyFilterProps.FilteringOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isExportingEngagementSummary, setIsExportingEngagementSummary] = useState(false);
  
  // Bidirectional cache: label ↔ UUID
  const [labelToUuid, setLabelToUuid] = useState<Map<string, string>>(new Map());
  const [uuidToLabel, setUuidToLabel] = useState<Map<string, string>>(new Map());

  // Helper to add to cache
  const addToCache = (uuid: string, label: string) => {
    setLabelToUuid(prev => new Map(prev).set(label, uuid));
    setUuidToLabel(prev => new Map(prev).set(uuid, label));
  };

  // Helper to get UUID from label
  const getUuidFromLabel = (label: string): string | undefined => {
    return labelToUuid.get(label);
  };

  // Helper to get label from UUID
  const getLabelFromUuid = (uuid: string): string | undefined => {
    return uuidToLabel.get(uuid);
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
        const venues = await VenueService.getVenues(undefined, undefined, selectedGeographicAreaId, filteringText || undefined);
        
        // Add to cache and create options with labels as values
        venues.forEach(venue => addToCache(venue.id, venue.name));
        options = venues.map(venue => ({
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

  // Persist activities view mode to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(ACTIVITIES_CHART_VIEW_MODE_KEY, activitiesViewMode);
    } catch {
      // Silently fail if localStorage is unavailable
    }
  }, [activitiesViewMode]);

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
            const venues = await VenueService.getVenues();
            const venue = venues.find(v => v.id === id);
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

  // Sync state to URL whenever filters or grouping changes
  useEffect(() => {
    // Start with empty params - write only what this dashboard owns
    const params = new URLSearchParams();
    
    // CRITICAL: Add global geographic area filter if active
    // Read from context (not URL) to get the current value
    if (selectedGeographicAreaId) {
      params.set('geographicArea', selectedGeographicAreaId);
    }
    
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
    
    // Dashboard-specific grouping (renamed)
    if (groupByDimensions.length > 0) {
      const groupByValues = groupByDimensions.map(d => d.value).join(',');
      params.set('engagementGroupBy', groupByValues);
    }
    
    // Update URL without causing navigation/reload
    setSearchParams(params, { replace: true });
  }, [dateRange, propertyFilterQuery, groupByDimensions, selectedGeographicAreaId]);
  // Note: selectedGeographicAreaId IS in dependencies - we want to update URL when it changes
  // This is safe because we're not reading from URL, we're reading from context

  const { data: metrics, isLoading } = useQuery({
    queryKey: ['engagementMetrics', dateRange, selectedGeographicAreaId, propertyFilterQuery, groupByDimensions],
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
      // Support multiple values per property (OR logic within dimension)
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
      
      const params: EngagementMetricsParams = {
        startDate,
        endDate,
        geographicAreaIds: selectedGeographicAreaId ? [selectedGeographicAreaId] : undefined,
        activityCategoryIds: activityCategoryIds.length > 0 ? activityCategoryIds : undefined,
        activityTypeIds: activityTypeIds.length > 0 ? activityTypeIds : undefined,
        venueIds: venueIds.length > 0 ? venueIds : undefined,
        populationIds: populationIds.length > 0 ? populationIds : undefined,
        groupBy: groupByDimensions.map(d => d.value as GroupingDimension),
      };
      
      return AnalyticsService.getEngagementMetrics(params);
    },
    placeholderData: (previousData) => previousData, // Prevent flicker by keeping stale data visible while fetching
  });

  // Separate query for geographic breakdown
  const { data: geographicBreakdown } = useQuery({
    queryKey: ['geographicBreakdown', dateRange, selectedGeographicAreaId, propertyFilterQuery],
    queryFn: () => {
      // Convert date range to ISO datetime format for API
      let startDate: string | undefined;
      let endDate: string | undefined;
      
      if (dateRange) {
        if (dateRange.type === 'absolute') {
          startDate = toISODateTime(dateRange.startDate, false);
          endDate = toISODateTime(dateRange.endDate, true);
        } else if (dateRange.type === 'relative') {
          const now = new Date();
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
          
          startDate = start.toISOString();
          endDate = now.toISOString();
        }
      }
      
      // Extract filters from PropertyFilter tokens (convert labels to UUIDs)
      // Support multiple values per property (OR logic within dimension)
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
    placeholderData: (previousData) => previousData, // Prevent flicker by keeping stale data visible while fetching
  });

  // Debounce loading state to prevent flicker from quick requests (500ms delay)
  const debouncedLoading = useDebouncedLoading(isLoading, 500);

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
      
      // Extract date range (convert relative to absolute if needed)
      let startDate: string | undefined;
      let endDate: string | undefined;
      if (dateRange?.type === 'absolute') {
        startDate = dateRange.startDate;
        endDate = dateRange.endDate;
      } else if (dateRange?.type === 'relative') {
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

  if (isLoading) {
    return <LoadingSpinner text="Loading engagement metrics..." />;
  }

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
      {/* Show loading overlay when fetching but keep UI mounted - debounced to prevent flicker */}
      {debouncedLoading && (
        <Box textAlign="center" padding="s">
          <LoadingSpinner text="Updating metrics..." />
        </Box>
      )}
      
      {/* Filters Section */}
      <Container
        header={<Header variant="h3">Filters and Grouping</Header>}
      >
        <SpaceBetween size="m">
          {/* Date Range and Date Granularity */}
          <ColumnLayout columns={2}>
            <DateRangePicker
              value={dateRange}
              onChange={({ detail }) => setDateRange(detail.value || null)}
              placeholder="All history"
              dateOnly={true}
              relativeOptions={[
                { key: 'previous-7-days', amount: 7, unit: 'day', type: 'relative' },
                { key: 'previous-30-days', amount: 30, unit: 'day', type: 'relative' },
                { key: 'previous-90-days', amount: 90, unit: 'day', type: 'relative' },
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
                dateTimeConstraintText: 'Range must be between 6 and 30 days.',
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
          </ColumnLayout>

          {/* PropertyFilter for Activity Category, Activity Type, and Venue */}
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
              filteringAriaLabel: 'Filter engagement data',
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

          {/* Grouping Dimensions */}
          <Multiselect
            selectedOptions={groupByDimensions}
            onChange={({ detail }) => setGroupByDimensions(detail.selectedOptions)}
            options={[
              { label: 'Activity Category', value: GroupingDimension.ACTIVITY_CATEGORY },
              { label: 'Activity Type', value: GroupingDimension.ACTIVITY_TYPE },
              { label: 'Venue', value: GroupingDimension.VENUE },
              { label: 'Geographic Area', value: GroupingDimension.GEOGRAPHIC_AREA },
            ]}
            placeholder="Group by dimensions"
            selectedAriaLabel="Selected"
          />
        </SpaceBetween>
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
            info={
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
            }
          >
            Engagement Summary
          </Header>
        }
      >
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
        />
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
            Activities
          </Header>
        }
      >
        {activitiesChartData.length > 0 ? (
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
        )}
      </Container>

      {/* Activity Lifecycle Events Chart */}
      <ActivityLifecycleChart
        startDate={
          dateRange?.type === 'absolute' 
            ? new Date(dateRange.startDate)
            : dateRange?.type === 'relative'
            ? (() => {
                const now = new Date();
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
                return start;
              })()
            : undefined
        }
        endDate={
          dateRange?.type === 'absolute'
            ? new Date(dateRange.endDate)
            : dateRange?.type === 'relative'
            ? new Date()
            : undefined
        }
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

      {/* Activity Category Pie Chart and Role Distribution - Side by Side */}
      <ColumnLayout columns={2}>
        {/* Activity Category Pie Chart */}
        <Container header={<Header variant="h3">Activities by Category</Header>}>
          {activityCategoryPieData.length > 0 ? (
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
          )}
        </Container>

        {/* Role Distribution */}
        <Container header={<Header variant="h3">Role Distribution</Header>}>
          {roleDistributionChartData.length > 0 ? (
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
          )}
        </Container>
      </ColumnLayout>

      {/* Geographic Breakdown */}
      <Container header={<Header variant="h3">Geographic Breakdown</Header>}>
        {geographicBreakdown && geographicBreakdown.length > 0 ? (
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
        )}
      </Container>
    </SpaceBetween>
  );
}
