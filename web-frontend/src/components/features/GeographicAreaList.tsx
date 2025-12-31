import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import TreeView, { type TreeViewProps } from '@cloudscape-design/components/tree-view';
import type { GeographicArea } from '../../types';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { GeographicAreaForm } from './GeographicAreaForm';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { buildGeographicAreaTree, type TreeNode } from '../../utils/tree.utils';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

export function GeographicAreaList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [selectedArea, setSelectedArea] = useState<GeographicArea | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: geographicAreas = [], isLoading } = useQuery({
    queryKey: ['geographicAreas', selectedGeographicAreaId],
    queryFn: () => GeographicAreaService.getGeographicAreas(undefined, undefined, selectedGeographicAreaId),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => GeographicAreaService.deleteGeographicArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      setDeleteError('');
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete geographic area. It may be referenced by venues or child areas.');
    },
  });

  const treeData = buildGeographicAreaTree(geographicAreas);

  // Expand all nodes by default when data loads
  useEffect(() => {
    if (geographicAreas.length > 0 && expandedItems.length === 0) {
      const getAllNodeIds = (nodes: TreeNode[]): string[] => {
        const ids: string[] = [];
        const traverse = (node: TreeNode) => {
          if (node.children && node.children.length > 0) {
            ids.push(node.id);
            node.children.forEach(traverse);
          }
        };
        nodes.forEach(traverse);
        return ids;
      };
      
      setExpandedItems(getAllNodeIds(treeData));
    }
  }, [geographicAreas, treeData, expandedItems.length]);

  const handleEdit = (area: GeographicArea) => {
    setSelectedArea(area);
    setIsFormOpen(true);
  };

  const handleCreate = () => {
    setSelectedArea(null);
    setIsFormOpen(true);
  };

  const handleDelete = async (area: GeographicArea) => {
    if (window.confirm(`Are you sure you want to delete "${area.name}"?`)) {
      deleteMutation.mutate(area.id);
    }
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setSelectedArea(null);
  };

  const handleExport = async () => {
    setIsExporting(true);
    setCsvError('');
    
    try {
      await GeographicAreaService.exportGeographicAreas();
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to export geographic areas');
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
      const result = await GeographicAreaService.importGeographicAreas(file);
      setImportResult(result);
      setShowImportResults(true);

      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      }
    } catch (error) {
      setCsvError(error instanceof Error ? error.message : 'Failed to import geographic areas');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // TreeView callback functions
  const getItemId = (node: TreeNode) => node.id;

  const getItemChildren = (node: TreeNode) => node.children || [];

  const handleToggleItem = (nodeId: string) => {
    setExpandedItems(prev => 
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  };

  const renderItem = (node: TreeNode): TreeViewProps.TreeItem => {
    const area = node.data;
    const hasChildren = node.children && node.children.length > 0;
    
    // Build action buttons - no View button
    const actionButtons = [];
    
    if (canEdit()) {
      actionButtons.push(
        <Button
          key="edit"
          variant="inline-link"
          onClick={(e) => {
            e.stopPropagation();
            handleEdit(area);
          }}
        >
          Edit
        </Button>
      );
    }
    
    if (canDelete()) {
      actionButtons.push(
        <Button
          key="delete"
          variant="inline-link"
          onClick={(e) => {
            e.stopPropagation();
            handleDelete(area);
          }}
        >
          Delete
        </Button>
      );
    }

    return {
      content: (
        <div
          onClick={() => hasChildren && handleToggleItem(node.id)}
          style={{
            cursor: hasChildren ? 'pointer' : 'default',
            transition: 'background-color 0.15s ease',
            padding: '8px 0',
          }}
          onMouseEnter={(e) => {
            if (hasChildren) {
              e.currentTarget.style.backgroundColor = 'rgba(0, 7, 22, 0.04)';
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <SpaceBetween direction="horizontal" size="s">
            <Link
              href={`/geographic-areas/${area.id}`}
              onFollow={(e) => {
                e.preventDefault();
                navigate(`/geographic-areas/${area.id}`);
              }}
            >
              {node.text}
            </Link>
            <Badge color={getAreaTypeBadgeColor(area.areaType)}>{area.areaType}</Badge>
          </SpaceBetween>
        </div>
      ),
      actions: (
        <SpaceBetween direction="horizontal" size="xs">
          {actionButtons}
        </SpaceBetween>
      ),
    };
  };

  return (
    <>
      <SpaceBetween size="l">
        {deleteError ? (
          <Alert
            key="error-alert"
            type="error"
            dismissible
            onDismiss={() => setDeleteError('')}
          >
            {deleteError}
          </Alert>
        ) : null}
        {csvError && (
          <Alert
            type="error"
            dismissible
            onDismiss={() => setCsvError('')}
          >
            {csvError}
          </Alert>
        )}
        <Container
          key="container"
          header={
            <Header
              variant="h2"
              counter={`(${geographicAreas.length})`}
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
                      Create geographic area
                    </Button>
                  )}
                </SpaceBetween>
              }
            >
              Geographic Areas
            </Header>
          }
        >
          {isLoading ? (
            <Box key="loading" textAlign="center" padding="l">
              Loading geographic areas...
            </Box>
          ) : treeData.length > 0 ? (
            <TreeView
              items={treeData}
              getItemId={getItemId}
              getItemChildren={getItemChildren}
              renderItem={renderItem}
              expandedItems={expandedItems}
              onItemToggle={(event) => {
                const { id, expanded } = event.detail;
                setExpandedItems(prev => 
                  expanded 
                    ? [...prev, id]
                    : prev.filter(itemId => itemId !== id)
                );
              }}
              connectorLines="vertical"
              ariaLabel="Geographic areas hierarchy"
            />
          ) : (
            <Box key="empty-state" textAlign="center" color="inherit">
              <b>No geographic areas</b>
              <Box padding={{ bottom: 's' }} variant="p" color="inherit">
                No geographic areas to display.
              </Box>
              {canCreate() && (
                <Button onClick={handleCreate}>Create geographic area</Button>
              )}
            </Box>
          )}
        </Container>
      </SpaceBetween>
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        size="large"
        header={selectedArea ? 'Edit Geographic Area' : 'Create Geographic Area'}
      >
        {isFormOpen && (
          <GeographicAreaForm
            geographicArea={selectedArea}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        )}
      </Modal>
      <ImportResultsModal
        visible={showImportResults}
        result={importResult}
        onDismiss={() => setShowImportResults(false)}
      />
    </>
  );
}
