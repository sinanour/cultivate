import { useState, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Badge from '@cloudscape-design/components/badge';
import Link from '@cloudscape-design/components/link';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import Grid from '@cloudscape-design/components/grid';
import Spinner from '@cloudscape-design/components/spinner';
import TreeView, { type TreeViewProps } from '@cloudscape-design/components/tree-view';
import type { GeographicArea } from '../../types';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { ProgressIndicator } from '../common/ProgressIndicator';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';
import styles from './GeographicAreaList.module.scss';

const BATCH_SIZE = 100;

interface TreeNode {
  id: string;
  text: string;
  data: GeographicArea;
  children?: TreeNode[];
  isLoading?: boolean;
  loadingProgress?: { loaded: number; total: number };
}

interface BatchLoadingState {
  [nodeId: string]: {
    currentPage: number;
    totalPages: number;
    loadedChildren: GeographicArea[];
    isLoading: boolean;
    isCancelled: boolean;
  };
}

export function GeographicAreaList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [deleteError, setDeleteError] = useState('');
  const [expandedItems, setExpandedItems] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Cache for fetched children to avoid redundant API calls
  const [childrenCache, setChildrenCache] = useState<Map<string, GeographicArea[]>>(new Map());
  const [batchLoadingState, setBatchLoadingState] = useState<BatchLoadingState>({});

  // Clear children cache and batch loading state when global filter changes
  useEffect(() => {
    setChildrenCache(new Map());
    setBatchLoadingState({});
    setExpandedItems([]); // Also reset expanded items to start fresh
  }, [selectedGeographicAreaId]);

  // Cancel loading handler for a specific node
  const handleCancelNodeLoading = useCallback((parentId: string) => {
    setBatchLoadingState(prev => {
      const currentState = prev[parentId];
      if (!currentState) return prev;
      
      return {
        ...prev,
        [parentId]: {
          ...currentState,
          isCancelled: true,
          isLoading: false,
        },
      };
    });
  }, []);

  // Resume loading handler for a specific node
  const handleResumeNodeLoading = useCallback((parentId: string) => {
    setBatchLoadingState(prev => {
      const currentState = prev[parentId];
      if (!currentState) return prev;
      
      return {
        ...prev,
        [parentId]: {
          ...currentState,
          isCancelled: false,
        },
      };
    });
    
    // Trigger next batch fetch
    setTimeout(() => loadNextBatch(parentId), 100);
  }, []);

  // Fetch initial geographic areas with depth=1 (top-level + immediate children)
  const { data: geographicAreasResponse, isLoading } = useQuery({
    queryKey: ['geographicAreas', selectedGeographicAreaId, 'depth-1'],
    queryFn: () => GeographicAreaService.getGeographicAreas(
      undefined,  // page
      undefined,  // limit
      selectedGeographicAreaId,  // geographicAreaId
      1  // depth=1 for lazy loading
    ),
  });

  // When a filter is active, also fetch the filtered area itself
  const { data: filteredArea } = useQuery({
    queryKey: ['geographicArea', selectedGeographicAreaId],
    queryFn: () => GeographicAreaService.getGeographicAreaById(selectedGeographicAreaId!),
    enabled: !!selectedGeographicAreaId,
  });

  // Fetch ancestors when filter is active
  const { data: ancestors = [] } = useQuery({
    queryKey: ['geographicAreaAncestors', selectedGeographicAreaId],
    queryFn: () => GeographicAreaService.getAncestors(selectedGeographicAreaId!),
    enabled: !!selectedGeographicAreaId,
  });

  // Extract array from response (handle both paginated and non-paginated)
  const descendantAreas = geographicAreasResponse 
    ? (Array.isArray(geographicAreasResponse) ? geographicAreasResponse : geographicAreasResponse.data)
    : [];

  // Combine filtered area, ancestors, and descendants into a single array with deduplication
  const geographicAreas = selectedGeographicAreaId && filteredArea
    ? (() => {
        // Create a map to deduplicate by ID
        const areaMap = new Map<string, GeographicArea>();
        
        // Add ancestors
        ancestors.forEach(area => areaMap.set(area.id, area));
        
        // Add filtered area itself
        areaMap.set(filteredArea.id, filteredArea);
        
        // Add descendants
        descendantAreas.forEach(area => areaMap.set(area.id, area));
        
        // Return deduplicated array
        return Array.from(areaMap.values());
      })()
    : descendantAreas;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => GeographicAreaService.deleteGeographicArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      setDeleteError('');
      // Clear children cache on delete
      setChildrenCache(new Map());
      setBatchLoadingState({});
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete geographic area. It may be referenced by venues or child areas.');
    },
  });

  // Fetch children for a specific node with batched loading support
  const fetchChildrenBatch = useCallback(async (parentId: string, page: number = 1) => {
    try {
      const response = await GeographicAreaService.getChildrenPaginated(parentId, page, BATCH_SIZE, selectedGeographicAreaId);
      return response;
    } catch (error) {
      console.error('Error fetching children batch:', error);
      throw error;
    }
  }, [selectedGeographicAreaId]);

  // Start or continue batched loading for a node
  const loadChildrenBatched = useCallback(async (parentId: string) => {
    // Check if already in cache
    if (childrenCache.has(parentId)) {
      return;
    }

    // Check if already loading
    const currentState = batchLoadingState[parentId];
    if (currentState?.isLoading) {
      return;
    }

    // Start loading first batch
    setBatchLoadingState(prev => ({
      ...prev,
      [parentId]: {
        currentPage: 1,
        totalPages: 1,
        loadedChildren: [],
        isLoading: true,
        isCancelled: false,
      },
    }));

    try {
      const response = await fetchChildrenBatch(parentId, 1);
      
      setBatchLoadingState(prev => ({
        ...prev,
        [parentId]: {
          currentPage: 1,
          totalPages: response.pagination.totalPages,
          loadedChildren: response.data,
          isLoading: false,
          isCancelled: false,
        },
      }));

      // If only one page, cache immediately
      if (response.pagination.totalPages === 1) {
        setChildrenCache(prev => {
          const newCache = new Map(prev);
          newCache.set(parentId, response.data);
          return newCache;
        });
        setBatchLoadingState(prev => {
          const newState = { ...prev };
          delete newState[parentId];
          return newState;
        });
      }
    } catch (error) {
      setBatchLoadingState(prev => {
        const newState = { ...prev };
        delete newState[parentId];
        return newState;
      });
    }
  }, [childrenCache, batchLoadingState, fetchChildrenBatch]);

  // Continue loading next batch for a node
  const loadNextBatch = useCallback(async (parentId: string) => {
    const currentState = batchLoadingState[parentId];
    if (!currentState || currentState.isLoading || currentState.isCancelled) {
      return;
    }

    const nextPage = currentState.currentPage + 1;
    if (nextPage > currentState.totalPages) {
      // All batches loaded, move to cache
      setChildrenCache(prev => {
        const newCache = new Map(prev);
        newCache.set(parentId, currentState.loadedChildren);
        return newCache;
      });
      setBatchLoadingState(prev => {
        const newState = { ...prev };
        delete newState[parentId];
        return newState;
      });
      return;
    }

    setBatchLoadingState(prev => ({
      ...prev,
      [parentId]: {
        ...currentState,
        isLoading: true,
      },
    }));

    try {
      const response = await fetchChildrenBatch(parentId, nextPage);
      
      const allLoadedChildren = [...currentState.loadedChildren, ...response.data];
      
      setBatchLoadingState(prev => ({
        ...prev,
        [parentId]: {
          currentPage: nextPage,
          totalPages: response.pagination.totalPages,
          loadedChildren: allLoadedChildren,
          isLoading: false,
          isCancelled: false,
        },
      }));

      // If this was the last page, move to cache
      if (nextPage >= response.pagination.totalPages) {
        setChildrenCache(prev => {
          const newCache = new Map(prev);
          newCache.set(parentId, allLoadedChildren);
          return newCache;
        });
        setBatchLoadingState(prev => {
          const newState = { ...prev };
          delete newState[parentId];
          return newState;
        });
      } else {
        // Auto-load next batch after a short delay (only if not cancelled)
        if (!currentState.isCancelled) {
          setTimeout(() => loadNextBatch(parentId), 100);
        }
      }
    } catch (error) {
      setBatchLoadingState(prev => ({
        ...prev,
        [parentId]: {
          ...currentState,
          isLoading: false,
        },
      }));
    }
  }, [batchLoadingState, fetchChildrenBatch]);

  // Build tree structure from flat list with lazy loading support
  const buildTree = useCallback((areas: GeographicArea[]): TreeNode[] => {
    const areaMap = new Map<string, GeographicArea>();
    areas.forEach(area => areaMap.set(area.id, area));

    const rootNodes: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // Helper function to recursively build a node with its cached children
    const buildNodeWithCache = (area: GeographicArea): TreeNode => {
      const loadingState = batchLoadingState[area.id];
      const node: TreeNode = {
        id: area.id,
        text: area.name,
        data: area,
        isLoading: loadingState?.isLoading || false,
      };

      // Add loading progress if batched loading is in progress
      if (loadingState && loadingState.totalPages > 1) {
        node.loadingProgress = {
          loaded: loadingState.loadedChildren.length,
          total: loadingState.totalPages * BATCH_SIZE, // Approximate
        };
      }

      // Check if we have cached children for this node
      const cachedChildren = childrenCache.get(area.id);
      const batchedChildren = loadingState?.loadedChildren;

      if (cachedChildren && cachedChildren.length > 0) {
        // Build child nodes from cache recursively
        node.children = cachedChildren.map(child => buildNodeWithCache(child));
      } else if (batchedChildren && batchedChildren.length > 0) {
        // Build child nodes from batched loading state
        node.children = batchedChildren.map(child => buildNodeWithCache(child));
      } else if (area.children && area.children.length > 0) {
        // Use children from initial fetch recursively
        node.children = area.children.map(child => buildNodeWithCache(child));
      } else if (area.childCount && area.childCount > 0 && !loadingState) {
        // Has children but not loaded yet - add placeholder to enable expansion
        node.children = [
          {
            id: `${area.id}-loading-placeholder`,
            text: 'Loading...',
            data: area,
          }
        ];
      }
      // If childCount is 0 or undefined, children remains undefined (leaf node)

      return node;
    };

    // First pass: create nodes
    areas.forEach(area => {
      const node = buildNodeWithCache(area);
      nodeMap.set(area.id, node);
    });

    // Second pass: build hierarchy
    areas.forEach(area => {
      const node = nodeMap.get(area.id)!;
      
      if (!area.parentGeographicAreaId) {
        // Root node
        rootNodes.push(node);
      } else {
        // Child node - add to parent if parent exists in current dataset
        const parentNode = nodeMap.get(area.parentGeographicAreaId);
        if (parentNode) {
          // Replace the entire children array from cache if available
          const cachedChildren = childrenCache.get(area.parentGeographicAreaId);
          const batchedChildren = batchLoadingState[area.parentGeographicAreaId]?.loadedChildren;
          
          if (cachedChildren) {
            // Parent has cached children - rebuild from cache
            parentNode.children = cachedChildren.map(child => buildNodeWithCache(child));
          } else if (batchedChildren) {
            // Parent has batched children - rebuild from batched state
            parentNode.children = batchedChildren.map(child => buildNodeWithCache(child));
          } else if (!parentNode.children) {
            parentNode.children = [];
          }
          // Only add if not already present (for non-cached scenarios)
          if (!cachedChildren && !batchedChildren && !parentNode.children.find(c => c.id === node.id)) {
            parentNode.children.push(node);
          }
        } else {
          // Parent not in dataset (might be filtered out) - treat as root
          rootNodes.push(node);
        }
      }
    });

    return rootNodes;
  }, [childrenCache, batchLoadingState]);

  const treeData = buildTree(geographicAreas);

  // Helper function to check if an area is a read-only ancestor
  // With backend authorization, we no longer need frontend checks
  // All areas returned by backend are accessible
  const isReadOnlyAncestor = (_areaId: string): boolean => {
    return false; // Backend handles authorization - no frontend read-only checks needed
  };

  const isDescendantOf = (area: GeographicArea, potentialAncestorId: string, areas: GeographicArea[]): boolean => {
    if (!area.parentGeographicAreaId) {
      return false;
    }
    
    if (area.parentGeographicAreaId === potentialAncestorId) {
      return true;
    }
    
    const parent = areas.find(a => a.id === area.parentGeographicAreaId);
    if (!parent) return false;
    
    return isDescendantOf(parent, potentialAncestorId, areas);
  };

  const handleEdit = (area: GeographicArea) => {
    navigate(`/geographic-areas/${area.id}/edit`);
  };

  const handleCreate = () => {
    navigate('/geographic-areas/new');
  };

  const handleDelete = async (area: GeographicArea) => {
    if (window.confirm(`Are you sure you want to delete "${area.name}"?`)) {
      deleteMutation.mutate(area.id);
    }
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
        // Clear children cache on import
        setChildrenCache(new Map());
        setBatchLoadingState({});
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

  const handleToggleItem = async (event: { detail: { id: string; expanded: boolean } }) => {
    const { id, expanded } = event.detail;
    
    if (expanded) {
      // Add to expanded items first for immediate UI feedback
      setExpandedItems(prev => [...prev, id]);
      
      // Fetch children if not already loaded
      const node = findNodeById(treeData, id);
      if (node && node.data.childCount && node.data.childCount > 0) {
        // Check if children are not loaded yet (has placeholder or not in cache)
        const hasPlaceholder = node.children && node.children.length > 0 && 
                              node.children[0].id.endsWith('-loading-placeholder');
        const notInCache = !childrenCache.has(id);
        const notBatchLoading = !batchLoadingState[id];
        
        if ((hasPlaceholder || notInCache) && notBatchLoading) {
          // Children not loaded yet - start batched loading
          await loadChildrenBatched(id);
          // Start auto-loading next batches if needed
          setTimeout(() => loadNextBatch(id), 100);
        }
      }
    } else {
      // Collapsing
      setExpandedItems(prev => prev.filter(itemId => itemId !== id));
    }
  };

  const findNodeById = (nodes: TreeNode[], id: string): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNodeById(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const renderItem = (node: TreeNode): TreeViewProps.TreeItem => {
    // Skip rendering placeholder nodes
    if (node.id.endsWith('-loading-placeholder')) {
      return {
        content: (
          <div style={{ padding: '8px 0', opacity: 0.5 }}>
            <SpaceBetween direction="horizontal" size="xs">
              <Spinner size="normal" variant="disabled" />
              <span className={styles.loadingText}>Loading...</span>
            </SpaceBetween>
          </div>
        ),
      };
    }
    
    const area = node.data;
    const isAncestor = isReadOnlyAncestor(area.id);
    const loadingState = batchLoadingState[area.id];
    
    // Build action buttons
    const actionButtons = [];
    
    if (canEdit() && !isAncestor) {
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
    
    if (canDelete() && !isAncestor) {
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
          style={{
            padding: '8px 0',
            opacity: isAncestor ? 0.7 : 1,
          }}
        >
          <SpaceBetween direction="horizontal" size="xs">
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
            {isAncestor && (
              <Badge color="grey">Read-Only</Badge>
            )}
            {loadingState && node.loadingProgress && (
              <div onClick={(e) => e.stopPropagation()}>
                <ProgressIndicator
                  loadedCount={node.loadingProgress.loaded}
                  totalCount={node.loadingProgress.total}
                  entityName="children"
                  onCancel={() => handleCancelNodeLoading(area.id)}
                  onResume={() => handleResumeNodeLoading(area.id)}
                  isCancelled={loadingState.isCancelled}
                />
              </div>
            )}
            {loadingState && !loadingState.isCancelled && loadingState.isLoading && !node.loadingProgress && (
              <Badge color="blue">Loading...</Badge>
            )}
          </SpaceBetween>
        </div>
      ),
      actions: actionButtons.length > 0 ? (
        <SpaceBetween direction="horizontal" size="xs">
          {actionButtons}
        </SpaceBetween>
      ) : undefined,
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
              variant="h1"
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
            <Box key="loading" padding="l">
              <Grid gridDefinition={[{ colspan: 12 }]}>
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                  <Spinner size="normal" variant="disabled" />
                  <span className={styles.loadingText}>Loading geographic areas</span>
                </div>
              </Grid>
            </Box>
          ) : treeData.length > 0 ? (
            <TreeView
              items={treeData}
              getItemId={getItemId}
              getItemChildren={getItemChildren}
              renderItem={renderItem}
              expandedItems={expandedItems}
              onItemToggle={handleToggleItem}
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
      <ImportResultsModal
        visible={showImportResults}
        result={importResult}
        onDismiss={() => setShowImportResults(false)}
      />
    </>
  );
}
