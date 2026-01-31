import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import Alert from '@cloudscape-design/components/alert';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import type { Activity } from '../../types';
import { ActivityService, type ActivityFilterParams } from '../../services/api/activity.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { activityCategoryService } from '../../services/api/activity-category.service';
import { PopulationService } from '../../services/api/population.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { formatDate } from '../../utils/date.utils';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { ProgressIndicator } from '../common/ProgressIndicator';
import { FilterGroupingPanel, type FilterGroupingState, type FilterProperty } from '../common/FilterGroupingPanel';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

const ITEMS_PER_PAGE = 10;
const BATCH_SIZE = 100;

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

export function ActivityList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
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
  const isFetchingRef = useRef(false);

  // Separate state variables (like EngagementDashboard) - NOT a single filterState object
  const [dateRange, setDateRange] = useState<FilterGroupingState['dateRange']>(null);
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });

  // Bidirectional cache: label ↔ UUID (for converting labels to UUIDs for API calls)
  const [labelToUuid, setLabelToUuid] = useState<Map<string, string>>(new Map());

  // Batched loading state
  const [allActivities, setAllActivities] = useState<Activity[]>([]);
  const currentBatchPageRef = useRef(1); // Use ref instead of state to avoid stale closures
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [loadingError, setLoadingError] = useState<string | undefined>();
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isCancelled, setIsCancelled] = useState(false); // Track if user cancelled loading
  const [filtersReady, setFiltersReady] = useState(false); // Track if initial filters are resolved

  // Helper to add to cache (label -> UUID mapping)
  const addToCache = (uuid: string, label: string) => {
    setLabelToUuid(prev => new Map(prev).set(label, uuid));
  };

  // Extract individual values from consolidated tokens
  const extractValuesFromToken = (token: PropertyFilterProps.Token): string[] => {
    if (!token.value) return [];
    return token.value.split(',').map((v: string) => v.trim()).filter((v: string) => v.length > 0);
  };

  // Filter properties configuration with loadItems callbacks
  const filterProperties: FilterProperty[] = useMemo(() => [
    {
      key: 'activityCategory',
      propertyLabel: 'Activity Category',
      groupValuesLabel: 'Activity Category values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        const categories = await activityCategoryService.getActivityCategories();
        const filtered = categories.filter((cat: any) => 
          !filterText || cat.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach((cat: any) => addToCache(cat.id, cat.name));
        return filtered.map((cat: any) => ({
          propertyKey: 'activityCategory',
          value: cat.name, // Store label as value for display in tokens
          label: cat.name, // Display label in dropdown
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
        const filtered = types.filter((type: any) => 
          !filterText || type.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach((type: any) => addToCache(type.id, type.name));
        return filtered.map((type: any) => ({
          propertyKey: 'activityType',
          value: type.name, // Store label as value for display in tokens
          label: type.name, // Display label in dropdown
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
        const filtered = statuses.filter(s => 
          !filterText || s.label.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach(s => addToCache(s.value, s.label));
        return filtered.map(s => ({
          propertyKey: 'status',
          value: s.label, // Store label as value for display in tokens
          label: s.label, // Display label in dropdown
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
        const filtered = populations.filter((pop: any) => 
          !filterText || pop.name.toLowerCase().includes(filterText.toLowerCase())
        );
        
        filtered.forEach((pop: any) => addToCache(pop.id, pop.name));
        return filtered.map((pop: any) => ({
          propertyKey: 'population',
          value: pop.name, // Store label as value for display in tokens
          label: pop.name, // Display label in dropdown
        }));
      },
    },
  ], []); // Empty deps - functions are stable

  // Pre-populate cache when filter tokens are restored from URL
  useEffect(() => {
    const populateCache = async () => {
      // Check if we have any filter tokens that need cache population
      const needsCache = propertyFilterQuery.tokens.some(
        t => ['activityCategory', 'activityType', 'status', 'population'].includes(t.propertyKey || '')
      );
      
      if (!needsCache) return;
      
      try {
        // Fetch all reference data to populate the cache
        const [categories, types, populations] = await Promise.all([
          activityCategoryService.getActivityCategories(),
          ActivityTypeService.getActivityTypes(),
          PopulationService.getPopulations(),
        ]);
        
        categories.forEach((cat: any) => addToCache(cat.id, cat.name));
        types.forEach((type: any) => addToCache(type.id, type.name));
        populations.forEach((pop: any) => addToCache(pop.id, pop.name));
        
        // Add status mappings
        const statuses = [
          { value: 'PLANNED', label: 'Planned' },
          { value: 'ACTIVE', label: 'Active' },
          { value: 'COMPLETED', label: 'Completed' },
          { value: 'CANCELLED', label: 'Cancelled' },
        ];
        statuses.forEach(s => addToCache(s.value, s.label));
      } catch (error) {
        console.error('Error pre-populating filter cache:', error);
      }
    };
    
    populateCache();
  }, []); // Only run once on mount

  // Handler for FilterGroupingPanel updates (called when "Update" button clicked)
  const handleFilterUpdate = (state: FilterGroupingState) => {
    setDateRange(state.dateRange);
    setPropertyFilterQuery(state.filterTokens);
  };

  // Handler for when initial URL filter resolution completes
  const handleInitialResolutionComplete = useCallback(() => {
    setFiltersReady(true);
  }, []);

  // Build filter params from dateRange and propertyFilterQuery
  const filterParams = useMemo((): ActivityFilterParams => {
    const params: ActivityFilterParams = {
      geographicAreaId: selectedGeographicAreaId,
      filter: {}, // Initialize filter object
    };
    
    // Extract filters from propertyFilterQuery tokens (convert labels to UUIDs)
    const activityCategoryLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityCategory' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const activityCategoryIds = activityCategoryLabels.map(label => labelToUuid.get(label)).filter(Boolean) as string[];
    if (activityCategoryIds.length > 0) {
      params.filter!.activityCategoryIds = activityCategoryIds.join(',');
    }
    
    const activityTypeLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'activityType' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const activityTypeIds = activityTypeLabels.map(label => labelToUuid.get(label)).filter(Boolean) as string[];
    if (activityTypeIds.length > 0) {
      params.filter!.activityTypeIds = activityTypeIds.join(',');
    }
    
    const statusLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'status' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const statusValues = statusLabels.map(label => labelToUuid.get(label)).filter(Boolean) as string[];
    if (statusValues.length > 0) {
      params.filter!.status = statusValues.join(',');
    }
    
    const populationLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'population' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    const populationIds = populationLabels.map(label => labelToUuid.get(label)).filter(Boolean) as string[];
    if (populationIds.length > 0) {
      params.filter!.populationIds = populationIds.join(',');
    }
    
    // Date range - convert to ISO datetime format and add to filter
    if (dateRange?.type === 'absolute' && dateRange.startDate && dateRange.endDate) {
      params.filter!.startDate = toISODateTime(dateRange.startDate, false);
      params.filter!.endDate = toISODateTime(dateRange.endDate, true);
    }
    
    // Remove empty filter object if no filters
    if (Object.keys(params.filter!).length === 0) {
      delete params.filter;
    }
    
    return params;
  }, [dateRange, propertyFilterQuery, selectedGeographicAreaId, labelToUuid]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ActivityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setDeleteError('');
      // Reset batched loading
      setAllActivities([]);
      currentBatchPageRef.current = 1; // Reset page ref
      setHasMorePages(true);
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete activity.');
    },
  });

  // Reset state when filters change
  useEffect(() => {
    setAllActivities([]);
    currentBatchPageRef.current = 1; // Reset page ref
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    setIsCancelled(false);
    isFetchingRef.current = false;
  }, [selectedGeographicAreaId, dateRange, propertyFilterQuery]);

  // Function to fetch next batch
  const fetchNextBatch = useCallback(async () => {
    if (isLoadingBatch || !hasMorePages || isFetchingRef.current || isCancelled) return;

    isFetchingRef.current = true;
    setIsLoadingBatch(true);
    setLoadingError(undefined);

    try {
      // Capture current page from ref to avoid stale closure
      const pageToFetch = currentBatchPageRef.current;
      
      const response = await ActivityService.getActivitiesFlexible({
        page: pageToFetch,
        limit: BATCH_SIZE,
        ...filterParams
      });
      
      // If this is the first page, replace activities instead of appending
      if (pageToFetch === 1) {
        setAllActivities(response.data);
      } else {
        setAllActivities(prev => [...prev, ...response.data]);
      }
      setTotalCount(response.pagination.total);
      setHasMorePages(pageToFetch < response.pagination.totalPages);
      currentBatchPageRef.current = pageToFetch + 1; // Increment page ref
    } catch (error) {
      console.error('Error fetching activities batch:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load activities');
    } finally {
      setIsLoadingBatch(false);
      isFetchingRef.current = false;
    }
  }, [isLoadingBatch, hasMorePages, filterParams, isCancelled]);

  // Cancel loading handler
  const handleCancelLoading = useCallback(() => {
    setIsCancelled(true);
    setHasMorePages(false); // Stop auto-fetching
    isFetchingRef.current = false;
  }, []);

  // Resume loading handler
  const handleResumeLoading = useCallback(() => {
    setIsCancelled(false);
    setHasMorePages(true);
    // Trigger next batch fetch
    fetchNextBatch();
  }, [fetchNextBatch]);

  // Fetch first batch on mount or when filters change (only when page is 1)
  useEffect(() => {
    // Wait for filters to be ready before fetching
    if (!filtersReady) return;
    
    if (currentBatchPageRef.current === 1 && hasMorePages && !isLoadingBatch && allActivities.length === 0 && !isFetchingRef.current) {
      fetchNextBatch();
    }
  }, [hasMorePages, isLoadingBatch, allActivities.length, fetchNextBatch, filtersReady]);

  // Auto-fetch next batch after previous batch renders
  useEffect(() => {
    if (!isLoadingBatch && hasMorePages && currentBatchPageRef.current > 1) {
      const timer = setTimeout(() => {
        fetchNextBatch();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoadingBatch, hasMorePages, fetchNextBatch]);

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
        currentBatchPageRef.current = 1; // Reset page ref
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

  const isLoading = isLoadingBatch && currentBatchPageRef.current === 1;
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
      
      <Table
        wrapLines={false}
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
                    iconName="edit"
                    onClick={() => handleEdit(item)}
                    ariaLabel={`Edit ${item.name}`}
                  />
                )}
                {canDelete() && (
                  <Button
                    variant="inline-link"
                    iconName="remove"
                    onClick={() => handleDelete(item)}
                    ariaLabel={`Remove ${item.name}`}
                  />
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
              <ResponsiveButton 
                onClick={handleCreate}
                mobileIcon="add-plus"
                mobileAriaLabel="Create new activity"
              >
                Create activity
              </ResponsiveButton>
            )}
          </Box>
        }
        filter={
          <FilterGroupingPanel
            filterProperties={filterProperties}
            groupingMode="none"
            includeDateRange={true}
            initialDateRange={dateRange}
            initialFilterTokens={propertyFilterQuery}
            onUpdate={handleFilterUpdate}
            onInitialResolutionComplete={handleInitialResolutionComplete}
            isLoading={isLoading}
          />
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
                    <ResponsiveButton
                      iconName="upload"
                      onClick={() => fileInputRef.current?.click()}
                      loading={isImporting}
                      disabled={isImporting}
                      mobileAriaLabel="Import activities from CSV"
                    >
                      Import CSV
                    </ResponsiveButton>
                    <ResponsiveButton
                      iconName="download"
                      onClick={handleExport}
                      loading={isExporting}
                      disabled={isExporting}
                      mobileAriaLabel="Export activities to CSV"
                    >
                      Export CSV
                    </ResponsiveButton>
                  </>
                )}
                {canCreate() && (
                  <ResponsiveButton 
                    variant="primary" 
                    onClick={handleCreate}
                    mobileIcon="add-plus"
                    mobileAriaLabel="Create new activity"
                  >
                    Create activity
                  </ResponsiveButton>
                )}
              </SpaceBetween>
            }
          >
            <Box display="inline" fontSize="heading-l" fontWeight="bold">
              <SpaceBetween direction="horizontal" size="xs">
                <Box display="inline-block" variant="h1">
                  <SpaceBetween direction="horizontal" size="xs">
                      <span>Activities</span>
                      {loadedCount >= totalCount && totalCount > 0 && (
                        <Box display="inline" color="text-status-inactive" variant="h1" fontWeight="normal">
                          ({loadedCount})
                        </Box>
                      )}
                  </SpaceBetween>
                </Box>
                <ProgressIndicator
                  loadedCount={loadedCount}
                  totalCount={totalCount}
                  entityName="activities"
                  onCancel={handleCancelLoading}
                  onResume={handleResumeLoading}
                  isCancelled={isCancelled}
                />
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
