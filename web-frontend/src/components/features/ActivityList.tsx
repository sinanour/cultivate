import { useState, useMemo, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Table from '@cloudscape-design/components/table';
import Box from '@cloudscape-design/components/box';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Header from '@cloudscape-design/components/header';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Select from '@cloudscape-design/components/select';
import Pagination from '@cloudscape-design/components/pagination';
import Alert from '@cloudscape-design/components/alert';
import type { Activity } from '../../types';
import { ActivityService } from '../../services/api/activity.service';
import { ActivityTypeService } from '../../services/api/activity-type.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { formatDate } from '../../utils/date.utils';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

const ITEMS_PER_PAGE = 10;

export function ActivityList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [deleteError, setDeleteError] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['activities', selectedGeographicAreaId],
    queryFn: () => ActivityService.getActivities(undefined, undefined, selectedGeographicAreaId),
  });

  const { data: activityTypes = [] } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ActivityService.deleteActivity(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['activities'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete activity.');
    },
  });

  // Filtering
  const filteredActivities = useMemo(() => {
    let filtered = activities;
    
    if (typeFilter) {
      filtered = filtered.filter((a) => a.activityTypeId === typeFilter);
    }
    
    if (statusFilter) {
      filtered = filtered.filter((a) => a.status === statusFilter);
    }
    
    return filtered;
  }, [activities, typeFilter, statusFilter]);

  // Pagination
  const paginatedActivities = useMemo(() => {
    const startIndex = (currentPageIndex - 1) * ITEMS_PER_PAGE;
    return filteredActivities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredActivities, currentPageIndex]);

  const typeFilterOptions = [
    { label: 'All types', value: '' },
    ...activityTypes.map((t) => ({ label: t.name, value: t.id })),
  ];

  const statusFilterOptions = [
    { label: 'All statuses', value: '' },
    { label: 'Planned', value: 'PLANNED' },
    { label: 'Active', value: 'ACTIVE' },
    { label: 'Completed', value: 'COMPLETED' },
    { label: 'Cancelled', value: 'CANCELLED' },
  ];

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
              {typeFilter || statusFilter ? 'No activities match your filters.' : 'No activities to display.'}
            </Box>
            {canCreate() && !typeFilter && !statusFilter && (
              <Button onClick={handleCreate}>Create activity</Button>
            )}
          </Box>
        }
        filter={
          <SpaceBetween direction="horizontal" size="s">
            <Select
              selectedOption={typeFilterOptions.find((o) => o.value === typeFilter) || typeFilterOptions[0]}
              onChange={({ detail }) => {
                setTypeFilter(detail.selectedOption.value || '');
                setCurrentPageIndex(1);
              }}
              options={typeFilterOptions}
            />
            <Select
              selectedOption={statusFilterOptions.find((o) => o.value === statusFilter) || statusFilterOptions[0]}
              onChange={({ detail }) => {
                setStatusFilter(detail.selectedOption.value || '');
                setCurrentPageIndex(1);
              }}
              options={statusFilterOptions}
            />
          </SpaceBetween>
        }
        header={
          <Header
            counter={`(${filteredActivities.length})`}
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
            Activities
          </Header>
        }
        pagination={
          <Pagination
            currentPageIndex={currentPageIndex}
            pagesCount={Math.ceil(filteredActivities.length / ITEMS_PER_PAGE)}
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
