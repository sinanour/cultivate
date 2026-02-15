import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Table from "@cloudscape-design/components/table";
import Box from "@cloudscape-design/components/box";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import Header from "@cloudscape-design/components/header";
import Link from "@cloudscape-design/components/link";
import Pagination from "@cloudscape-design/components/pagination";
import Alert from "@cloudscape-design/components/alert";
import type { PropertyFilterProps } from "@cloudscape-design/components/property-filter";
import type { Participant } from "../../types";
import { ParticipantService } from "../../services/api/participant.service";
import { PopulationService } from "../../services/api/population.service";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../hooks/useAuth";
import { useGlobalGeographicFilter } from "../../hooks/useGlobalGeographicFilter";
import { ImportResultsModal } from "../common/ImportResultsModal";
import {
  FilterGroupingPanel,
  type FilterGroupingState,
  type FilterProperty,
} from "../common/FilterGroupingPanel";
import { ResponsiveButton } from "../common/ResponsiveButton";
import { ParticipantDisplay } from "../common/ParticipantDisplay";
import { PullToRefreshWrapper } from "../common/PullToRefreshWrapper";
import { validateCSVFile } from "../../utils/csv.utils";
import type { ImportResult } from "../../types/csv.types";
import { renderPopulationBadges } from "../../utils/population-badge.utils";
import {
  invalidatePageCaches,
  getListPageQueryKeys,
} from "../../utils/cache-invalidation.utils";
import { ConfirmationDialog } from "../common/ConfirmationDialog";

const ITEMS_PER_PAGE = 100;

