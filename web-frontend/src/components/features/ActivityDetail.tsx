import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import Container from "@cloudscape-design/components/container";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import ColumnLayout from "@cloudscape-design/components/column-layout";
import Box from "@cloudscape-design/components/box";
import Table from "@cloudscape-design/components/table";
import Link from "@cloudscape-design/components/link";
import Spinner from "@cloudscape-design/components/spinner";
import Alert from "@cloudscape-design/components/alert";
import Badge from "@cloudscape-design/components/badge";
import Modal from "@cloudscape-design/components/modal";
import { ActivityService } from "../../services/api/activity.service";
import type { Activity } from "../../types";
import { AssignmentService } from "../../services/api/assignment.service";
import { AssignmentForm } from "./AssignmentForm";
import { ActivityVenueHistoryTable } from "./ActivityVenueHistoryTable";
import { ActivityVenueHistoryForm } from "./ActivityVenueHistoryForm";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../hooks/useAuth";
import { ParticipantDisplay } from "../common/ParticipantDisplay";
import { formatDate } from "../../utils/date.utils";
import { renderPopulationBadges } from "../../utils/population-badge.utils";
import { ResponsiveButton } from "../common/ResponsiveButton";
import { PullToRefreshWrapper } from "../common/PullToRefreshWrapper";
import {
  invalidatePageCaches,
  getDetailPageQueryKeys,
} from "../../utils/cache-invalidation.utils";
import Button from "@cloudscape-design/components/button";
import ButtonDropdown from "@cloudscape-design/components/button-dropdown";
import { ConfirmationDialog } from "../common/ConfirmationDialog";
import { MergeInitiationModal } from '../merge/MergeInitiationModal';

