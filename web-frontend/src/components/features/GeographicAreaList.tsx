import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Button from '@cloudscape-design/components/button';
import Badge from '@cloudscape-design/components/badge';
import Modal from '@cloudscape-design/components/modal';
import Alert from '@cloudscape-design/components/alert';
import Box from '@cloudscape-design/components/box';
import { GeographicArea } from '../../types';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { GeographicAreaForm } from './GeographicAreaForm';
import { usePermissions } from '../../hooks/usePermissions';
import { buildGeographicAreaTree, TreeNode } from '../../utils/tree.utils';

export function GeographicAreaList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const [selectedArea, setSelectedArea] = useState<GeographicArea | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const { data: geographicAreas = [], isLoading } = useQuery({
    queryKey: ['geographicAreas'],
    queryFn: () => GeographicAreaService.getGeographicAreas(),
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

  const handleViewDetails = (area: GeographicArea) => {
    navigate(`/geographic-areas/${area.id}`);
  };

  const renderTreeNode = (node: TreeNode, level = 0): JSX.Element => {
    const area = node.data;
    return (
      <div key={node.id} style={{ marginLeft: `${level * 24}px` }}>
        <Box padding={{ vertical: 'xs' }}>
          <SpaceBetween direction="horizontal" size="s">
            <span style={{ fontWeight: level === 0 ? 'bold' : 'normal' }}>
              {node.text}
            </span>
            <Badge>{area.areaType}</Badge>
            <SpaceBetween direction="horizontal" size="xs">
              <Button
                variant="inline-link"
                onClick={() => handleViewDetails(area)}
              >
                View
              </Button>
              {canEdit() && (
                <Button
                  variant="inline-link"
                  onClick={() => handleEdit(area)}
                >
                  Edit
                </Button>
              )}
              {canDelete() && (
                <Button
                  variant="inline-link"
                  onClick={() => handleDelete(area)}
                >
                  Delete
                </Button>
              )}
            </SpaceBetween>
          </SpaceBetween>
        </Box>
        {node.children && node.children.length > 0 && (
          <div>
            {node.children.map((child) => renderTreeNode(child, level + 1))}
          </div>
        )}
      </div>
    );
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
      <Container
        header={
          <Header
            variant="h2"
            counter={`(${geographicAreas.length})`}
            actions={
              canCreate() && (
                <Button variant="primary" onClick={handleCreate}>
                  Create geographic area
                </Button>
              )
            }
          >
            Geographic Areas
          </Header>
        }
      >
        {isLoading ? (
          <Box textAlign="center" padding="l">
            Loading geographic areas...
          </Box>
        ) : treeData.length > 0 ? (
          <div>
            {treeData.map((node) => renderTreeNode(node))}
          </div>
        ) : (
          <Box textAlign="center" color="inherit">
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
      <Modal
        visible={isFormOpen}
        onDismiss={handleFormClose}
        size="large"
        header={selectedArea ? 'Edit Geographic Area' : 'Create Geographic Area'}
      >
        <GeographicAreaForm
          geographicArea={selectedArea}
          onSuccess={handleFormClose}
          onCancel={handleFormClose}
        />
      </Modal>
    </SpaceBetween>
  );
}
