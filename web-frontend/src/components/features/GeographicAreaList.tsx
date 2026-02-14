import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import Header from "@cloudscape-design/components/header";
import SpaceBetween from "@cloudscape-design/components/space-between";
import Button from "@cloudscape-design/components/button";
import Badge from "@cloudscape-design/components/badge";
import Link from "@cloudscape-design/components/link";
import Alert from "@cloudscape-design/components/alert";
import Box from "@cloudscape-design/components/box";
import Table, { type TableProps } from "@cloudscape-design/components/table";
import Pagination from "@cloudscape-design/components/pagination";
import type { GeographicArea } from "../../types";
import { GeographicAreaService } from "../../services/api/geographic-area.service";
import { usePermissions } from "../../hooks/usePermissions";
import { useGlobalGeographicFilter } from "../../hooks/useGlobalGeographicFilter";
import { getAreaTypeBadgeColor } from "../../utils/geographic-area.utils";
import { ImportResultsModal } from "../common/ImportResultsModal";
import { ProgressIndicator } from "../common/ProgressIndicator";
import { ResponsiveButton } from "../common/ResponsiveButton";
import { PullToRefreshWrapper } from "../common/PullToRefreshWrapper";
import { validateCSVFile } from "../../utils/csv.utils";
import type { ImportResult } from "../../types/csv.types";
import {
  invalidatePageCaches,
  getListPageQueryKeys,
} from "../../utils/cache-invalidation.utils";
import { ConfirmationDialog } from "../common/ConfirmationDialog";
import {
  FilterGroupingPanel,
  type FilterGroupingState,
  type FilterPropertyWithLoader,
} from "../common/FilterGroupingPanel";

interface TableRow extends GeographicArea {
  children?: TableRow[];
}

const AREA_TYPES = [
  "NEIGHBOURHOOD",
  "COMMUNITY",
  "CITY",
  "CLUSTER",
  "COUNTY",
  "PROVINCE",
  "STATE",
  "COUNTRY",
  "CONTINENT",
  "HEMISPHERE",
  "WORLD",
];

