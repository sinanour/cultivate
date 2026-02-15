import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import DatePicker from '@cloudscape-design/components/date-picker';
import FormField from '@cloudscape-design/components/form-field';
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
import { FilterGroupingPanel, type FilterGroupingState, type FilterProperty } from '../common/FilterGroupingPanel';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { PullToRefreshWrapper } from '../common/PullToRefreshWrapper';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';
import { invalidatePageCaches, getListPageQueryKeys } from '../../utils/cache-invalidation.utils';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

const ITEMS_PER_PAGE = 100;

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
  const [confirmDelete, setConfirmDelete] = useState<Activity | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Separate state variables (like EngagementDashboard) - NOT a single filterState object
  const [dateRange, setDateRange] = useState<FilterGroupingState['dateRange']>(null);
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });

  // Bidirectional cache: label ↔ UUID (for converting labels to UUIDs for API calls)
  const [labelToUuid, setLabelToUuid] = useState<Map<string, string>>(new Map());

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
      key: 'name',
      propertyLabel: 'Name',
      groupValuesLabel: 'Name values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        // For name filtering, we use the search text directly (no need to fetch from backend)
        // The backend will handle partial matching on activity names
        if (!filterText) return [];

        return [{
          propertyKey: 'name',
          value: filterText, // Use the search text directly
          label: filterText,
        }];
      },
    },
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
    {
      key: 'lastUpdated',
      propertyLabel: 'Last Updated',
      groupValuesLabel: 'Last Updated value',
      operators: ['<=', '<', '>=', '>'].map(operator => ({
        operator,
        form: ({ value, onChange }: { value?: string; onChange: (value: string) => void }) => (
          <FormField>
            <DatePicker
              value={value ?? ''}
              onChange={event => onChange(event.detail.value)}
              placeholder="YYYY/MM/DD"
              expandToViewport={true}
            />
          </FormField>
        ),
        match: 'date' as const,
      })) as any, // Cast to any to bypass type checking for custom form operators
      loadItems: async () => [], // No async loading for date picker
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
    setCurrentPageIndex(1); // Reset to page 1 when filters change
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
    
    // Name filter - use the search text directly (no UUID conversion needed)
    const nameValues = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'name' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    if (nameValues.length > 0) {
      // For name filtering, we use the first value (typically only one name filter at a time)
      params.filter!.name = nameValues[0];
    }

    // Last Updated filter - convert PropertyFilter tokens to updatedAt query parameters
    const lastUpdatedTokens = propertyFilterQuery.tokens.filter(t => t.propertyKey === 'lastUpdated');
    if (lastUpdatedTokens.length > 0) {
      if (!params.filter!.updatedAt) {
        params.filter!.updatedAt = {};
      }

      lastUpdatedTokens.forEach(token => {
        const operator = token.operator;
        const value = token.value;

        if (!value) return;

        // Convert operator to backend format and convert date to ISO datetime
        if (operator === '<=') {
          params.filter!.updatedAt.lte = toISODateTime(value, true); // End of day
        } else if (operator === '<') {
          params.filter!.updatedAt.lt = toISODateTime(value, false); // Start of day
        } else if (operator === '>=') {
          params.filter!.updatedAt.gte = toISODateTime(value, false); // Start of day
        } else if (operator === '>') {
          params.filter!.updatedAt.gt = toISODateTime(value, true); // End of day
        }
      });
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

  // Fetch activities using React Query with pagination
  const {
    data: activitiesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "activities",
      currentPageIndex,
      ITEMS_PER_PAGE,
      filterParams,
    ],
    queryFn: async () => {
      const response = await ActivityService.getActivitiesFlexible({
        page: currentPageIndex,
        limit: ITEMS_PER_PAGE,
        ...filterParams
      });
      return response;
    },
    enabled: filtersReady, // Only fetch when filters are ready
    staleTime: 30000, // Cache for 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  const activities = activitiesData?.data || [];
  const totalCount = activitiesData?.pagination.total || 0;
  const totalPages = activitiesData?.pagination.totalPages || 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ActivityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setDeleteError('');
      setCurrentPageIndex(1); // Reset to page 1 after deletion
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to remove activity.');
    },
  });

  const handleEdit = (activity: Activity) => {
    navigate(`/activities/${activity.id}/edit`);
  };

  const handleCreate = () => {
    navigate('/activities/new');
  };

  const handleDelete = async (activity: Activity) => {
    setConfirmDelete(activity);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id);
      setConfirmDelete(null);
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
        setCurrentPageIndex(1); // Reset to page 1 after import
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

  const hasActiveFilters = propertyFilterQuery.tokens.length > 0 || dateRange !== null;

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    // Invalidate caches (but preserve auth tokens)
    await invalidatePageCaches(queryClient, {
      queryKeys: getListPageQueryKeys('activities'),
      clearLocalStorage: false // Don't clear localStorage to preserve auth
    });

    // Reset pagination
    setCurrentPageIndex(1);

    // Trigger refetch
    await refetch();
  }, [queryClient, refetch]);

  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
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
        {error && (
        <Alert
          type="error"
          dismissible
            onDismiss={() => { }}
          action={
            <Button onClick={() => refetch()} iconName="refresh">
              Retry
            </Button>
          }
        >
            {error instanceof Error ? error.message : 'Failed to load activities'}
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
              <Box>
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
              </Box>
            ),
          },
        ]}
          items={activities}
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
                  <React.Fragment key="edit-actions">
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
                  </React.Fragment>)}
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
              Activities {totalCount > 0 && `(${totalCount.toLocaleString()})`}
            </Box>
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={totalPages}
            onChange={({ detail }) => setCurrentPageIndex(detail.currentPageIndex)}
            ariaLabels={{
              nextPageLabel: "Next page",
              previousPageLabel: "Previous page",
              pageLabel: (pageNumber) => `Page ${pageNumber}`,
            }}
          />
        }
      />
      <ImportResultsModal
        visible={showImportResults}
        result={importResult}
        onDismiss={() => setShowImportResults(false)}
      />
        <ConfirmationDialog
          visible={confirmDelete !== null}
          title="Remove Activity"
          message={`Are you sure you want to remove "${confirmDelete?.name}"?`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
    </SpaceBetween>
    </PullToRefreshWrapper>
  );
}