export function ActivityDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { canEdit } = usePermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [isAssignmentFormOpen, setIsAssignmentFormOpen] = useState(false);
  const [isVenueFormOpen, setIsVenueFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [confirmUpdateStatus, setConfirmUpdateStatus] = useState<string | null>(null);
  const [confirmRemoveAssignment, setConfirmRemoveAssignment] = useState<string | null>(null);
  const [confirmDeleteVenue, setConfirmDeleteVenue] = useState<string | null>(null);
  const [confirmDeleteActivity, setConfirmDeleteActivity] = useState(false);
  const [showMergeModal, setShowMergeModal] = useState(false);

  const {
    data: activity,
    isLoading,
    error: loadError,
    refetch,
  } = useQuery({
    queryKey: ["activity", id],
    queryFn: () => ActivityService.getActivity(id!),
    enabled: !!id,
  });

  const { data: assignments = [], refetch: refetchAssignments } = useQuery({
    queryKey: ["activity-participants", id],
    queryFn: () => ActivityService.getActivityParticipants(id!),
    enabled: !!id,
  });

  const {
    data: venueHistory = [],
    isLoading: isLoadingVenues,
    refetch: refetchVenueHistory,
  } = useQuery({
    queryKey: ["activity-venues", id],
    queryFn: () => ActivityService.getActivityVenues(id!),
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: (data: {
      id: string;
      status: string;
      startDate?: string;
      endDate?: string | null;
      version: number;
    }) =>
      ActivityService.updateActivity(data.id, {
        status: data.status as Activity["status"],
        startDate: data.startDate,
        endDate: data.endDate,
        version: data.version,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity", id] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update activity status");
    },
  });

  const removeAssignmentMutation = useMutation({
    mutationFn: (participantId: string) =>
      AssignmentService.removeParticipant(id!, participantId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["activity-participants", id],
      });
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to remove assignment");
    },
  });

  const addVenueMutation = useMutation({
    mutationFn: (data: { venueId: string; effectiveFrom: string | null }) =>
      ActivityService.addActivityVenue(id!, data.venueId, data.effectiveFrom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-venues", id] });
      setIsVenueFormOpen(false);
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to add venue association");
    },
  });

  const deleteVenueMutation = useMutation({
    mutationFn: (venueHistoryId: string) =>
      ActivityService.deleteActivityVenue(id!, venueHistoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activity-venues", id] });
      setError("");
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to remove venue association");
    },
  });

  const handleUpdateStatus = (newStatus: string) => {
    setConfirmUpdateStatus(newStatus);
  };

  const handleConfirmUpdateStatus = () => {
    if (confirmUpdateStatus) {
      const updateData: {
        id: string;
        status: string;
        startDate?: string;
        endDate?: string | null;
        version: number;
      } = {
        id: activity!.id,
        status: confirmUpdateStatus,
        version: activity!.version,
      };

      // When marking as COMPLETED or CANCELLED, implicitly set endDate to today if null
      if (confirmUpdateStatus === "COMPLETED" || confirmUpdateStatus === "CANCELLED") {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayISO = today.toISOString();

        // Set endDate to today if null (converts ongoing to finite)
        if (!activity!.endDate) {
          updateData.endDate = todayISO;
        }

        // For CANCELLED status, also set startDate to today if it's in the future
        if (confirmUpdateStatus === "CANCELLED") {
          const activityStartDate = new Date(activity!.startDate);
          if (activityStartDate > today) {
            updateData.startDate = todayISO;
          }
        }
      }

      updateStatusMutation.mutate(updateData);
      setConfirmUpdateStatus(null);
    }
  };

  const handleRemoveAssignment = (participantId: string) => {
    setConfirmRemoveAssignment(participantId);
  };

  const handleConfirmRemoveAssignment = () => {
    if (confirmRemoveAssignment) {
      removeAssignmentMutation.mutate(confirmRemoveAssignment);
      setConfirmRemoveAssignment(null);
    }
  };

  const handleAddVenue = () => {
    setIsVenueFormOpen(true);
  };

  const handleDeleteVenue = (venueHistoryId: string) => {
    setConfirmDeleteVenue(venueHistoryId);
  };

  const handleConfirmDeleteVenue = () => {
    if (confirmDeleteVenue) {
      deleteVenueMutation.mutate(confirmDeleteVenue);
      setConfirmDeleteVenue(null);
    }
  };

  const handleConfirmDeleteActivity = () => {
    ActivityService.deleteActivity(id!)
      .then(() => {
        navigate("/activities");
      })
      .catch((err) => {
        setError(err.message || "Failed to remove activity");
      });
    setConfirmDeleteActivity(false);
  };

  const handleSubmitVenue = async (data: {
    venueId: string;
    effectiveFrom: string | null;
  }) => {
    await addVenueMutation.mutateAsync(data);
  };

  // Build dropdown items based on activity status
  const buildDropdownItems = () => {
    if (!activity) return [];

    const items = [];

    // Add lifecycle actions based on current status
    if (activity.status !== 'COMPLETED') {
      items.push({
        id: "complete",
        text: "Mark Complete",
        iconName: "status-positive" as const
      });
    }
    if (activity.status !== 'CANCELLED') {
      items.push({
        id: "cancel",
        text: "Cancel Activity",
        iconName: "status-negative" as const
      });
    }
    if (activity.status !== 'ACTIVE') {
      items.push({
        id: "active",
        text: "Set Active",
        iconName: "status-in-progress" as const
      });
    }

    // Add standard actions
    items.push({ id: "merge", text: "Merge", iconName: "shrink" as const });
    items.push({ id: "delete", text: "Remove", iconName: "remove" as const });

    return items;
  };

  // Handle dropdown item clicks
  const handleItemClick = (itemId: string) => {
    switch (itemId) {
      case "complete":
        handleUpdateStatus("COMPLETED");
        break;
      case "cancel":
        handleUpdateStatus("CANCELLED");
        break;
      case "active":
        handleUpdateStatus("ACTIVE");
        break;
      case "merge":
        setShowMergeModal(true);
        break;
      case "delete":
        setConfirmDeleteActivity(true);
        break;
      default:
        console.warn(`Unknown action: ${itemId}`);
    }
  };

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    if (!id) return;

    // Invalidate caches
    await invalidatePageCaches(queryClient, {
      queryKeys: getDetailPageQueryKeys("activity", id),
      clearLocalStorage: false,
    });

    // Trigger refetch of all queries
    await Promise.all([refetch(), refetchAssignments(), refetchVenueHistory()]);
  }, [id, queryClient, refetch, refetchAssignments, refetchVenueHistory]);

  if (isLoading) {
    return (
      <Box textAlign="center" padding="xxl">
        <Spinner size="large" />
      </Box>
    );
  }

  if (loadError || !activity) {
    return (
      <Alert type="error">
        Failed to load activity details.{" "}
        {loadError instanceof Error ? loadError.message : ""}
      </Alert>
    );
  }

  const existingDates = venueHistory.map((v) => v.effectiveFrom);

  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
      <SpaceBetween size="l">
        {error && (
          <Alert type="error" dismissible onDismiss={() => setError("")}>
            {error}
          </Alert>
        )}

        <Container
          header={
            <Header
              variant="h2"
              actions={
                <SpaceBetween direction="horizontal" size="xs">
                  <ResponsiveButton
                    onClick={() => navigate("/activities")}
                    mobileIcon="arrow-left"
                    mobileAriaLabel="Back to activities list"
                  >
                    Back to Activities
                  </ResponsiveButton>
                  {canEdit() && (
                    <ButtonDropdown
                      variant="primary"
                      mainAction={{
                        text: "Edit",
                        onClick: () => navigate(`/activities/${id}/edit`)
                      }}
                      items={buildDropdownItems()}
                      onItemClick={({ detail }) => handleItemClick(detail.id)}
                      ariaLabel="Activity actions"
                    />
                  )}
                </SpaceBetween>
              }
            >
              {activity.name}
            </Header>
          }
        >
          <ColumnLayout columns={2} variant="text-grid">
            <div>
              <Box variant="awsui-key-label">Activity Type</Box>
              <div>{activity.activityType?.name || "-"}</div>
            </div>
            <div>
              <Box variant="awsui-key-label">Status</Box>
              <div>
                <SpaceBetween direction="horizontal" size="xs">
                  <Badge
                    color={
                      activity.status === "PLANNED"
                        ? "blue"
                        : activity.status === "ACTIVE"
                          ? "green"
                          : activity.status === "CANCELLED"
                            ? "red"
                            : "grey"
                    }
                  >
                    {activity.status}
                  </Badge>
                  {activity.isOngoing && <Badge color="blue">Ongoing</Badge>}
                </SpaceBetween>
              </div>
            </div>
            <div>
              <Box variant="awsui-key-label">Start Date</Box>
              <div>{formatDate(activity.startDate)}</div>
            </div>
            {activity.endDate && (
              <div>
                <Box variant="awsui-key-label">End Date</Box>
                <div>{formatDate(activity.endDate)}</div>
              </div>
            )}
            <div>
              <Box variant="awsui-key-label">Participants</Box>
              <div>
                {(() => {
                  const individualCount = assignments.length;
                  const additionalCount =
                    (activity as any).additionalParticipantCount ?? 0;
                  const totalCount = individualCount + additionalCount;

                  if (additionalCount > 0) {
                    return (
                      <SpaceBetween direction="vertical" size="xxs">
                        <div>{individualCount} individually tracked</div>
                        <div>{additionalCount} additional</div>
                        <div>
                          <strong>{totalCount} total</strong>
                        </div>
                      </SpaceBetween>
                    );
                  } else {
                    return <div>{individualCount}</div>;
                  }
                })()}
              </div>
            </div>
            <div>
              <Box variant="awsui-key-label">Created</Box>
              <div>{formatDate(activity.createdAt)}</div>
            </div>
          </ColumnLayout>
        </Container>

        <ActivityVenueHistoryTable
          venueHistory={venueHistory}
          activityStartDate={activity.startDate}
          onDelete={handleDeleteVenue}
          loading={isLoadingVenues}
          header={
            <Header
              variant="h3"
              actions={
                canEdit() && (
                  <ResponsiveButton
                    mobileIcon="add-plus"
                    onClick={handleAddVenue}
                  >
                    Add Venue
                  </ResponsiveButton>
                )
              }
            >
              Venue History
            </Header>
          }
        />

        <Table
          wrapLines={false}
          header={
            <Header
              variant="h3"
              actions={
                canEdit() && (
                  <ResponsiveButton
                    mobileIcon="add-plus"
                    onClick={() => setIsAssignmentFormOpen(true)}
                  >
                    Assign Participant
                  </ResponsiveButton>
                )
              }
            >
              Assigned Participants
            </Header>
          }
          columnDefinitions={[
            {
              id: "participant",
              header: "Participant",
              cell: (item) => {
                // For PII_RESTRICTED users, show participant ID if name is null
                const displayContent = item.participant ? (
                  <ParticipantDisplay
                    participant={item.participant}
                    currentUserRole={user?.role || "READ_ONLY"}
                  />
                ) : user?.role === "PII_RESTRICTED" ? (
                  item.participantId
                ) : (
                  "Unknown"
                );

                return (
                  <>
                    <Link href={`/participants/${item.participantId}`}>
                      {displayContent}
                    </Link>
                    {item.participant &&
                      renderPopulationBadges(item.participant.populations)}
                  </>
                );
              },
            },
            {
              id: "email",
              header: "Email",
              cell: (item) => item.participant?.email || "-",
            },
            {
              id: "role",
              header: "Role",
              cell: (item) => item.role?.name || "-",
            },
            {
              id: "actions",
              header: "Actions",
              cell: (item) =>
                canEdit() && (
                  <Button
                    variant="inline-link"
                    iconName="remove"
                    onClick={() => handleRemoveAssignment(item.participantId)}
                    ariaLabel="Remove"
                  />
                ),
            },
          ]}
          items={assignments}
          empty={
            <Box textAlign="center" color="inherit">
              <b>No assignments</b>
              <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                No participants are assigned to this activity.
              </Box>
            </Box>
          }
        />

        <Modal
          visible={isAssignmentFormOpen}
          onDismiss={() => setIsAssignmentFormOpen(false)}
          header="Assign Participant"
        >
          {isAssignmentFormOpen && (
            <AssignmentForm
              activityId={activity.id}
              existingAssignments={assignments}
              onSuccess={() => setIsAssignmentFormOpen(false)}
              onCancel={() => setIsAssignmentFormOpen(false)}
            />
          )}
        </Modal>

        <ActivityVenueHistoryForm
          visible={isVenueFormOpen}
          onDismiss={() => setIsVenueFormOpen(false)}
          onSubmit={handleSubmitVenue}
          existingDates={existingDates}
          loading={addVenueMutation.isPending}
        />

        {/* Update Status Confirmation */}
        <ConfirmationDialog
          visible={confirmUpdateStatus !== null}
          title="Update Activity Status"
          message={`Update activity status to ${confirmUpdateStatus}?`}
          confirmLabel="Update"
          cancelLabel="Cancel"
          variant="normal"
          onConfirm={handleConfirmUpdateStatus}
          onCancel={() => setConfirmUpdateStatus(null)}
        />

        {/* Remove Assignment Confirmation */}
        <ConfirmationDialog
          visible={confirmRemoveAssignment !== null}
          title="Remove Assignment"
          message="Remove this participant assignment?"
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmRemoveAssignment}
          onCancel={() => setConfirmRemoveAssignment(null)}
        />

        {/* Remove Venue Association Confirmation */}
        <ConfirmationDialog
          visible={confirmDeleteVenue !== null}
          title="Remove Venue Association"
          message="Are you sure you want to remove this venue association?"
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDeleteVenue}
          onCancel={() => setConfirmDeleteVenue(null)}
        />

        {/* Remove Activity Confirmation */}
        <ConfirmationDialog
          visible={confirmDeleteActivity}
          title="Remove Activity"
          message="Are you sure you want to remove this activity? This action cannot be undone."
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDeleteActivity}
          onCancel={() => setConfirmDeleteActivity(false)}
        />

        {/* Merge Initiation Modal */}
        {activity && showMergeModal && (
          <MergeInitiationModal
            entityType="activity"
            currentEntityId={activity.id}
            currentEntityName={activity.name}
            isOpen={showMergeModal}
            onDismiss={() => setShowMergeModal(false)}
            onConfirm={() => {
              setShowMergeModal(false);
              refetch();
            }}
          />
        )}
      </SpaceBetween>
    </PullToRefreshWrapper>
  );
}
