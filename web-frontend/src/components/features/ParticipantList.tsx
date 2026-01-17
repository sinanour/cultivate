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
import type { Participant } from '../../types';
import { ParticipantService } from '../../services/api/participant.service';
import { PopulationService } from '../../services/api/population.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { ProgressIndicator } from '../common/ProgressIndicator';
import { FilterGroupingPanel, type FilterGroupingState, type FilterProperty } from '../common/FilterGroupingPanel';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';
import { renderPopulationBadges } from '../../utils/population-badge.utils';

const ITEMS_PER_PAGE = 10;
const BATCH_SIZE = 100;

export function ParticipantList() {
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
  const [propertyFilterQuery, setPropertyFilterQuery] = useState<PropertyFilterProps.Query>({
    tokens: [],
    operation: 'and',
  });

  // Bidirectional cache: label ↔ UUID (for converting labels to UUIDs for API calls)
  const [labelToUuid, setLabelToUuid] = useState<Map<string, string>>(new Map());

  // Batched loading state
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
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
      key: 'name',
      propertyLabel: 'Name',
      groupValuesLabel: 'Name values',
      operators: ['='], // Use equals operator for consistency
      loadItems: async (filterText: string) => {
        // Load sample values even with empty filter text
        const response = await ParticipantService.getParticipantsFlexible({
          page: 1,
          limit: 20,
          geographicAreaId: selectedGeographicAreaId,
          filter: filterText ? { name: filterText } : undefined,
          fields: ['id', 'name']
        });
        
        return response.data.map((p: any) => ({
          propertyKey: 'name',
          value: p.name,
          label: p.name,
        }));
      },
    },
    {
      key: 'email',
      propertyLabel: 'Email',
      groupValuesLabel: 'Email values',
      operators: ['='], // Use equals operator for consistency
      loadItems: async (filterText: string) => {
        // Load sample values even with empty filter text
        const response = await ParticipantService.getParticipantsFlexible({
          page: 1,
          limit: 20,
          geographicAreaId: selectedGeographicAreaId,
          filter: filterText ? { email: filterText } : undefined,
          fields: ['id', 'email']
        });
        
        return response.data
          .filter((p: any) => p.email)
          .map((p: any) => ({
            propertyKey: 'email',
            value: p.email!,
            label: p.email!,
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
        
        // Cache both directions: UUID -> label and label -> UUID
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
      // Get all population tokens
      const populationTokens = propertyFilterQuery.tokens.filter(
        t => t.propertyKey === 'population'
      );
      
      if (populationTokens.length === 0) {
        return;
      }
      
      // Fetch all populations to populate the cache
      try {
        const populations = await PopulationService.getPopulations();
        populations.forEach((pop: any) => addToCache(pop.id, pop.name));
      } catch (error) {
        console.error('Error pre-populating population cache:', error);
      }
    };
    
    populateCache();
  }, []); // Only run once on mount

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
    
    const emailLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'email' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    
    // Add name filter if present
    if (nameLabels.length > 0) {
      params.filter.name = nameLabels[0];
    }
    
    // Add email filter if present
    if (emailLabels.length > 0) {
      params.filter.email = emailLabels[0];
    }
    
    
    const populationLabels = propertyFilterQuery.tokens
      .filter(t => t.propertyKey === 'population' && t.operator === '=')
      .flatMap(t => extractValuesFromToken(t));
    // Convert labels to UUIDs for API call
    const populationIds = populationLabels.map(label => labelToUuid.get(label)).filter(Boolean) as string[];
    if (populationIds.length > 0) {
      params.filter!.populationIds = populationIds.join(',');
    }
    
    // Remove empty filter object if no filters
    if (Object.keys(params.filter).length === 0) {
      delete params.filter;
    }
    
    return params;
  }, [propertyFilterQuery, selectedGeographicAreaId, labelToUuid]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ParticipantService.deleteParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      setDeleteError('');
      // Reset batched loading
      setAllParticipants([]);
      currentBatchPageRef.current = 1; // Reset page ref
      setHasMorePages(true);
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete participant.');
    },
  });

  // Reset state when filters change
  useEffect(() => {
    setAllParticipants([]);
    currentBatchPageRef.current = 1; // Reset page ref
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    setIsCancelled(false);
    isFetchingRef.current = false;
  }, [selectedGeographicAreaId, propertyFilterQuery]);

  // Function to fetch next batch
  const fetchNextBatch = useCallback(async () => {
    if (isLoadingBatch || !hasMorePages || isFetchingRef.current || isCancelled) return;

    isFetchingRef.current = true;
    setIsLoadingBatch(true);
    setLoadingError(undefined);

    try {
      // Capture current page from ref to avoid stale closure
      const pageToFetch = currentBatchPageRef.current;
      
      const response = await ParticipantService.getParticipantsFlexible({
        page: pageToFetch,
        limit: BATCH_SIZE,
        ...filterParams
      });
      
      // If this is the first page, replace participants instead of appending
      if (pageToFetch === 1) {
        setAllParticipants(response.data);
      } else {
        setAllParticipants(prev => [...prev, ...response.data]);
      }
      setTotalCount(response.pagination.total);
      setHasMorePages(pageToFetch < response.pagination.totalPages);
      currentBatchPageRef.current = pageToFetch + 1; // Increment page ref
    } catch (error) {
      console.error('Error fetching participants batch:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load participants');
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
    
    if (currentBatchPageRef.current === 1 && hasMorePages && !isLoadingBatch && allParticipants.length === 0 && !isFetchingRef.current) {
      fetchNextBatch();
    }
  }, [hasMorePages, isLoadingBatch, allParticipants.length, fetchNextBatch, filtersReady]);

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
  const paginatedParticipants = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return allParticipants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [allParticipants, currentPageIndex]);

  const handleEdit = (participant: Participant) => {
    navigate(`/participants/${participant.id}/edit`);
  };

  const handleCreate = () => {
    navigate('/participants/new');
  };

  const handleDelete = async (participant: Participant) => {
    if (window.confirm(`Are you sure you want to delete "${participant.name}"?`)) {
      deleteMutation.mutate(participant.id);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setCsvError('');
    
    try {
      await ParticipantService.exportParticipants(selectedGeographicAreaId);
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to export participants');
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
      const result = await ParticipantService.importParticipants(file);
      setImportResult(result);
      setShowImportResults(true);

      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['participants'] });
        // Reset batched loading
        setAllParticipants([]);
        currentBatchPageRef.current = 1; // Reset page ref
        setHasMorePages(true);
      }
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to import participants');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const isLoading = isLoadingBatch && currentBatchPageRef.current === 1;
  const loadedCount = allParticipants.length;
  const hasActiveFilters = propertyFilterQuery.tokens.length > 0;

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
        columnDefinitions={[
          {
            id: 'name',
            header: 'Name',
            cell: (item) => (
              <>
                <Link href={`/participants/${item.id}`}>
                  {item.name}
                </Link>
                {renderPopulationBadges(item.populations)}
              </>
            ),
            sortingField: 'name',
          },
          {
            id: 'email',
            header: 'Email',
            cell: (item) => item.email || '-',
            sortingField: 'email',
          },
          {
            id: 'phone',
            header: 'Phone',
            cell: (item) => item.phone || '-',
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
        items={paginatedParticipants}
        loading={isLoading}
        loadingText="Loading participants"
        sortingDisabled
        empty={
          <Box textAlign="center" color="inherit">
            <b>No participants</b>
            <Box padding={{ bottom: 's' }} variant="p" color="inherit">
              {hasActiveFilters ? 'No participants match your filters.' : 'No participants to display.'}
            </Box>
            {canCreate() && !hasActiveFilters && (
              <Button onClick={handleCreate}>Create participant</Button>
            )}
          </Box>
        }
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
                    Create participant
                  </Button>
                )}
              </SpaceBetween>
            }
          >
            <Box display="inline" fontSize="heading-l" fontWeight="bold">
              <SpaceBetween direction="horizontal" size="xs">
                <Box display="inline-block" variant="h1">
                  <SpaceBetween direction="horizontal" size="xs">
                      <span>Participants</span>
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
                  entityName="participants"
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
            pagesCount={Math.ceil(allParticipants.length / ITEMS_PER_PAGE)}
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