export function ParticipantList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { user } = useAuth();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [deleteError, setDeleteError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Participant | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(1);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Separate state variables (like EngagementDashboard) - NOT a single filterState object
  const [propertyFilterQuery, setPropertyFilterQuery] =
    useState<PropertyFilterProps.Query>({
      tokens: [],
      operation: "and",
    });

  // Bidirectional cache: label ↔ UUID (for converting labels to UUIDs for API calls)
  const [labelToUuid, setLabelToUuid] = useState<Map<string, string>>(
    new Map(),
  );

  const [filtersReady, setFiltersReady] = useState(false); // Track if initial filters are resolved

  // Helper to add to cache (label -> UUID mapping)
  const addToCache = (uuid: string, label: string) => {
    setLabelToUuid((prev) => new Map(prev).set(label, uuid));
  };

  // Extract individual values from consolidated tokens
  const extractValuesFromToken = (
    token: PropertyFilterProps.Token,
  ): string[] => {
    if (!token.value) return [];
    return token.value
      .split(",")
      .map((v: string) => v.trim())
      .filter((v: string) => v.length > 0);
  };

  // Filter properties configuration with loadItems callbacks
  const filterProperties: FilterProperty[] = useMemo(
    () => [
      {
        key: "name",
        propertyLabel: "Name",
        groupValuesLabel: "Name values",
        operators: ["="], // Use equals operator for consistency
        loadItems: async (filterText: string) => {
          // Load sample values even with empty filter text
          const response = await ParticipantService.getParticipantsFlexible({
            page: 1,
            limit: 20,
            geographicAreaId: selectedGeographicAreaId,
            filter: filterText ? { name: filterText } : undefined,
            fields: ["id", "name"],
          });

          return response.data.map((p: any) => ({
            propertyKey: "name",
            value: p.name,
            label: p.name,
          }));
        },
      },
      {
        key: "email",
        propertyLabel: "Email",
        groupValuesLabel: "Email values",
        operators: ["="], // Use equals operator for consistency
        loadItems: async (filterText: string) => {
          // Load sample values even with empty filter text
          const response = await ParticipantService.getParticipantsFlexible({
            page: 1,
            limit: 20,
            geographicAreaId: selectedGeographicAreaId,
            filter: filterText ? { email: filterText } : undefined,
            fields: ["id", "email"],
          });

          return response.data
            .filter((p: any) => p.email)
            .map((p: any) => ({
              propertyKey: "email",
              value: p.email!,
              label: p.email!,
            }));
        },
      },
      {
        key: "ageCohort",
        propertyLabel: "Age Cohort",
        groupValuesLabel: "Age Cohort values",
        operators: ["="],
        loadItems: async () => {
          // Predefined list - no async loading needed
          return [
            { propertyKey: "ageCohort", value: "Child", label: "Child" },
            { propertyKey: "ageCohort", value: "Junior Youth", label: "Junior Youth" },
            { propertyKey: "ageCohort", value: "Youth", label: "Youth" },
            { propertyKey: "ageCohort", value: "Young Adult", label: "Young Adult" },
            { propertyKey: "ageCohort", value: "Adult", label: "Adult" },
            { propertyKey: "ageCohort", value: "Unknown", label: "Unknown" },
          ];
        },
      },
      {
        key: "population",
        propertyLabel: "Population",
        groupValuesLabel: "Population values",
        operators: ["="],
        loadItems: async (filterText: string) => {
          const populations = await PopulationService.getPopulations();
          const filtered = populations.filter(
            (pop: any) =>
              !filterText ||
              pop.name.toLowerCase().includes(filterText.toLowerCase()),
          );

          // Cache both directions: UUID -> label and label -> UUID
          filtered.forEach((pop: any) => addToCache(pop.id, pop.name));

          return filtered.map((pop: any) => ({
            propertyKey: "population",
            value: pop.name, // Store label as value for display in tokens
            label: pop.name, // Display label in dropdown
          }));
        },
      },
    ],
    [selectedGeographicAreaId],
  );

  // Pre-populate cache when filter tokens are restored from URL
  useEffect(() => {
    const populateCache = async () => {
      // Get all population tokens
      const populationTokens = propertyFilterQuery.tokens.filter(
        (t) => t.propertyKey === "population",
      );

      if (populationTokens.length === 0) {
        return;
      }

      // Fetch all populations to populate the cache
      try {
        const populations = await PopulationService.getPopulations();
        populations.forEach((pop: any) => addToCache(pop.id, pop.name));
      } catch (error) {
        console.error("Error pre-populating population cache:", error);
      }
    };

    populateCache();
  }, []); // Only run once on mount

  // Handler for FilterGroupingPanel updates (called when "Update" button clicked)
  const handleFilterUpdate = (state: FilterGroupingState) => {
    setPropertyFilterQuery(state.filterTokens);
    setCurrentPageIndex(1); // Reset to page 1 when filters change
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
      .filter((t) => t.propertyKey === "name" && t.operator === "=")
      .flatMap((t) => extractValuesFromToken(t));

    const emailLabels = propertyFilterQuery.tokens
      .filter((t) => t.propertyKey === "email" && t.operator === "=")
      .flatMap((t) => extractValuesFromToken(t));

    // Add name filter if present
    if (nameLabels.length > 0) {
      params.filter.name = nameLabels[0];
    }

    // Add email filter if present
    if (emailLabels.length > 0) {
      params.filter.email = emailLabels[0];
    }

    // Extract age cohort filter
    const ageCohortLabels = propertyFilterQuery.tokens
      .filter((t) => t.propertyKey === "ageCohort" && t.operator === "=")
      .flatMap((t) => extractValuesFromToken(t));
    if (ageCohortLabels.length > 0) {
      params.filter.ageCohorts = ageCohortLabels.join(",");
    }

    const populationLabels = propertyFilterQuery.tokens
      .filter((t) => t.propertyKey === "population" && t.operator === "=")
      .flatMap((t) => extractValuesFromToken(t));
    // Convert labels to UUIDs for API call
    const populationIds = populationLabels
      .map((label) => labelToUuid.get(label))
      .filter(Boolean) as string[];
    if (populationIds.length > 0) {
      params.filter!.populationIds = populationIds.join(",");
    }

    // Remove empty filter object if no filters
    if (Object.keys(params.filter).length === 0) {
      delete params.filter;
    }

    return params;
  }, [propertyFilterQuery, selectedGeographicAreaId, labelToUuid]);

  // Fetch participants using React Query with pagination
  const {
    data: participantsData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      "participants",
      currentPageIndex,
      ITEMS_PER_PAGE,
      filterParams,
    ],
    queryFn: async () => {
      const response = await ParticipantService.getParticipantsFlexible({
        page: currentPageIndex,
        limit: ITEMS_PER_PAGE,
        ...filterParams,
      });
      return response;
    },
    enabled: filtersReady, // Only fetch when filters are ready
    staleTime: 30000, // Cache for 30 seconds
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  const participants = participantsData?.data || [];
  const totalCount = participantsData?.pagination.total || 0;
  const totalPages = participantsData?.pagination.totalPages || 0;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => ParticipantService.deleteParticipant(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["participants"] });
      setDeleteError("");
      setCurrentPageIndex(1); // Reset to page 1 after deletion
    },
    onError: (error: Error) => {
      setDeleteError(error.message || "Failed to remove participant.");
    },
  });

  const handleEdit = (participant: Participant) => {
    navigate(`/participants/${participant.id}/edit`);
  };

  const handleCreate = () => {
    navigate("/participants/new");
  };

  const handleDelete = async (participant: Participant) => {
    setConfirmDelete(participant);
  };

  const handleConfirmDelete = () => {
    if (confirmDelete) {
      deleteMutation.mutate(confirmDelete.id);
      setConfirmDelete(null);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    setCsvError("");

    try {
      await ParticipantService.exportParticipants(selectedGeographicAreaId);
    } catch (error) {
      setCsvError(
        error instanceof Error
          ? error.message
          : "Failed to export participants",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const validation = validateCSVFile(file);
    if (!validation.valid) {
      setCsvError(validation.error || "Invalid file");
      return;
    }

    setIsImporting(true);
    setCsvError("");

    try {
      const result = await ParticipantService.importParticipants(file);
      setImportResult(result);
      setShowImportResults(true);

      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["participants"] });
        setCurrentPageIndex(1); // Reset to page 1 after import
      }
    } catch (error) {
      setCsvError(
        error instanceof Error
          ? error.message
          : "Failed to import participants",
      );
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const hasActiveFilters = propertyFilterQuery.tokens.length > 0;

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    // Invalidate caches (but preserve auth tokens)
    await invalidatePageCaches(queryClient, {
      queryKeys: getListPageQueryKeys("participants"),
      clearLocalStorage: false, // Don't clear localStorage to preserve auth
    });

    // Reset pagination
    setCurrentPageIndex(1);

    // Trigger refetch
    await refetch();
  }, [queryClient, refetch]);

  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
      <SpaceBetween size="l">
        {deleteError && (
          <Alert type="error" dismissible onDismiss={() => setDeleteError("")}>
            {deleteError}
          </Alert>
        )}
        {csvError && (
          <Alert type="error" dismissible onDismiss={() => setCsvError("")}>
            {csvError}
          </Alert>
        )}
        {error && (
          <Alert
            type="error"
            dismissible
            onDismiss={() => { }}
            action={
              <Button onClick={() => refetch()} iconName="refresh">
                Retry
              </Button>
            }
          >
            {error instanceof Error ? error.message : "Failed to load participants"}
          </Alert>
        )}

        <Table
          wrapLines={false}
          columnDefinitions={[
            {
              id: "name",
              header: "Name",
              cell: (item) => (
                <>
                  <Link href={`/participants/${item.id}`}>
                    <ParticipantDisplay
                      participant={item}
                      currentUserRole={user?.role || "READ_ONLY"}
                    />
                  </Link>
                  {renderPopulationBadges(item.populations)}
                </>
              ),
              sortingField: "name",
            },
            {
              id: "ageCohort",
              header: "Age Cohort",
              cell: (item) => item.ageCohort || "Unknown",
              sortingField: "ageCohort",
            },
            {
              id: "email",
              header: "Email",
              cell: (item) =>
                item.email ? (
                  <Link href={`mailto:${item.email}`} external>
                    {item.email}
                  </Link>
                ) : (
                  "-"
                ),
              sortingField: "email",
            },
            {
              id: "phone",
              header: "Phone",
              cell: (item) =>
                item.phone ? (
                  <Link href={`tel:${item.phone}`} external>
                    {item.phone}
                  </Link>
                ) : (
                  "-"
                ),
            },
            {
              id: "actions",
              header: "Actions",
              cell: (item) => {
                const displayName =
                  user?.role === "PII_RESTRICTED" ? item.id : item.name;
                return (
                  <Box>
                    {canEdit() && (
                      <Button
                        variant="inline-link"
                        iconName="edit"
                        onClick={() => handleEdit(item)}
                        ariaLabel={`Edit ${displayName}`}
                      />
                    )}
                    {canDelete() && (
                      <Button
                        variant="inline-link"
                        iconName="remove"
                        onClick={() => handleDelete(item)}
                        ariaLabel={`Remove ${displayName}`}
                      />
                    )}
                  </Box>
                );
              },
            },
          ]}
          items={participants}
          loading={isLoading}
          loadingText="Loading participants"
          sortingDisabled
          empty={
            <Box textAlign="center" color="inherit">
              <b>No participants</b>
              <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                {hasActiveFilters
                  ? "No participants match your filters."
                  : "No participants to display."}
              </Box>
              {canCreate() && !hasActiveFilters && (
                <ResponsiveButton
                  onClick={handleCreate}
                  mobileIcon="add-plus"
                  mobileAriaLabel="Create new participant"
                >
                  Create participant
                </ResponsiveButton>
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
                    <React.Fragment key="edit-actions">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        style={{ display: "none" }}
                        onChange={handleFileSelect}
                      />
                      <ResponsiveButton
                        iconName="upload"
                        onClick={() => fileInputRef.current?.click()}
                        loading={isImporting}
                        disabled={isImporting}
                        mobileAriaLabel="Import participants from CSV"
                      >
                        Import CSV
                      </ResponsiveButton>
                      <ResponsiveButton
                        iconName="download"
                        onClick={handleExport}
                        loading={isExporting}
                        disabled={isExporting}
                        mobileAriaLabel="Export participants to CSV"
                      >
                        Export CSV
                      </ResponsiveButton>
                    </React.Fragment>
                  )}
                  {canCreate() && (
                    <ResponsiveButton
                      variant="primary"
                      onClick={handleCreate}
                      mobileIcon="add-plus"
                      mobileAriaLabel="Create new participant"
                    >
                      Create participant
                    </ResponsiveButton>
                  )}
                </SpaceBetween>
              }
            >
              Participants {totalCount > 0 && `(${totalCount.toLocaleString()})`}
            </Header>
          }
          pagination={
            <Pagination
              currentPageIndex={currentPageIndex}
              pagesCount={totalPages}
              onChange={({ detail }) =>
                setCurrentPageIndex(detail.currentPageIndex)
              }
              ariaLabels={{
                nextPageLabel: "Next page",
                previousPageLabel: "Previous page",
                pageLabel: (pageNumber) => `Page ${pageNumber}`,
              }}
            />
          }
        />
        <ImportResultsModal
          visible={showImportResults}
          result={importResult}
          onDismiss={() => setShowImportResults(false)}
        />
        <ConfirmationDialog
          visible={confirmDelete !== null}
          title="Remove Participant"
          message={`Are you sure you want to remove "${confirmDelete ? (user?.role === "PII_RESTRICTED" ? confirmDelete.id : confirmDelete.name) : ''}"?`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </SpaceBetween>
    </PullToRefreshWrapper>
  );
}
