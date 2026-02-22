import React, { useState, useMemo, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Badge from '@cloudscape-design/components/badge';
import Pagination from '@cloudscape-design/components/pagination';
import Alert from '@cloudscape-design/components/alert';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import type { Venue } from '../../types';
import { VenueService } from '../../services/api/venue.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../hooks/useAuth';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { FilterGroupingPanel, type FilterGroupingState, type FilterProperty } from '../common/FilterGroupingPanel';
import { ResponsiveButton } from '../common/ResponsiveButton';
import { VenueDisplay } from '../common/VenueDisplay';
import { PullToRefreshWrapper } from '../common/PullToRefreshWrapper';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';
import { invalidatePageCaches, getListPageQueryKeys } from '../../utils/cache-invalidation.utils';
import { ConfirmationDialog } from '../common/ConfirmationDialog';

const ITEMS_PER_PAGE = 100;

export function VenueList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { user } = useAuth();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [deleteError, setDeleteError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<Venue | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Batched loading state removed - using React Query pagination instead

  // Separate state variables (like EngagementDashboard) - NOT a single filterState object
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });

  const [filtersReady, setFiltersReady] = useState(false); // Track if initial filters are resolved

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
      operators: ['='], // Use equals operator for consistency
      loadItems: async (filterText: string) => {
        // Load sample values even with empty filter text
        const response = await VenueService.getVenuesFlexible({
          page: 1,
          limit: 20,
          geographicAreaId: selectedGeographicAreaId,
          filter: filterText ? { name: filterText } : undefined,
          fields: ['id', 'name']
        });
        
        return response.data.map((v: any) => ({
          propertyKey: 'name',
          value: v.name,
          label: v.name,
        }));
      },
    },
    {
      key: 'address',
      propertyLabel: 'Address',
      groupValuesLabel: 'Address values',
      operators: ['='], // Use equals operator for consistency
      loadItems: async (filterText: string) => {
        // Load sample values even with empty filter text
        const response = await VenueService.getVenuesFlexible({
          page: 1,
          limit: 20,
          geographicAreaId: selectedGeographicAreaId,
          filter: filterText ? { address: filterText } : undefined,
          fields: ['id', 'address']
        });
        
        return response.data.map((v: any) => ({
          propertyKey: 'address',
          value: v.address,
          label: v.address,
        }));
      },
    },
    {
      key: 'venueType',
      propertyLabel: 'Venue Type',
      groupValuesLabel: 'Venue Type values',
      operators: ['='],
      loadItems: async (filterText: string) => {
        // Only two valid venue types from the backend enum
        const venueTypes = [
          { value: 'PUBLIC_BUILDING', label: 'Public Building' },
          { value: 'PRIVATE_RESIDENCE', label: 'Private Residence' },
        ];
        const filtered = venueTypes.filter(vt => 
          !filterText || vt.label.toLowerCase().includes(filterText.toLowerCase())
        );
        
        return filtered.map(vt => ({
          propertyKey: 'venueType',
          value: vt.value, // Use enum value for backend
          label: vt.label, // Use human-friendly label for display
        }));
      },
    },
  ], [selectedGeographicAreaId]); // Depend on selectedGeographicAreaId for venue and area loading

  // Handler for FilterGroupingPanel updates (called when "Update" button clicked)
  const handleFilterUpdate = (state: FilterGroupingState) => {
    setPropertyFilterQuery(state.filterTokens);
    setCurrentPageIndex(1); // Reset to page 1 when filters change
  };

  // Handler for when initial URL filter resolution completes
  const handleInitialResolutionComplete = useCallback(() => {
    setFiltersReady(true);
  }, []);

  // Build filter params from propertyFilterQuery
  const filterParams = useMemo(() => {
    const params: any = {
      geographicAreaId: selectedGeographicAreaId,
      filter: {}, // Initialize filter object
    };
    
    // Extract filters from tokens and add to filter object
    const nameLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'name' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    
    const addressLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'address' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    
    const venueTypeLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'venueType' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    
    // Add name filter if present
    if (nameLabels.length > 0) {
      params.filter.name = nameLabels[0];
    }
    
    // Add address filter if present
    if (addressLabels.length > 0) {
      params.filter.address = addressLabels[0];
    }
    
    // Add venueType filter if present
    if (venueTypeLabels.length > 0) {
      params.filter.venueType = venueTypeLabels[0];
    }
    
    // Remove empty filter object if no filters
    if (Object.keys(params.filter).length === 0) {
      delete params.filter;
    }
    
    return params;
  }, [propertyFilterQuery, selectedGeographicAreaId]);

  // Fetch venues using React Query with pagination
  const {
    data: venuesData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "venues",
      currentPageIndex,
      ITEMS_PER_PAGE,
      filterParams,
    ],
    queryFn: async () => {
      const response = await VenueService.getVenuesFlexible({
        page: currentPageIndex,
        limit: ITEMS_PER_PAGE,
        geographicAreaId: filterParams.geographicAreaId,
        filter: filterParams.filter
      });
      return response;
    },
    enabled: filtersReady, // Only fetch when filters are ready
    staleTime: 30000, // Cache for 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  const venues = venuesData?.data || [];
  const totalCount = venuesData?.pagination.total || 0;
  const totalPages = venuesData?.pagination.totalPages || 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => VenueService.deleteVenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      setDeleteError('');
      setCurrentPageIndex(1); // Reset to page 1 after deletion
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to remove venue. It may be referenced by activities or participants.');
    },
  });

  const handleEdit = (venue: Venue) => {
    navigate(`/venues/${venue.id}/edit`);
  };

  const handleCreate = () => {
    navigate('/venues/new');
  };

  const handleDelete = async (venue: Venue) => {
    setConfirmDelete(venue);
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
      await VenueService.exportVenues(selectedGeographicAreaId);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to export venues');
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
      const result = await VenueService.importVenues(file);
      setImportResult(result);
      setShowImportResults(true);

      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['venues'] });
        setCurrentPageIndex(1); // Reset to page 1 after import
      }
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to import venues');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    // Invalidate caches (but preserve auth tokens)
    await invalidatePageCaches(queryClient, {
      queryKeys: getListPageQueryKeys('venues'),
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
            {error instanceof Error ? error.message : 'Failed to load venues'}
        </Alert>
      )}
      
      <Table
        wrapLines={false}
        filter={
          <FilterGroupingPanel
            filterProperties={filterProperties}
            groupingMode="none"
            includeDateRange={false}
            initialFilterTokens={propertyFilterQuery}
            onUpdate={handleFilterUpdate}
            onInitialResolutionComplete={handleInitialResolutionComplete}
            isLoading={isLoading}
          />
        }
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <Link href={`/venues/${item.id}`}>
                <VenueDisplay
                  venue={item}
                  currentUserRole={user?.role || 'READ_ONLY'}
                />
              </Link>
            ),
            sortingField: 'name',
          },
          {
            id: 'address',
            header: 'Address',
            cell: (item) => item.address,
            sortingField: 'address',
          },
          {
            id: 'geographicArea',
            header: 'Geographic Area',
            cell: (item) => 
              item.geographicArea ? (
                <Link href={`/geographic-areas/${item.geographicArea.id}`}>
                  {item.geographicArea.name}
                </Link>
              ) : '-',
          },
          {
            id: 'venueType',
            header: 'Venue Type',
            cell: (item) => {
              if (!item.venueType) return '';

              const badgeColor = item.venueType === 'PRIVATE_RESIDENCE' ? 'green' : 'severity-medium';
              const badgeLabel = item.venueType === 'PRIVATE_RESIDENCE' ? 'Private Residence' : 'Public Building';

              return (
                <Badge color={badgeColor}>
                  {badgeLabel}
                </Badge>
              );
            },
          },
          {
            id: 'actions',
            header: 'Actions',
            cell: (item) => {
              const displayName = user?.role === 'PII_RESTRICTED' ? item.address : item.name;
              return (
                <SpaceBetween direction="horizontal" size="xs">
                  {canEdit() && (
                    <Button
                      variant="normal"
                      iconName="edit"
                      onClick={() => handleEdit(item)}
                      ariaLabel={`Edit ${displayName}`}
                    />
                  )}
                  {canDelete() && (
                    <Button
                      variant="normal"
                      iconName="remove"
                      onClick={() => handleDelete(item)}
                      ariaLabel={`Remove ${displayName}`}
                    />
                  )}
                </SpaceBetween>);
            },
          },
        ]}
          items={venues}
        loading={isLoading}
        loadingText="Loading venues"
        sortingDisabled
        empty={
          <Box textAlign="center" color="inherit">
            <b>No venues</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              No venues match your filters.
            </Box>
            {canCreate() && (
              <ResponsiveButton 
                onClick={handleCreate}
                mobileIcon="add-plus"
                mobileAriaLabel="Create new venue"
              >
                Create venue
              </ResponsiveButton>
            )}
          </Box>
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
                      mobileAriaLabel="Import venues from CSV"
                    >
                      Import CSV
                    </ResponsiveButton>
                    <ResponsiveButton
                      iconName="download"
                      onClick={handleExport}
                      loading={isExporting}
                      disabled={isExporting}
                      mobileAriaLabel="Export venues to CSV"
                    >
                      Export CSV
                    </ResponsiveButton>
                  </React.Fragment>
                )}
                {canCreate() && (
                  <ResponsiveButton 
                    variant="primary" 
                    onClick={handleCreate}
                    mobileIcon="add-plus"
                    mobileAriaLabel="Create new venue"
                  >
                    Create venue
                  </ResponsiveButton>
                )}
              </SpaceBetween>
            }
          >
            <Box display="inline" fontSize="heading-l" fontWeight="bold">
              Venues {totalCount > 0 && `(${totalCount.toLocaleString()})`}
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
          title="Remove Venue"
          message={`Are you sure you want to remove "${confirmDelete ? (user?.role === 'PII_RESTRICTED' ? confirmDelete.address : confirmDelete.name) : ''}"?`}
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
