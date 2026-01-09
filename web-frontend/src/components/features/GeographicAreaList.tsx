import { useState, useRef, useCallback } from 'react';
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
import TreeView, { type TreeViewProps } from '@cloudscape-design/components/tree-view';
import type { GeographicArea } from '../../types';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import { ImportResultsModal } from '../common/ImportResultsModal';
import { validateCSVFile } from '../../utils/csv.utils';
import type { ImportResult } from '../../types/csv.types';

interface TreeNode {
  id: string;
  text: string;
  data: GeographicArea;
  children?: TreeNode[];
  isLoading?: boolean;
}

export function GeographicAreaList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId, authorizedAreaIds } = useGlobalGeographicFilter();
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
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());

  // Fetch initial geographic areas with depth=1 (top-level + immediate children)
  const { data: geographicAreas = [], isLoading } = useQuery({
    queryKey: ['geographicAreas', selectedGeographicAreaId, 'depth-1'],
    queryFn: () => GeographicAreaService.getGeographicAreas(
      undefined, 
      undefined, 
      selectedGeographicAreaId, 
      undefined, 
      1  // depth=1 for lazy loading
    ),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => GeographicAreaService.deleteGeographicArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['geographicAreas'] });
      setDeleteError('');
      // Clear children cache on delete
      setChildrenCache(new Map());
    },
    onError: (error: Error) => {
      setDeleteError(error.message || 'Failed to delete geographic area. It may be referenced by venues or child areas.');
    },
  });

  // Fetch children for a specific node on demand
  const fetchChildren = useCallback(async (parentId: string) => {
    // Check cache first
    if (childrenCache.has(parentId)) {
      return childrenCache.get(parentId)!;
    }

    // Mark as loading
    setLoadingNodes(prev => new Set(prev).add(parentId));

    try {
      const children = await GeographicAreaService.getChildren(parentId);
      
      // Update cache
      setChildrenCache(prev => new Map(prev).set(parentId, children));
      
      return children;
    } finally {
      // Remove from loading
      setLoadingNodes(prev => {
        const next = new Set(prev);
        next.delete(parentId);
        return next;
      });
    }
  }, [childrenCache]);

  // Build tree structure from flat list with lazy loading support
  const buildTree = useCallback((areas: GeographicArea[]): TreeNode[] => {
    const areaMap = new Map<string, GeographicArea>();
    areas.forEach(area => areaMap.set(area.id, area));

    const rootNodes: TreeNode[] = [];
    const nodeMap = new Map<string, TreeNode>();

    // First pass: create nodes
    areas.forEach(area => {
      const node: TreeNode = {
        id: area.id,
        text: area.name,
        data: area,
        isLoading: loadingNodes.has(area.id),
      };

      // Check if we have cached children for this node
      const cachedChildren = childrenCache.get(area.id);
      if (cachedChildren) {
        // Build child nodes from cache
        node.children = cachedChildren.map(child => ({
          id: child.id,
          text: child.name,
          data: child,
          children: child.childCount && child.childCount > 0 ? [
            // Placeholder for unloaded children
            {
              id: `${child.id}-loading-placeholder`,
              text: 'Loading...',
              data: child,
            }
          ] : undefined,
        }));
      } else if (area.children && area.children.length > 0) {
        // Use children from initial fetch
        node.children = area.children.map(child => ({
          id: child.id,
          text: child.name,
          data: child,
          children: child.childCount && child.childCount > 0 ? [
            // Placeholder for unloaded children
            {
              id: `${child.id}-loading-placeholder`,
              text: 'Loading...',
              data: child,
            }
          ] : undefined,
        }));
      } else if (area.childCount && area.childCount > 0) {
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
          if (!parentNode.children) {
            parentNode.children = [];
          }
          // Only add if not already present
          if (!parentNode.children.find(c => c.id === node.id)) {
            parentNode.children.push(node);
          }
        } else {
          // Parent not in dataset (might be filtered out) - treat as root
          rootNodes.push(node);
        }
      }
    });

    return rootNodes;
  }, [childrenCache, loadingNodes]);

  const treeData = buildTree(geographicAreas);

  // Helper function to check if an area is a read-only ancestor
  const isReadOnlyAncestor = (areaId: string): boolean => {
    // If no authorization restrictions, no areas are read-only
    if (authorizedAreaIds.size === 0) {
      return false;
    }
    
    // If this area is directly authorized, it's not a read-only ancestor
    if (authorizedAreaIds.has(areaId)) {
      return false;
    }
    
    // If we have a filter active, check if it's an ancestor of the filtered area
    if (selectedGeographicAreaId) {
      const area = geographicAreas.find(a => a.id === areaId);
      if (!area) return false;
      
      // If this is the filtered area itself, it's not an ancestor
      if (areaId === selectedGeographicAreaId) {
        return false;
      }
      
      // Check if filtered area is a descendant of this area
      const isAncestor = geographicAreas.some(a => 
        a.id === selectedGeographicAreaId && 
        isDescendantOf(a, areaId, geographicAreas)
      );
      
      return isAncestor;
    }
    
    // No explicit filter, but user has restrictions
    // This area is displayed but not in authorizedAreaIds, so it must be a read-only ancestor
    return true;
  };

  const isDescendantOf = (area: GeographicArea, potentialAncestorId: string, areas: GeographicArea[]): boolean => {
    if (!area.parentGeographicAreaId) {
      return false;
    }
    
    if (area.parentGeographicAreaId === potentialAncestorId) {
      return true;
    }
    
    // Recursively check parent
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
      // Expanding - fetch children if not already loaded
      const node = findNodeById(treeData, id);
      if (node && node.data.childCount && node.data.childCount > 0) {
        // Check if children are not loaded yet (has placeholder or empty array)
        const hasPlaceholder = node.children && node.children.length > 0 && 
                              node.children[0].id.endsWith('-loading-placeholder');
        const isEmpty = node.children && node.children.length === 0;
        
        if (hasPlaceholder || isEmpty) {
          // Children not loaded yet - fetch them
          await fetchChildren(id);
          // The children are now in cache, which will trigger a re-render via state update
        }
      }
      
      setExpandedItems(prev => [...prev, id]);
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
              <span>Loading...</span>
            </SpaceBetween>
          </div>
        ),
      };
    }
    
    const area = node.data;
    
    // Determine if this area is a read-only ancestor
    const isAncestor = isReadOnlyAncestor(area.id);
    
    // Build action buttons - no View button
    const actionButtons = [];
    
    // Only show edit/delete for non-ancestor areas
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
            opacity: isAncestor ? 0.7 : 1, // Muted styling for ancestors
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
            {node.isLoading && (
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
