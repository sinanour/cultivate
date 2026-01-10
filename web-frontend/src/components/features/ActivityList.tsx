import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import PropertyFilter from '@cloudscape-design/components/property-filter';
import DateRangePicker from '@cloudscape-design/components/date-range-picker';
import Pagination from '@cloudscape-design/components/pagination';
import Alert from '@cloudscape-design/components/alert';
import Spinner from '@cloudscape-design/components/spinner';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import type { DateRangePickerProps } from '@cloudscape-design/components/date-range-picker';
import type { Activity } from '../../types';
import { ActivityService, type ActivityFilterParams } from '../../services/api/activity.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { activityCategoryService } from '../../services/api/activity-category.service';
import { PopulationService } from '../../services/api/population.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { formatDate } from '../../utils/date.utils';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

const ITEMS_PER_PAGE = 10;
const BATCH_SIZE = 100;

export function ActivityList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [deleteError, setDeleteError] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false); // Track if we're currently in a fetch cycle

  // PropertyFilter configuration with bidirectional label-UUID cache
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });
  const [propertyFilterOptions, setPropertyFilterOptions] = useState<PropertyFilterProps.FilteringOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);

  // Date range filter
  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(null);

  // Bidirectional cache: label ↔ UUID
  const [labelToUuid, setLabelToUuid] = useState<Map<string, string>>(new Map());
  const [uuidToLabel, setUuidToLabel] = useState<Map<string, string>>(new Map());

  // Batched loading state
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const [currentBatchPage, setCurrentBatchPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [loadingError, setLoadingError] = useState<string | undefined>();
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isCancelled, setIsCancelled] = useState(false); // Track if user cancelled loading

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
  const consolidateTokens = (query: PropertyFilterProps.Query): PropertyFilterProps.Query => {
    const tokensByProperty = new Map<string, PropertyFilterProps.Token[]>();
    
    query.tokens.forEach(token => {
      const key = token.propertyKey || '';
      if (!tokensByProperty.has(key)) {
        tokensByProperty.set(key, []);
      }
      tokensByProperty.get(key)!.push(token);
    });
    
    const consolidatedTokens: PropertyFilterProps.Token[] = [];
    tokensByProperty.forEach((tokens, propertyKey) => {
      if (tokens.length === 0) return;
      
      const allValues = tokens
        .filter(t => t.operator === '=')
        .flatMap(t => extractValuesFromToken(t));
      
      const uniqueValues = Array.from(new Set(allValues));
      
      if (uniqueValues.length > 0) {
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

  // Extract individual values from consolidated tokens
  const extractValuesFromToken = (token: PropertyFilterProps.Token): string[] => {
    if (!token.value) return [];
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
      key: 'status',
      propertyLabel: 'Status',
      groupValuesLabel: 'Status values',
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
        const filtered = categories.filter((cat: any) => 
          !filteringText || cat.name.toLowerCase().includes(filteringText.toLowerCase())
        );
        
        filtered.forEach((cat: any) => addToCache(cat.id, cat.name));
        options = filtered.map((cat: any) => ({
          propertyKey: 'activityCategory',
          value: cat.name,
          label: cat.name,
        }));
      } else if (filteringProperty.key === 'activityType') {
        const types = await ActivityTypeService.getActivityTypes();
        const filtered = types.filter((type: any) => 
          !filteringText || type.name.toLowerCase().includes(filteringText.toLowerCase())
        );
        
        filtered.forEach((type: any) => addToCache(type.id, type.name));
        options = filtered.map((type: any) => ({
          propertyKey: 'activityType',
          value: type.name,
          label: type.name,
        }));
      } else if (filteringProperty.key === 'status') {
        const statuses = [
          { value: 'PLANNED', label: 'Planned' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ];
        const filtered = statuses.filter(s => 
          !filteringText || s.label.toLowerCase().includes(filteringText.toLowerCase())
        );
        
        filtered.forEach(s => addToCache(s.value, s.label));
        options = filtered.map(s => ({
          propertyKey: 'status',
          value: s.label,
          label: s.label,
        }));
      } else if (filteringProperty.key === 'population') {
        const populations = await PopulationService.getPopulations();
        const filtered = populations.filter((pop: any) => 
          !filteringText || pop.name.toLowerCase().includes(filteringText.toLowerCase())
        );
        
        filtered.forEach((pop: any) => addToCache(pop.id, pop.name));
        options = filtered.map((pop: any) => ({
          propertyKey: 'population',
          value: pop.name,
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

  // Helper to validate and parse UUID arrays from URL
  const getValidatedUUIDs = (params: URLSearchParams, key: string): string[] => {
    const values = params.getAll(key);
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return values.filter(v => uuidRegex.test(v));
  };

  // Initialize PropertyFilter from URL parameters
  useEffect(() => {
    const initializeFiltersFromUrl = async () => {
      const tokensByProperty = new Map<string, string[]>();
      
      // Activity Categories
      const catIds = getValidatedUUIDs(searchParams, 'activityCategoryIds');
      const catLabels: string[] = [];
      for (const id of catIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          try {
            const categories = await activityCategoryService.getActivityCategories();
            const category = categories.find((c: any) => c.id === id);
            if (category) {
              label = category.name;
              addToCache(category.id, category.name);
            } else {
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
      
      // Activity Types
      const typeIds = getValidatedUUIDs(searchParams, 'activityTypeIds');
      const typeLabels: string[] = [];
      for (const id of typeIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          try {
            const types = await ActivityTypeService.getActivityTypes();
            const type = types.find((t: any) => t.id === id);
            if (type) {
              label = type.name;
              addToCache(type.id, type.name);
            } else {
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
      
      // Statuses
      const statusValues = searchParams.getAll('status');
      const statusLabels: string[] = [];
      const statusMap: Record<string, string> = {
        'PLANNED': 'Planned',
        'ACTIVE': 'Active',
        'COMPLETED': 'Completed',
        'CANCELLED': 'Cancelled',
      };
      for (const value of statusValues) {
        const label = statusMap[value];
        if (label) {
          addToCache(value, label);
          statusLabels.push(label);
        }
      }
      if (statusLabels.length > 0) {
        tokensByProperty.set('status', statusLabels);
      }
      
      // Populations
      const popIds = getValidatedUUIDs(searchParams, 'populationIds');
      const popLabels: string[] = [];
      for (const id of popIds) {
        let label = getLabelFromUuid(id);
        if (!label) {
          try {
            const populations = await PopulationService.getPopulations();
            const population = populations.find((p: any) => p.id === id);
            if (population) {
              label = population.name;
              addToCache(population.id, population.name);
            } else {
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
      
      // Create consolidated tokens
      const tokens: PropertyFilterProps.Token[] = [];
      tokensByProperty.forEach((labels, propertyKey) => {
        if (labels.length > 0) {
          tokens.push({
            propertyKey,
            operator: '=',
            value: labels.join(', '),
          });
        }
      });
      
      if (tokens.length > 0) {
        setPropertyFilterQuery({ tokens, operation: 'and' });
      }
      
      // Initialize date range from URL
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      if (startDate && endDate) {
        setDateRange({
          type: 'absolute',
          startDate,
          endDate,
        });
      }
    };
    
    if (propertyFilterQuery.tokens.length === 0 && !dateRange) {
      initializeFiltersFromUrl();
    }
  }, []); // Only run once on mount

  // Synchronize filters to URL
  useEffect(() => {
    const params = new URLSearchParams();
    
    // Date range
    if (dateRange?.type === 'absolute' && dateRange.startDate && dateRange.endDate) {
      params.append('startDate', dateRange.startDate);
      params.append('endDate', dateRange.endDate);
    }
    
    // PropertyFilter tokens (convert labels to UUIDs)
    const activityCategoryLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const activityCategoryIds = activityCategoryLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    activityCategoryIds.forEach(id => params.append('activityCategoryIds', id));
    
    const activityTypeLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const activityTypeIds = activityTypeLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    activityTypeIds.forEach(id => params.append('activityTypeIds', id));
    
    const statusLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'status' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const statusValues = statusLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    statusValues.forEach(value => params.append('status', value));
    
    const populationLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'population' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const populationIds = populationLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    populationIds.forEach(id => params.append('populationIds', id));
    
    setSearchParams(params, { replace: true });
  }, [dateRange, propertyFilterQuery, setSearchParams]);

  // Build filter params from PropertyFilter tokens and date range
  const filterParams = useMemo((): ActivityFilterParams => {
    const params: ActivityFilterParams = {
      geographicAreaId: selectedGeographicAreaId,
    };
    
    // Extract filters from PropertyFilter tokens (convert labels to UUIDs)
    const activityCategoryLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const activityCategoryIds = activityCategoryLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    if (activityCategoryIds.length > 0) {
      params.activityCategoryIds = activityCategoryIds;
    }
    
    const activityTypeLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const activityTypeIds = activityTypeLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    if (activityTypeIds.length > 0) {
      params.activityTypeIds = activityTypeIds;
    }
    
    const statusLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'status' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const statusValues = statusLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    if (statusValues.length > 0) {
      params.status = statusValues;
    }
    
    const populationLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'population' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const populationIds = populationLabels.map(label => getUuidFromLabel(label)).filter(Boolean) as string[];
    if (populationIds.length > 0) {
      params.populationIds = populationIds;
    }
    
    // Date range
    if (dateRange?.type === 'absolute' && dateRange.startDate && dateRange.endDate) {
      params.startDate = dateRange.startDate;
      params.endDate = dateRange.endDate;
    }
    
    return params;
  }, [propertyFilterQuery, dateRange, selectedGeographicAreaId, getUuidFromLabel]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ActivityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setDeleteError('');
      // Reset batched loading
      setAllActivities([]);
      setCurrentBatchPage(1);
      setHasMorePages(true);
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete activity.');
    },
  });

  // Reset state when filters change
  useEffect(() => {
    setAllActivities([]);
    setCurrentBatchPage(1);
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    setIsCancelled(false); // Reset cancellation state
    isFetchingRef.current = false; // Reset fetch tracking
  }, [selectedGeographicAreaId, propertyFilterQuery, dateRange]);

  // Cancel loading handler
  const handleCancelLoading = useCallback(() => {
    setIsCancelled(true);
    setHasMorePages(false); // Stop auto-fetching
    isFetchingRef.current = false;
  }, []);

  // Function to fetch next batch
  const fetchNextBatch = useCallback(async () => {
    if (isLoadingBatch || !hasMorePages || isFetchingRef.current || isCancelled) return;

    isFetchingRef.current = true;
    setIsLoadingBatch(true);
    setLoadingError(undefined);

    try {
      const response = await ActivityService.getActivitiesPaginated(
        currentBatchPage,
        BATCH_SIZE,
        filterParams
      );
      
      setAllActivities(prev => [...prev, ...response.data]);
      setTotalCount(response.pagination.total);
      setHasMorePages(currentBatchPage < response.pagination.totalPages);
      setCurrentBatchPage(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching activities batch:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load activities');
    } finally {
      setIsLoadingBatch(false);
      isFetchingRef.current = false;
    }
  }, [currentBatchPage, isLoadingBatch, hasMorePages, filterParams, isCancelled]);

  // Fetch first batch on mount or when filters change (only when page is 1)
  useEffect(() => {
    if (currentBatchPage === 1 && hasMorePages && !isLoadingBatch && allActivities.length === 0 && !isFetchingRef.current) {
      fetchNextBatch();
    }
  }, [currentBatchPage, hasMorePages, isLoadingBatch, allActivities.length, fetchNextBatch]);

  // Auto-fetch next batch after previous batch renders
  useEffect(() => {
    if (!isLoadingBatch && hasMorePages && currentBatchPage > 1) {
      const timer = setTimeout(() => {
        fetchNextBatch();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingBatch, hasMorePages, currentBatchPage, fetchNextBatch]);

  // Retry function
  const handleRetry = useCallback(() => {
    setLoadingError(undefined);
    fetchNextBatch();
  }, [fetchNextBatch]);

  // Pagination for display
  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return allActivities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allActivities, currentPageIndex]);

  const handleEdit = (activity: Activity) => {
    navigate(`/activities/${activity.id}/edit`);
  };

  const handleCreate = () => {
    navigate('/activities/new');
  };

  const handleDelete = async (activity: Activity) => {
    if (window.confirm(`Are you sure you want to delete "${activity.name}"?`)) {
      deleteMutation.mutate(activity.id);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setCsvError('');
    
    try {
      await ActivityService.exportActivities(selectedGeographicAreaId);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to export activities');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateCSVFile(file);
    if (!validation.valid) {
      setCsvError(validation.error || 'Invalid file');
      return;
    }

    setIsImporting(true);
    setCsvError('');

    try {
      const result = await ActivityService.importActivities(file);
      setImportResult(result);
      setShowImportResults(true);

      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['activities'] });
        // Reset batched loading
        setAllActivities([]);
        setCurrentBatchPage(1);
        setHasMorePages(true);
      }
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to import activities');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isLoading = isLoadingBatch && currentBatchPage === 1;
  const loadedCount = allActivities.length;
  const hasActiveFilters = propertyFilterQuery.tokens.length > 0 || dateRange !== null;

  return (
    <SpaceBetween size="l">
      {deleteError && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setDeleteError('')}
        >
          {deleteError}
        </Alert>
      )}
      {csvError && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setCsvError('')}
        >
          {csvError}
        </Alert>
      )}
      {loadingError && (
        <Alert
          type="error"
          dismissible
          onDismiss={() => setLoadingError(undefined)}
          action={
            <Button onClick={handleRetry} iconName="refresh">
              Retry
            </Button>
          }
        >
          {loadingError}
        </Alert>
      )}
      
      {/* Filters: DateRangePicker and PropertyFilter */}
      <SpaceBetween direction="vertical" size="m">
        <DateRangePicker
          onChange={({ detail }) => setDateRange(detail.value)}
          value={dateRange}
          relativeOptions={[
            { key: 'previous-30-days', amount: 30, unit: 'day', type: 'relative' },
            { key: 'previous-90-days', amount: 90, unit: 'day', type: 'relative' },
            { key: 'previous-6-months', amount: 6, unit: 'month', type: 'relative' },
            { key: 'previous-1-year', amount: 1, unit: 'year', type: 'relative' },
          ]}
          isValidRange={(range) => {
            if (range?.type === 'absolute') {
              const start = new Date(range.startDate);
              const end = new Date(range.endDate);
              if (start > end) {
                return {
                  valid: false,
                  errorMessage: 'Start date must be before end date',
                };
              }
            }
            return { valid: true };
          }}
          i18nStrings={{
            todayAriaLabel: 'Today',
            nextMonthAriaLabel: 'Next month',
            previousMonthAriaLabel: 'Previous month',
            customRelativeRangeDurationLabel: 'Duration',
            customRelativeRangeDurationPlaceholder: 'Enter duration',
            customRelativeRangeOptionLabel: 'Custom range',
            customRelativeRangeOptionDescription: 'Set a custom range in the past',
            customRelativeRangeUnitLabel: 'Unit of time',
            formatRelativeRange: (e) => {
              const n = e.amount === 1 ? e.unit : `${e.unit}s`;
              return `Last ${e.amount} ${n}`;
            },
            formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
            dateTimeConstraintText: 'Range must be between 6 and 30 days. Use 24 hour format.',
            relativeModeTitle: 'Relative range',
            absoluteModeTitle: 'Absolute range',
            relativeRangeSelectionHeading: 'Choose a range',
            startDateLabel: 'Start date',
            endDateLabel: 'End date',
            startTimeLabel: 'Start time',
            endTimeLabel: 'End time',
            clearButtonLabel: 'Clear and dismiss',
            cancelButtonLabel: 'Cancel',
            applyButtonLabel: 'Apply',
          }}
          placeholder="Filter by date range"
        />
        
        <PropertyFilter
          query={propertyFilterQuery}
          onChange={({ detail }) => {
            const consolidated = consolidateTokens(detail);
            setPropertyFilterQuery(consolidated);
            setCurrentPageIndex(1); // Reset to first page when filters change
          }}
          filteringProperties={filteringProperties}
          filteringOptions={propertyFilterOptions}
          filteringLoadingText="Loading options"
          filteringStatusType={isLoadingOptions ? 'loading' : 'finished'}
          onLoadItems={handleLoadItems}
          i18nStrings={{
            filteringAriaLabel: 'Filter activities',
            dismissAriaLabel: 'Dismiss',
            filteringPlaceholder: 'Filter activities by property',
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
            removeTokenButtonAriaLabel: (token) =>
              `Remove token ${token.propertyKey} ${token.operator} ${token.value}`,
            enteredTextLabel: (text) => `Use: "${text}"`,
          }}
          filteringEmpty="No suggestions"
        />
      </SpaceBetween>
      
      <Table
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <Link href={`/activities/${item.id}`}>
                {item.name}
              </Link>
            ),
            sortingField: 'name',
          },
          {
            id: 'type',
            header: 'Type',
            cell: (item) => item.activityType?.name || '-',
          },
          {
            id: 'dates',
            header: 'Dates',
            cell: (item) => {
              const start = formatDate(item.startDate);
              const end = item.endDate ? formatDate(item.endDate) : 'Ongoing';
              return `${start} - ${end}`;
            },
          },
          {
            id: 'status',
            header: 'Status',
            cell: (item) => {
              const statusColors: Record<string, 'green' | 'grey' | 'blue' | 'red'> = {
                PLANNED: 'blue',
                ACTIVE: 'green',
                COMPLETED: 'grey',
                CANCELLED: 'red',
              };
              return (
                <SpaceBetween direction="horizontal" size="xs">
                  <Badge color={statusColors[item.status] || 'grey'}>
                    {item.status}
                  </Badge>
                  {item.isOngoing && <Badge color="blue">Ongoing</Badge>}
                </SpaceBetween>
              );
            },
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => (
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <Button
                    variant="inline-link"
                    onClick={() => handleEdit(item)}
                  >
                    Edit
                  </Button>
                )}
                {canDelete() && (
                  <Button
                    variant="inline-link"
                    onClick={() => handleDelete(item)}
                  >
                    Delete
                  </Button>
                )}
              </SpaceBetween>
            ),
          },
        ]}
        items={paginatedActivities}
        loading={isLoading}
        loadingText="Loading activities"
        sortingDisabled
        empty={
          <Box textAlign="center" color="inherit">
            <b>No activities</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              {hasActiveFilters ? 'No activities match your filters.' : 'No activities to display.'}
            </Box>
            {canCreate() && !hasActiveFilters && (
              <Button onClick={handleCreate}>Create activity</Button>
            )}
          </Box>
        }
        header={
          <Header
            actions={
              <SpaceBetween direction="horizontal" size="xs">
                {canEdit() && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={handleFileSelect}
                    />
                    <Button
                      iconName="upload"
                      onClick={() => fileInputRef.current?.click()}
                      loading={isImporting}
                      disabled={isImporting}
                    >
                      Import CSV
                    </Button>
                    <Button
                      iconName="download"
                      onClick={handleExport}
                      loading={isExporting}
                      disabled={isExporting}
                    >
                      Export CSV
                    </Button>
                  </>
                )}
                {canCreate() && (
                  <Button variant="primary" onClick={handleCreate}>
                    Create activity
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            <Box display="inline" fontSize="heading-l" fontWeight="bold">
              <SpaceBetween direction="horizontal" size="xs">
                <span>Activities</span>
                <Box display="inline" color="text-status-inactive">
                  {isCancelled && totalCount > loadedCount 
                    ? `(${loadedCount} / ${totalCount})`
                    : `(${loadedCount})`
                  }
                </Box>
                {!isCancelled && loadedCount < totalCount && totalCount > 0 && (
                  <SpaceBetween direction="horizontal" size="xs">
                    <Spinner size="normal" />
                    <Box display="inline" color="text-status-inactive">
                      Loading: {loadedCount} / {totalCount}
                    </Box>
                    <Button
                      variant="inline-link"
                      onClick={handleCancelLoading}
                      ariaLabel="Cancel loading"
                    >
                      Cancel
                    </Button>
                  </SpaceBetween>
                )}
              </SpaceBetween>
            </Box>
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={Math.ceil(allActivities.length / ITEMS_PER_PAGE)}
            onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
          />
        }
      />
      <ImportResultsModal
        visible={showImportResults}
        result={importResult}
        onDismiss={() => setShowImportResults(false)}
      />
    </SpaceBetween>
  );
}