export function GeographicAreaList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { canCreate, canEdit, canDelete } = usePermissions();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [deleteError, setDeleteError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<GeographicArea | null>(
    null,
  );
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [showImportResults, setShowImportResults] = useState(false);
  const [csvError, setCsvError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cache for fetched children to avoid redundant API calls
  const [childrenCache, setChildrenCache] = useState<
    Map<string, GeographicArea[]>
  >(new Map());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100; // Fixed page size

  // Filter state
  const [isFiltering, setIsFiltering] = useState(false);
  const [filterState, setFilterState] = useState<FilterGroupingState | null>(
    null,
  );

  // Batched loading state for filtered results
  const [batchedAreas, setBatchedAreas] = useState<GeographicArea[]>([]);
  const [isBatchLoading, setIsBatchLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ loaded: 0, total: 0 });
  const [isBatchCancelled, setIsBatchCancelled] = useState(false);

  // Clear state when global filter changes
  useEffect(() => {
    setChildrenCache(new Map());
    setExpandedItemIds(new Set());
    setCurrentPage(1);
    setIsFiltering(false);
    setFilterState(null);
    setBatchedAreas([]);
    setIsBatchLoading(false);
    setIsBatchCancelled(false);
  }, [selectedGeographicAreaId]);

  // Fetch paginated geographic areas with depth=1 (only when NOT filtering)
  const {
    data: geographicAreasResponse,
    isLoading: isPaginationLoading,
    refetch,
  } = useQuery({
    queryKey: [
      "geographicAreas",
      selectedGeographicAreaId,
      "paginated",
      currentPage,
    ],
    queryFn: () =>
      GeographicAreaService.getGeographicAreas(
        currentPage,
        pageSize,
        selectedGeographicAreaId,
        1, // depth=1 for lazy loading
      ),
    enabled: !isFiltering,
  });

  // Extract data
  const paginatedAreas = geographicAreasResponse?.data || [];
  const totalPages = geographicAreasResponse?.pagination?.totalPages || 1;

  // Use batched areas when filtering, paginated areas otherwise
  const geographicAreas = isFiltering ? batchedAreas : paginatedAreas;
  const isLoading = isFiltering ? isBatchLoading : isPaginationLoading;

  const deleteMutation = useMutation({
    mutationFn: (id: string) => GeographicAreaService.deleteGeographicArea(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["geographicAreas"] });
      setDeleteError("");
      setChildrenCache(new Map());
      setBatchedAreas([]);
    },
    onError: (error: Error) => {
      setDeleteError(
        error.message ||
        "Failed to remove geographic area. It may be referenced by venues or child areas.",
      );
    },
  });

  // Fetch children for a specific node (lazy loading in pagination mode)
  const fetchChildren = useCallback(
    async (parentId: string) => {
      try {
        const response = await GeographicAreaService.getChildren(
          parentId,
          selectedGeographicAreaId,
        );
        return response;
      } catch (error) {
        console.error("Error fetching children:", error);
        return [];
      }
    },
    [selectedGeographicAreaId],
  );

  // Build hierarchical structure from flat list
  const buildHierarchy = useCallback(
    (areas: GeographicArea[]): TableRow[] => {
      const areaMap = new Map<string, TableRow>();

      // First pass: create all rows from the main areas array
      areas.forEach((area) => {
        areaMap.set(area.id, { ...area });
      });

      // Add cached children to the area map so they can be properly integrated
      childrenCache.forEach((children) => {
        children.forEach((child) => {
          if (!areaMap.has(child.id)) {
            areaMap.set(child.id, { ...child });
          }
        });
      });

      // Second pass: build hierarchy
      const rootRows: TableRow[] = [];

      // Process all areas (from main array and cache)
      const allAreaIds = new Set([
        ...areas.map(a => a.id),
        ...Array.from(childrenCache.values()).flat().map(c => c.id)
      ]);

      allAreaIds.forEach((areaId) => {
        const row = areaMap.get(areaId);
        if (!row) return;

        // Check if we have cached children
        const cachedChildren = childrenCache.get(areaId);
        if (cachedChildren && cachedChildren.length > 0) {
          row.children = cachedChildren.map(
            (child) => areaMap.get(child.id) || { ...child },
          );
        } else if (row.children && row.children.length > 0) {
          // Use children from initial fetch (already in the area object)
          row.children = row.children.map(
            (child) => areaMap.get(child.id) || { ...child },
          );
        }

        if (!row.parentGeographicAreaId) {
          // Root node
          if (!rootRows.find(r => r.id === row.id)) {
            rootRows.push(row);
          }
        } else {
          // Child node - add to parent if parent exists
          const parentRow = areaMap.get(row.parentGeographicAreaId);
          if (parentRow) {
            if (!parentRow.children) {
              parentRow.children = [];
            }
            if (!parentRow.children.find((c) => c.id === row.id)) {
              parentRow.children.push(row);
            }
          } else {
            // Parent not in dataset - treat as root
            if (!rootRows.find(r => r.id === row.id)) {
              rootRows.push(row);
            }
          }
        }
      });

      return rootRows;
    },
    [childrenCache],
  );

  const tableData = useMemo(() => buildHierarchy(geographicAreas), [geographicAreas, buildHierarchy]);

  // Table column definitions
  const columnDefinitions: TableProps.ColumnDefinition<TableRow>[] = [
    {
      id: "name",
      header: "Name",
      cell: (item) => (
        <Link
          href={`/geographic-areas/${item.id}`}
          onFollow={(e) => {
            e.preventDefault();
            navigate(`/geographic-areas/${item.id}`);
          }}
        >
          {item.name}
        </Link>
      ),
      sortingField: "name",
    },
    {
      id: "areaType",
      header: "Area Type",
      cell: (item) => (
        <Badge color={getAreaTypeBadgeColor(item.areaType)}>
          {item.areaType}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <SpaceBetween direction="horizontal" size="xs">
          {canEdit() && (
            <Button
              variant="inline-link"
              iconName="edit"
              onClick={() => navigate(`/geographic-areas/${item.id}/edit`)}
              ariaLabel={`Edit ${item.name}`}
            />
          )}
          {canDelete() && (
            <Button
              variant="inline-link"
              iconName="remove"
              onClick={() => setConfirmDelete(item)}
              ariaLabel={`Remove ${item.name}`}
            />
          )}
        </SpaceBetween>
      ),
    },
  ];

  const handleCreate = () => {
    navigate("/geographic-areas/new");
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
      await GeographicAreaService.exportGeographicAreas();
    } catch (error) {
      setCsvError(
        error instanceof Error
          ? error.message
          : "Failed to export geographic areas",
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
      const result = await GeographicAreaService.importGeographicAreas(file);
      setImportResult(result);
      setShowImportResults(true);

      if (result.successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["geographicAreas"] });
        setChildrenCache(new Map());
        setBatchedAreas([]);
      }
    } catch (error) {
      setCsvError(
        error instanceof Error
          ? error.message
          : "Failed to import geographic areas",
      );
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle filter updates from FilterGroupingPanel
  const handleFilterUpdate = useCallback(
    async (state: FilterGroupingState) => {
      setFilterState(state);

      // Extract filter values from tokens
      const nameToken = state.filterTokens.tokens.find(
        (t) => t.propertyKey === "name",
      );
      const areaTypeTokens = state.filterTokens.tokens.filter(
        (t) => t.propertyKey === "areaType",
      );

      const hasFilters = nameToken || areaTypeTokens.length > 0;

      if (!hasFilters) {
        // No filters - return to pagination mode
        setIsFiltering(false);
        setBatchedAreas([]);
        setIsBatchLoading(false);
        setIsBatchCancelled(false);
        setCurrentPage(1);
        setExpandedItemIds(new Set());
        setChildrenCache(new Map()); // Clear cached children when returning to pagination mode
        return;
      }

      // Filters active - switch to batched loading mode
      // Clear cached children from lazy-loading to prevent them from appearing in filtered results
      setChildrenCache(new Map());
      setIsFiltering(true);
      setIsBatchLoading(true);
      setIsBatchCancelled(false);
      setBatchProgress({ loaded: 0, total: 0 });

      const filters: Record<string, any> = {};
      if (nameToken) {
        filters.name = String(nameToken.value);
      }
      if (areaTypeTokens.length > 0) {
        filters.areaType = areaTypeTokens.map((t) => String(t.value));
      }

      // Fetch all matching areas in batches
      try {
        const allAreas: GeographicArea[] = [];
        let currentBatchPage = 1;
        let totalCount = 0;

        // Fetch first batch to get total count
        const firstResponse =
          await GeographicAreaService.getGeographicAreasFlexible({
            page: currentBatchPage,
            limit: 100,
            geographicAreaId: selectedGeographicAreaId,
            filter: filters,
          });

        allAreas.push(...firstResponse.data);
        totalCount = firstResponse.pagination.total;
        setBatchProgress({ loaded: allAreas.length, total: totalCount });

        // Fetch remaining batches
        const totalBatches = firstResponse.pagination.totalPages;
        for (let page = 2; page <= totalBatches; page++) {
          if (isBatchCancelled) break;

          const response =
            await GeographicAreaService.getGeographicAreasFlexible({
              page,
              limit: 100,
              geographicAreaId: selectedGeographicAreaId,
              filter: filters,
            });

          allAreas.push(...response.data);
          setBatchProgress({ loaded: allAreas.length, total: totalCount });
        }

        if (!isBatchCancelled && allAreas.length > 0) {
          // Fetch ancestors for all matching areas in batches of 100
          const areaIds = allAreas.map((a) => a.id);
          const ancestorMap: Record<string, string | null> = {};

          // Batch the ancestor requests in groups of 100
          for (let i = 0; i < areaIds.length; i += 100) {
            const batchIds = areaIds.slice(i, i + 100);
            const batchResult = await GeographicAreaService.getBatchAncestors(batchIds);
            Object.assign(ancestorMap, batchResult);
          }

          // Collect all unique ancestor IDs
          const ancestorIds = new Set<string>();
          Object.values(ancestorMap).forEach((parentId) => {
            if (parentId) {
              let currentId: string | null = parentId;
              while (currentId) {
                ancestorIds.add(currentId);
                currentId = ancestorMap[currentId] || null;
              }
            }
          });

          // Fetch ancestor details in batches
          if (ancestorIds.size > 0) {
            const ancestorIdArray = Array.from(ancestorIds);
            let ancestorBatches: GeographicArea[] = [];

            for (let i = 0; i < ancestorIdArray.length; i += 100) {
              const batchIds = ancestorIdArray.slice(i, i + 100);
              const detailsMap =
                await GeographicAreaService.getBatchDetails(batchIds);
              ancestorBatches.push(...Object.values(detailsMap));
            }

            allAreas.push(...ancestorBatches);
          }

          setBatchedAreas(allAreas);

          setExpandedItemIds(new Set<string>(allAreas.map(area => area.id)));
        } else {
          setBatchedAreas(allAreas);
        }
      } catch (error) {
        console.error("Error fetching filtered areas:", error);
        setCsvError("Failed to load filtered geographic areas");
        setBatchedAreas([]);
      } finally {
        setIsBatchLoading(false);
      }
    },
    [selectedGeographicAreaId, isBatchCancelled, buildHierarchy],
  );

  // Handle row expansion
  const handleExpandableItemToggle: TableProps.OnExpandableItemToggle<TableRow> = async (event) => {
    const { item, expanded } = event.detail;

    if (expanded) {
      setExpandedItemIds((prev) => new Set([...prev, item.id]));

      // Fetch children on-demand (only in pagination mode, not filtering mode)
      if (
        !isFiltering &&
        item.childCount &&
        item.childCount > 0 &&
        !childrenCache.has(item.id)
      ) {
        const children = await fetchChildren(item.id);
        if (children.length > 0) {
          setChildrenCache((prev) => {
            const newCache = new Map(prev);
            newCache.set(item.id, children);
            return newCache;
          });
        }
      }
    } else {
      setExpandedItemIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(item.id);
        return newSet;
      });
    }
    };

  const getItemChildren = (item: TableRow): TableRow[] => {
    return item.children || [];
  };

  const isItemExpandable = (item: TableRow): boolean => {
    const hasChildCount = (item.childCount || 0) > 0;
    const hasChildren = Boolean(item.children && item.children.length > 0);
    return hasChildCount || hasChildren;
  };

  // Cancel batched loading
  const handleCancelBatchLoading = () => {
    setIsBatchCancelled(true);
    setIsBatchLoading(false);
  };

  // Resume batched loading
  const handleResumeBatchLoading = () => {
    setIsBatchCancelled(false);
    // Re-trigger the filter update to continue loading
    if (filterState) {
      handleFilterUpdate(filterState);
    }
  };

  // Pull-to-refresh handler
  const handlePullToRefresh = useCallback(async () => {
    await invalidatePageCaches(queryClient, {
      queryKeys: getListPageQueryKeys("geographic-areas"),
      clearLocalStorage: false,
    });

    setChildrenCache(new Map());
    setExpandedItemIds(new Set());
    setCurrentPage(1);
    setIsFiltering(false);
    setFilterState(null);
    setBatchedAreas([]);
    setIsBatchLoading(false);
    setIsBatchCancelled(false);

    await refetch();
  }, [queryClient, refetch]);

  // Filter properties for FilterGroupingPanel
  const filterProperties: FilterPropertyWithLoader[] = [
    {
      key: "name",
      propertyLabel: "Name",
      groupValuesLabel: "Name values",
      operators: ["="],
      loadItems: async (filteringText: string, property: FilterPropertyWithLoader) => {
        if (!filteringText) return [];

        try {
          const response =
            await GeographicAreaService.getGeographicAreasFlexible({
              limit: 20,
              geographicAreaId: selectedGeographicAreaId,
              filter: { name: filteringText },
              fields: ["id", "name"],
            });

          return response.data.map((area) => ({
            propertyKey: property.key,
            value: area.name,
            label: area.name,
          }));
        } catch (error) {
          console.error("Error loading name options:", error);
          return [];
        }
      },
    },
    {
      key: "areaType",
      propertyLabel: "Area Type",
      groupValuesLabel: "Area Type values",
      operators: ["="],
      loadItems: async (_filteringText: string, property: FilterPropertyWithLoader) => {
        return AREA_TYPES.map((type) => ({
          propertyKey: property.key,
          value: type,
          label: type,
        }));
      },
    },
  ];

  // Convert expanded IDs to actual items for CloudScape Table
  const findItemById = (items: TableRow[], id: string): TableRow | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.children) {
        const found = findItemById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const expandedItems: readonly TableRow[] = Array.from(expandedItemIds)
    .map(id => findItemById(tableData, id))
    .filter((item): item is TableRow => item !== null);

  return (
    <PullToRefreshWrapper onRefresh={handlePullToRefresh}>
      <>
        <SpaceBetween size="l">
          {deleteError && (
            <Alert
              type="error"
              dismissible
              onDismiss={() => setDeleteError("")}
            >
              {deleteError}
            </Alert>
          )}
          {csvError && (
            <Alert type="error" dismissible onDismiss={() => setCsvError("")}>
              {csvError}
            </Alert>
          )}
          <Table
            columnDefinitions={columnDefinitions}
            items={tableData}
            loading={isLoading && !isBatchLoading}
            loadingText="Loading geographic areas"
            trackBy="id"
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
                          style={{ display: "none" }}
                          onChange={handleFileSelect}
                        />
                        <ResponsiveButton
                          iconName="upload"
                          onClick={() => fileInputRef.current?.click()}
                          loading={isImporting}
                          disabled={isImporting}
                          mobileAriaLabel="Import geographic areas from CSV"
                        >
                          Import CSV
                        </ResponsiveButton>
                        <ResponsiveButton
                          iconName="download"
                          onClick={handleExport}
                          loading={isExporting}
                          disabled={isExporting}
                          mobileAriaLabel="Export geographic areas to CSV"
                        >
                          Export CSV
                        </ResponsiveButton>
                      </>
                    )}
                    {canCreate() && (
                      <ResponsiveButton
                        variant="primary"
                        onClick={handleCreate}
                        mobileIcon="add-plus"
                        mobileAriaLabel="Create new geographic area"
                      >
                        Create geographic area
                      </ResponsiveButton>
                    )}
                  </SpaceBetween>
                }
              >
                <SpaceBetween direction="horizontal" size="xs">
                  <Box display="inline" fontSize="heading-l" fontWeight="bold">
                    Geographic Areas {isFiltering && batchProgress.total > 0 && !isBatchLoading && `(${batchProgress.total.toLocaleString()})`}
                  </Box>
                  {isBatchLoading && batchProgress.total > 0 && (
                    <Box margin={{ bottom: "s" }}>
                      <ProgressIndicator
                        loadedCount={batchProgress.loaded}
                        totalCount={batchProgress.total}
                        entityName="areas"
                        onCancel={handleCancelBatchLoading}
                        onResume={handleResumeBatchLoading}
                        isCancelled={isBatchCancelled}
                      />
                    </Box>
                  )}
                </SpaceBetween>
              </Header>
            }
            filter={
              <FilterGroupingPanel
                filterProperties={filterProperties}
                groupingMode="none"
                includeDateRange={false}
                onUpdate={handleFilterUpdate}
                isLoading={isLoading}
              />
            }
            empty={
              <Box textAlign="center" color="inherit">
                <b>No geographic areas</b>
                <Box padding={{ bottom: "s" }} variant="p" color="inherit">
                  {isFiltering
                    ? "No geographic areas match the current filters."
                    : "No geographic areas to display."}
                </Box>
                {canCreate() && !isFiltering && (
                  <ResponsiveButton
                    onClick={handleCreate}
                    mobileIcon="add-plus"
                    mobileAriaLabel="Create new geographic area"
                  >
                    Create geographic area
                  </ResponsiveButton>
                )}
              </Box>
            }
            expandableRows={{
              getItemChildren,
              isItemExpandable,
              expandedItems,
              onExpandableItemToggle: handleExpandableItemToggle,
            }}
            pagination={
              !isFiltering ? (
                <Pagination
                  currentPageIndex={currentPage}
                  pagesCount={totalPages}
                  onChange={({
                    detail,
                  }: {
                    detail: { currentPageIndex: number };
                  }) => setCurrentPage(detail.currentPageIndex)}
                  ariaLabels={{
                    nextPageLabel: "Next page",
                    previousPageLabel: "Previous page",
                    pageLabel: (pageNumber: number) => `Page ${pageNumber}`,
                  }}
                />
              ) : undefined
            }
            ariaLabels={{
              itemSelectionLabel: () => "",
              allItemsSelectionLabel: () => "",
              selectionGroupLabel: "Geographic area selection",
            }}
          />
        </SpaceBetween>
        <ImportResultsModal
          visible={showImportResults}
          result={importResult}
          onDismiss={() => setShowImportResults(false)}
        />
        <ConfirmationDialog
          visible={confirmDelete !== null}
          title="Remove Geographic Area"
          message={`Are you sure you want to remove "${confirmDelete?.name}"?`}
          confirmLabel="Remove"
          cancelLabel="Cancel"
          variant="destructive"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      </>
    </PullToRefreshWrapper>
  );
}
