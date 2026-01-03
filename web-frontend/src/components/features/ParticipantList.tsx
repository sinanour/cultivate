import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
import type { Participant } from '../../types';
import { ParticipantService } from '../../services/api/participant.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

const ITEMS_PER_PAGE = 10;

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

  const { data: participants = [], isLoading } = useQuery({
    queryKey: ['participants', selectedGeographicAreaId],
    queryFn: () => ParticipantService.getParticipants(undefined, undefined, selectedGeographicAreaId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ParticipantService.deleteParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['participants'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete participant.');
    },
  });

  // Client-side search
  const filteredParticipants = useMemo(() => {
    if (!filteringText) return participants;
    
    const searchTerm = filteringText.toLowerCase();
    return participants.filter(
      (p) =>
        p.name.toLowerCase().includes(searchTerm) ||
        (p.email && p.email.toLowerCase().includes(searchTerm))
    );
  }, [participants, filteringText]);

  // Pagination
  const paginatedParticipants = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return filteredParticipants.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredParticipants, currentPageIndex]);

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
      // Success - file download is triggered automatically
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to export participants');
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
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

      // Refresh list if any records were imported
      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['participants'] });
      }
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to import participants');
    } finally {
      setIsImporting(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
            counter={`(${filteredParticipants.length})`}
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
            Participants
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={Math.ceil(filteredParticipants.length / ITEMS_PER_PAGE)}
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
