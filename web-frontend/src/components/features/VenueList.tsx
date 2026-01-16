import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import Pagination from '@cloudscape-design/components/pagination';
import Alert from '@cloudscape-design/components/alert';
import type { PropertyFilterProps } from '@cloudscape-design/components/property-filter';
import type { Venue } from '../../types';
import { VenueService } from '../../services/api/venue.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { ProgressIndicator } from '../common/ProgressIndicator';
import { FilterGroupingPanel, type FilterGroupingState, type FilterProperty } from '../common/FilterGroupingPanel';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

const ITEMS_PER_PAGE = 10;
const BATCH_SIZE = 100;

export function VenueList() {
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

  // Batched loading state
  const [allVenues, setAllVenues] = useState<Venue[]>([]);
  const [currentBatchPage, setCurrentBatchPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [loadingError, setLoadingError] = useState<string | undefined>();
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isCancelled, setIsCancelled] = useState(false);
  const [filtersReady, setFiltersReady] = useState(false); // Track if initial filters are resolved

  // Separate state variables (like EngagementDashboard) - NOT a single filterState object
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });

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

  const deleteMutation = useMutation({
    mutationFn: (id: string) => VenueService.deleteVenue(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venues'] });
      setDeleteError('');
      // Reset batched loading
      setAllVenues([]);
      setCurrentBatchPage(1);
      setHasMorePages(true);
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete venue. It may be referenced by activities or participants.');
    },
  });

  // Reset state when filters change
  useEffect(() => {
    setAllVenues([]);
    setCurrentBatchPage(1);
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    setIsCancelled(false);
    isFetchingRef.current = false;
  }, [filterParams]);

  // Function to fetch next batch
  const fetchNextBatch = useCallback(async () => {
    if (isLoadingBatch || !hasMorePages || isFetchingRef.current || isCancelled) return;

    isFetchingRef.current = true;
    setIsLoadingBatch(true);
    setLoadingError(undefined);

    try {
      const response = await VenueService.getVenuesFlexible({
        page: currentBatchPage,
        limit: BATCH_SIZE,
        geographicAreaId: filterParams.geographicAreaId,
        filter: filterParams.filter
      });
      
      setAllVenues(prev => [...prev, ...response.data]);
      setTotalCount(response.pagination.total);
      setHasMorePages(currentBatchPage < response.pagination.totalPages);
      setCurrentBatchPage(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching venues batch:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load venues');
    } finally {
      setIsLoadingBatch(false);
      isFetchingRef.current = false;
    }
  }, [currentBatchPage, isLoadingBatch, hasMorePages, filterParams, isCancelled]);

  // Cancel loading handler
  const handleCancelLoading = useCallback(() => {
    setIsCancelled(true);
    setHasMorePages(false);
    isFetchingRef.current = false;
  }, []);

  // Resume loading handler
  const handleResumeLoading = useCallback(() => {
    setIsCancelled(false);
    setHasMorePages(true);
    fetchNextBatch();
  }, [fetchNextBatch]);

  // Fetch first batch on mount or when dependencies change
  useEffect(() => {
    // Wait for filters to be ready before fetching
    if (!filtersReady) return;
    
    if (currentBatchPage === 1 && hasMorePages && !isLoadingBatch && allVenues.length === 0 && !isFetchingRef.current) {
      fetchNextBatch();
    }
  }, [currentBatchPage, hasMorePages, isLoadingBatch, allVenues.length, fetchNextBatch, filtersReady]);

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
  const paginatedVenues = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return allVenues.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allVenues, currentPageIndex]);

  const handleEdit = (venue: Venue) => {
    navigate(`/venues/${venue.id}/edit`);
  };

  const handleCreate = () => {
    navigate('/venues/new');
  };

  const handleDelete = async (venue: Venue) => {
    if (window.confirm(`Are you sure you want to delete "${venue.name}"?`)) {
      deleteMutation.mutate(venue.id);
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
        // Reset batched loading
        setAllVenues([]);
        setCurrentBatchPage(1);
        setHasMorePages(true);
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

  const isLoading = isLoadingBatch && currentBatchPage === 1;
  const loadedCount = allVenues.length;

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
                {item.name}
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
        items={paginatedVenues}
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
              <Button onClick={handleCreate}>Create venue</Button>
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
                    Create venue
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            <Box display="inline" fontSize="heading-l" fontWeight="bold">
              <SpaceBetween direction="horizontal" size="xs">
                <Box display="inline-block" variant="h1">
                  <SpaceBetween direction="horizontal" size="xs">
                      <span>Venues</span>
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
                  entityName="venues"
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
            pagesCount={Math.ceil(allVenues.length / ITEMS_PER_PAGE)}
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
