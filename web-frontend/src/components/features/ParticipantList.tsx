import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Link from '@cloudscape-design/components/link';
import TextFilter from '@cloudscape-design/components/text-filter';
import Pagination from '@cloudscape-design/components/pagination';
import Alert from '@cloudscape-design/components/alert';
import Spinner from '@cloudscape-design/components/spinner';
import type { Participant } from '../../types';
import { ParticipantService } from '../../services/api/participant.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

const ITEMS_PER_PAGE = 10;
const BATCH_SIZE = 100;

export function ParticipantList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [deleteError, setDeleteError] = useState('');
  const [filteringText, setFilteringText] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isFetchingRef = useRef(false); // Track if we're currently in a fetch cycle

  // Batched loading state
  const [allParticipants, setAllParticipants] = useState<Participant[]>([]);
  const [currentBatchPage, setCurrentBatchPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoadingBatch, setIsLoadingBatch] = useState(false);
  const [loadingError, setLoadingError] = useState<string | undefined>();
  const [hasMorePages, setHasMorePages] = useState(true);
  const [isCancelled, setIsCancelled] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ParticipantService.deleteParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      setDeleteError('');
      // Reset batched loading
      setAllParticipants([]);
      setCurrentBatchPage(1);
      setHasMorePages(true);
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete participant.');
    },
  });

  // Reset state when filters change
  useEffect(() => {
    setAllParticipants([]);
    setCurrentBatchPage(1);
    setTotalCount(0);
    setIsLoadingBatch(false);
    setLoadingError(undefined);
    setHasMorePages(true);
    setIsCancelled(false);
    isFetchingRef.current = false; // Reset fetch tracking
  }, [selectedGeographicAreaId, filteringText]);

  // Function to fetch next batch
  const fetchNextBatch = useCallback(async () => {
    if (isLoadingBatch || !hasMorePages || isFetchingRef.current || isCancelled) return;

    isFetchingRef.current = true;
    setIsLoadingBatch(true);
    setLoadingError(undefined);

    try {
      const response = await ParticipantService.getParticipantsPaginated(
        currentBatchPage,
        BATCH_SIZE,
        selectedGeographicAreaId,
        filteringText || undefined
      );
      
      setAllParticipants(prev => [...prev, ...response.data]);
      setTotalCount(response.pagination.total);
      setHasMorePages(currentBatchPage < response.pagination.totalPages);
      setCurrentBatchPage(prev => prev + 1);
    } catch (error) {
      console.error('Error fetching participants batch:', error);
      setLoadingError(error instanceof Error ? error.message : 'Failed to load participants');
    } finally {
      setIsLoadingBatch(false);
      isFetchingRef.current = false;
    }
  }, [currentBatchPage, isLoadingBatch, hasMorePages, selectedGeographicAreaId, filteringText, isCancelled]);

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
    // Trigger next batch fetch
    fetchNextBatch();
  }, [fetchNextBatch]);

  // Fetch first batch on mount or when dependencies change
  useEffect(() => {
    if (currentBatchPage === 1 && hasMorePages && !isLoadingBatch && allParticipants.length === 0 && !isFetchingRef.current) {
      fetchNextBatch();
    }
  }, [currentBatchPage, hasMorePages, isLoadingBatch, allParticipants.length, fetchNextBatch]);

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
        setCurrentBatchPage(1);
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

  const isLoading = isLoadingBatch && currentBatchPage === 1;
  const loadedCount = allParticipants.length;

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
              <Link href={`/participants/${item.id}`}>
                {item.name}
              </Link>
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
              {filteringText ? 'No participants match your search.' : 'No participants to display.'}
            </Box>
            {canCreate() && !filteringText && (
              <Button onClick={handleCreate}>Create participant</Button>
            )}
          </Box>
        }
        filter={
          <TextFilter
            filteringText={filteringText}
            filteringPlaceholder="Search participants by name or email"
            filteringAriaLabel="Filter participants"
            onChange={({ detail }) => {
              setFilteringText(detail.filteringText);
              setCurrentPageIndex(1);
            }}
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
                <span>Participants</span>
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
                {isCancelled && loadedCount < totalCount && totalCount > 0 && (
                  <Button
                    variant="icon"
                    iconName="refresh"
                    onClick={handleResumeLoading}
                    ariaLabel="Resume loading participants"
                  />
                )}
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
