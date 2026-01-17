import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  SpaceBetween,
  Button,
  DateRangePicker,
  PropertyFilter,
  Multiselect,
  SegmentedControl,
  Alert,
} from '@cloudscape-design/components';
import type {
  PropertyFilterProps,
  DateRangePickerProps,
  MultiselectProps,
  SegmentedControlProps,
} from '@cloudscape-design/components';

export interface FilterGroupingState {
  dateRange: { 
    startDate?: string; 
    endDate?: string;
    type?: 'absolute' | 'relative';
    amount?: number;
    unit?: 'day' | 'week' | 'month' | 'year';
  } | null;
  filterTokens: PropertyFilterProps.Query;
  grouping: string[] | string | null; // Array for additive, string for exclusive, null for none
}

export interface FilterPropertyWithLoader {
  key: string;
  propertyLabel: string;
  groupValuesLabel: string;
  operators?: PropertyFilterProps.ComparisonOperator[];
  loadItems: (filterText: string, property: FilterPropertyWithLoader) => Promise<PropertyFilterProps.FilteringOption[]>;
}

// Legacy export for backward compatibility
export type FilterProperty = FilterPropertyWithLoader;

export interface GroupingDimension {
  value: string;
  label: string;
}

export interface FilterGroupingPanelProps {
  filterProperties: FilterPropertyWithLoader[];
  groupingMode?: 'additive' | 'exclusive' | 'none';
  groupingDimensions?: GroupingDimension[];
  includeDateRange?: boolean;
  initialDateRange?: { 
    startDate?: string; 
    endDate?: string;
    type?: 'absolute' | 'relative';
    amount?: number;
    unit?: 'day' | 'week' | 'month' | 'year';
  } | null;
  initialFilterTokens?: PropertyFilterProps.Query;
  initialGrouping?: string[] | string | null;
  onUpdate: (state: FilterGroupingState) => void;
  isLoading?: boolean;
  disablePopulationFilter?: boolean;
  urlParamPrefix?: string;
  hideUpdateButton?: boolean; // Hide Update button for Run Report pattern
  onInitialResolutionComplete?: () => void; // Callback when URL filters are resolved
  onRegisterTrigger?: (trigger: () => void) => void; // Register a function to trigger update from parent
}

export const FilterGroupingPanel: React.FC<FilterGroupingPanelProps> = ({
  filterProperties,
  groupingMode = 'none',
  groupingDimensions = [],
  includeDateRange = true,
  initialDateRange = null,
  initialFilterTokens = { tokens: [], operation: 'and' },
  initialGrouping = null,
  onUpdate,
  isLoading = false,
  disablePopulationFilter = false,
  urlParamPrefix = 'filter_',
  hideUpdateButton = false,
  onInitialResolutionComplete,
  onRegisterTrigger,
}) => {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // State for lazy loading
  const [filteringOptions, setFilteringOptions] = useState<PropertyFilterProps.FilteringOption[]>([]);
  const [filteringStatusType, setFilteringStatusType] = useState<'pending' | 'loading' | 'finished' | 'error'>('finished');
  
  // State for initial URL filter resolution
  const [isResolvingInitialFilters, setIsResolvingInitialFilters] = useState(false);
  
  // Debounce timer ref
  const debounceTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize state from URL parameters on mount
  const initializeFromURL = useMemo(() => {
    const urlDateRange = (() => {
      const startDate = searchParams.get(`${urlParamPrefix}startDate`);
      const endDate = searchParams.get(`${urlParamPrefix}endDate`);
      const relativePeriod = searchParams.get(`${urlParamPrefix}relativePeriod`);
      
      if (relativePeriod) {
        // Parse relative period format: -90d, -6m, -1y
        const match = relativePeriod.match(/^-(\d+)([dwmy])$/);
        if (match) {
          const amount = parseInt(match[1], 10);
          const unitMap: Record<string, 'day' | 'week' | 'month' | 'year'> = {
            d: 'day',
            w: 'week',
            m: 'month',
            y: 'year',
          };
          const unit = unitMap[match[2]];
          if (unit) {
            return { type: 'relative' as const, amount, unit };
          }
        }
      }
      
      if (startDate && endDate) {
        return { type: 'absolute' as const, startDate, endDate };
      }
      
      return null;
    })();

    const urlFilterTokens: PropertyFilterProps.Token[] = [];
    filterProperties.forEach((prop) => {
      const paramValue = searchParams.get(`${urlParamPrefix}${prop.key}`);
      if (paramValue) {
        const values = paramValue.split(',');
        values.forEach((value) => {
          urlFilterTokens.push({
            propertyKey: prop.key,
            operator: '=',
            value: value.trim(),
          });
        });
      }
    });

    const urlGrouping = (() => {
      const groupByParam = searchParams.get(`${urlParamPrefix}groupBy`);
      if (!groupByParam) return null;
      
      if (groupingMode === 'additive') {
        return groupByParam.split(',').map((v) => v.trim());
      }
      return groupByParam;
    })();

    return {
      dateRange: urlDateRange || initialDateRange,
      filterTokens: urlFilterTokens.length > 0 ? { tokens: urlFilterTokens, operation: 'and' as const } : initialFilterTokens,
      grouping: urlGrouping !== null ? urlGrouping : initialGrouping,
    };
  }, []); // Only run once on mount

  // Internal state for pending changes
  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(() => {
    const init = initializeFromURL.dateRange;
    if (!init) return null;
    
    if (init.type === 'relative' && init.amount && init.unit) {
      return {
        type: 'relative',
        amount: init.amount,
        unit: init.unit,
      };
    }
    
    if (init.startDate && init.endDate) {
      return {
        type: 'absolute',
        startDate: init.startDate,
        endDate: init.endDate,
      };
    }
    
    return null;
  });
  
  const [filterQuery, setFilterQuery] = useState<PropertyFilterProps.Query>(
    initializeFromURL.filterTokens
  );
  
  const [grouping, setGrouping] = useState<string[] | string | null>(() => {
    const init = initializeFromURL.grouping;
    if (init !== undefined && init !== null) return init;
    if (groupingMode === 'none') return null;
    if (groupingMode === 'additive') return [];
    return groupingDimensions[0]?.value || '';
  });

  // Track last applied state to determine if changes are pending
  const [lastAppliedState, setLastAppliedState] = useState<FilterGroupingState>(initializeFromURL);

  // Resolve initial URL filters on mount
  useEffect(() => {
    const resolveInitialFilters = async () => {
      // Check if there are any URL filter parameters that need resolution
      const hasURLFilters = initializeFromURL.filterTokens.tokens.length > 0;
      
      if (!hasURLFilters) {
        // No URL filters - mark resolution as complete immediately
        if (onInitialResolutionComplete) {
          onInitialResolutionComplete();
        }
        return;
      }

      setIsResolvingInitialFilters(true);

      try {
        // For each token, we need to ensure the value is properly resolved
        // The tokens from URL already have display names as values
        // We need to invoke loadItems to populate any caches in parent components
        
        const resolutionPromises = initializeFromURL.filterTokens.tokens.map(async (token) => {
          const property = filterProperties.find(p => p.key === token.propertyKey);
          if (property && property.loadItems) {
            // Invoke loadItems with the token value to ensure caches are populated
            // This allows parent components to build their UUID mappings
            await property.loadItems(String(token.value), property);
          }
        });

        await Promise.all(resolutionPromises);

        // After resolution, automatically trigger the initial data fetch
        // Trigger onUpdate with the resolved state (without marking as dirty)
        onUpdate(initializeFromURL);
        
        if (onInitialResolutionComplete) {
          onInitialResolutionComplete();
        }
      } catch (error) {
        console.error('Error resolving initial URL filters:', error);
        // Even on error, mark as complete to allow the page to function
        if (onInitialResolutionComplete) {
          onInitialResolutionComplete();
        }
      } finally {
        setIsResolvingInitialFilters(false);
      }
    };

    resolveInitialFilters();
  }, []); // Only run once on mount

  // Determine if there are pending changes
  const isDirty = useMemo(() => {
    // Normalize current date range to FilterGroupingState format for comparison
    let currentDateRange: FilterGroupingState['dateRange'] = null;
    
    if (dateRange?.type === 'absolute') {
      currentDateRange = {
        type: 'absolute',
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      };
    } else if (dateRange?.type === 'relative' && dateRange.amount && dateRange.unit) {
      currentDateRange = {
        type: 'relative',
        amount: dateRange.amount,
        unit: dateRange.unit as 'day' | 'week' | 'month' | 'year',
      };
    }
    
    const lastDateRange = lastAppliedState.dateRange;

    // Compare date ranges - handle null cases explicitly
    const dateRangeChanged = (() => {
      if (!currentDateRange && !lastDateRange) return false;
      if (!currentDateRange || !lastDateRange) return true;
      return JSON.stringify(currentDateRange) !== JSON.stringify(lastDateRange);
    })();

    const filterTokensChanged =
      JSON.stringify(filterQuery) !== JSON.stringify(lastAppliedState.filterTokens);
    const groupingChanged = JSON.stringify(grouping) !== JSON.stringify(lastAppliedState.grouping);

    return dateRangeChanged || filterTokensChanged || groupingChanged;
  }, [dateRange, filterQuery, grouping, lastAppliedState]);

  // Filter out population property if disabled
  const activeFilterProperties = useMemo(() => {
    if (disablePopulationFilter) {
      return filterProperties.filter((prop) => prop.key !== 'population');
    }
    return filterProperties;
  }, [filterProperties, disablePopulationFilter]);

  // Lazy loading handler with debouncing
  const handleLoadItems: PropertyFilterProps['onLoadItems'] = ({ detail }) => {
    const { filteringProperty, filteringText } = detail;
    
    // Guard against undefined filteringProperty
    if (!filteringProperty) {
      setFilteringOptions([]);
      setFilteringStatusType('finished');
      return;
    }
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Find the property definition - filteringProperty is an object with a key property
    const propertyKey = typeof filteringProperty === 'string' ? filteringProperty : filteringProperty.key;
    const property = activeFilterProperties.find((prop) => prop.key === propertyKey);
    if (!property || !property.loadItems) {
      setFilteringOptions([]);
      setFilteringStatusType('finished');
      return;
    }

    setFilteringStatusType('loading');

    // Debounce the loadItems call
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const options = await property.loadItems(filteringText || '', property);
        setFilteringOptions(options);
        setFilteringStatusType('finished');
      } catch (error) {
        console.error('Error loading filter options:', error);
        setFilteringOptions([]);
        setFilteringStatusType('error');
      }
    }, 300); // 300ms debounce
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Synchronize state to URL parameters (non-destructive)
  const syncToURL = (state: FilterGroupingState) => {
    setSearchParams((prevParams) => {
      const newParams = new URLSearchParams(prevParams);
      
      // Remove all filter-related parameters (those with our prefix)
      const keysToRemove: string[] = [];
      newParams.forEach((_, key) => {
        if (key.startsWith(urlParamPrefix)) {
          keysToRemove.push(key);
        }
      });
      keysToRemove.forEach((key) => newParams.delete(key));

      // Add date range parameters
      if (state.dateRange) {
        if (state.dateRange.type === 'absolute' && state.dateRange.startDate && state.dateRange.endDate) {
          newParams.set(`${urlParamPrefix}startDate`, state.dateRange.startDate);
          newParams.set(`${urlParamPrefix}endDate`, state.dateRange.endDate);
        } else if (state.dateRange.type === 'relative' && state.dateRange.amount && state.dateRange.unit) {
          const unitMap: Record<string, string> = {
            day: 'd',
            week: 'w',
            month: 'm',
            year: 'y',
          };
          const unit = unitMap[state.dateRange.unit];
          newParams.set(`${urlParamPrefix}relativePeriod`, `-${state.dateRange.amount}${unit}`);
        }
      }

      // Add filter token parameters (consolidate by property key)
      const tokensByProperty = new Map<string, Set<string>>();
      state.filterTokens.tokens.forEach((token) => {
        const key = token.propertyKey;
        const value = token.value;
        
        // Skip tokens without propertyKey or value
        if (!key || value === undefined || value === null) return;
        
        // Convert value to string
        const valueStr = String(value);
        
        if (!tokensByProperty.has(key)) {
          tokensByProperty.set(key, new Set());
        }
        tokensByProperty.get(key)!.add(valueStr);
      });

      tokensByProperty.forEach((values, propertyKey) => {
        const valuesArray = Array.from(values);
        newParams.set(`${urlParamPrefix}${propertyKey}`, valuesArray.join(','));
      });

      // Add grouping parameter
      if (state.grouping !== null) {
        if (Array.isArray(state.grouping)) {
          if (state.grouping.length > 0) {
            newParams.set(`${urlParamPrefix}groupBy`, state.grouping.join(','));
          }
        } else if (state.grouping) {
          newParams.set(`${urlParamPrefix}groupBy`, state.grouping);
        }
      }

      return newParams;
    }, { replace: false }); // Support browser back/forward navigation
  };

  const handleUpdate = useCallback(() => {
    // Extract date range - preserve type (absolute or relative)
    let currentDateRange: FilterGroupingState['dateRange'] = null;
    
    if (dateRange?.type === 'absolute') {
      currentDateRange = { 
        type: 'absolute',
        startDate: dateRange.startDate, 
        endDate: dateRange.endDate 
      };
    } else if (dateRange?.type === 'relative' && dateRange.amount && dateRange.unit) {
      currentDateRange = {
        type: 'relative',
        amount: dateRange.amount,
        unit: dateRange.unit as 'day' | 'week' | 'month' | 'year',
      };
    }

    const newState: FilterGroupingState = {
      dateRange: currentDateRange,
      filterTokens: filterQuery,
      grouping,
    };

    setLastAppliedState(newState);
    syncToURL(newState);
    onUpdate(newState);
  }, [dateRange, filterQuery, grouping, onUpdate, syncToURL]);

  const handleClearAll = () => {
    setDateRange(null);
    setFilterQuery({ tokens: [], operation: 'and' });
    const defaultGrouping = groupingMode === 'none' ? null : (groupingMode === 'additive' ? [] : groupingDimensions[0]?.value || '');
    setGrouping(defaultGrouping);
    
    // Clear URL parameters
    const clearedState: FilterGroupingState = {
      dateRange: null,
      filterTokens: { tokens: [], operation: 'and' },
      grouping: defaultGrouping,
    };
    syncToURL(clearedState);
  };

  // Register trigger function with parent (for Run Report pattern)
  useEffect(() => {
    if (onRegisterTrigger) {
      onRegisterTrigger(handleUpdate);
    }
  }, [onRegisterTrigger, handleUpdate]);

  // Convert groupingDimensions to Multiselect options
  const multiselectOptions: MultiselectProps.Option[] = groupingDimensions.map((dim) => ({
    value: dim.value,
    label: dim.label,
  }));

  // Convert groupingDimensions to SegmentedControl options
  const segmentedControlOptions: SegmentedControlProps.Option[] = groupingDimensions.map(
    (dim) => ({
      id: dim.value,
      text: dim.label,
    })
  );

  return (
    <SpaceBetween size="m" direction="vertical">
      {isResolvingInitialFilters && (
        <Alert type="info">
          Loading filters...
        </Alert>
      )}
      
      {/* First Row: First filtering component with action buttons beside it */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
        {/* First filtering component (DateRangePicker if included, otherwise PropertyFilter) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {includeDateRange ? (
            <DateRangePicker
              value={dateRange}
              onChange={({ detail }) => setDateRange(detail.value)}
              placeholder="Filter by date range"
              dateOnly={true}
              disabled={isLoading}
              relativeOptions={[
                { key: 'previous-30-days', amount: 30, unit: 'day', type: 'relative' },
                { key: 'previous-90-days', amount: 90, unit: 'day', type: 'relative' },
                { key: 'previous-6-months', amount: 6, unit: 'month', type: 'relative' },
                { key: 'previous-1-year', amount: 1, unit: 'year', type: 'relative' },
              ]}
              isValidRange={(range) => {
                if (range?.type === 'absolute') {
                  const start = new Date(range.startDate);
                  const end = new Date(range.endDate);
                  if (start > end) {
                    return {
                      valid: false,
                      errorMessage: 'Start date must be before end date',
                    };
                  }
                }
                return { valid: true };
              }}
              i18nStrings={{
                todayAriaLabel: 'Today',
                nextMonthAriaLabel: 'Next month',
                previousMonthAriaLabel: 'Previous month',
                customRelativeRangeDurationLabel: 'Duration',
                customRelativeRangeDurationPlaceholder: 'Enter duration',
                customRelativeRangeOptionLabel: 'Custom range',
                customRelativeRangeOptionDescription: 'Set a custom range in the past',
                customRelativeRangeUnitLabel: 'Unit of time',
                formatRelativeRange: (range) => {
                  const unit = range.unit === 'day' ? 'days' : range.unit === 'month' ? 'months' : 'years';
                  return `Last ${range.amount} ${unit}`;
                },
                formatUnit: (unit, value) => (value === 1 ? unit : `${unit}s`),
                dateTimeConstraintText: 'Range must be between 6 and 30 days.',
                relativeModeTitle: 'Relative range',
                absoluteModeTitle: 'Absolute range',
                relativeRangeSelectionHeading: 'Choose a range',
                startDateLabel: 'Start date',
                endDateLabel: 'End date',
                startTimeLabel: 'Start time',
                endTimeLabel: 'End time',
                clearButtonLabel: 'Clear',
                cancelButtonLabel: 'Cancel',
                applyButtonLabel: 'Apply',
              }}
            />
          ) : (
            <PropertyFilter
              query={filterQuery}
              onChange={({ detail }) => setFilterQuery(detail)}
              filteringProperties={activeFilterProperties.map((prop) => ({
                key: prop.key,
                propertyLabel: prop.propertyLabel,
                groupValuesLabel: prop.groupValuesLabel,
                operators: prop.operators || ['='],
              }))}
              filteringOptions={filteringOptions}
              filteringStatusType={filteringStatusType}
              onLoadItems={handleLoadItems}
              disabled={isLoading}
              filteringPlaceholder="Filter data"
              filteringEmpty="No matches found"
              filteringLoadingText="Loading options..."
              filteringFinishedText="End of results"
              hideOperations={true}
              i18nStrings={{
                filteringAriaLabel: 'Filter data',
                dismissAriaLabel: 'Dismiss',
                filteringPlaceholder: 'Filter data',
                groupValuesText: 'Values',
                groupPropertiesText: 'Properties',
                operatorsText: 'Operators',
                operationAndText: 'and',
                operationOrText: 'or',
                operatorLessText: 'Less than',
                operatorLessOrEqualText: 'Less than or equal',
                operatorGreaterText: 'Greater than',
                operatorGreaterOrEqualText: 'Greater than or equal',
                operatorContainsText: 'Contains',
                operatorDoesNotContainText: 'Does not contain',
                operatorEqualsText: 'Equals',
                operatorDoesNotEqualText: 'Does not equal',
                editTokenHeader: 'Edit filter',
                propertyText: 'Property',
                operatorText: 'Operator',
                valueText: 'Value',
                cancelActionText: 'Cancel',
                applyActionText: 'Apply',
                allPropertiesLabel: 'All properties',
                tokenLimitShowMore: 'Show more',
                tokenLimitShowFewer: 'Show fewer',
                clearFiltersText: 'Clear filters',
                removeTokenButtonAriaLabel: (token) => `Remove token ${token.propertyKey}`,
                enteredTextLabel: (text) => `Use: "${text}"`,
              }}
            />
          )}
        </div>

        {/* Action buttons beside the first filtering component */}
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={handleClearAll} disabled={isLoading}>
            Clear All
          </Button>
          {!hideUpdateButton && (
            <Button
              variant="primary"
              onClick={handleUpdate}
              disabled={!isDirty || isLoading}
              loading={isLoading}
            >
              Update
            </Button>
          )}
        </SpaceBetween>
      </div>

      {/* Second Row: PropertyFilter (only if DateRangePicker is on first row) */}
      {includeDateRange && (
        <PropertyFilter
          query={filterQuery}
          onChange={({ detail }) => setFilterQuery(detail)}
          filteringProperties={activeFilterProperties.map((prop) => ({
            key: prop.key,
            propertyLabel: prop.propertyLabel,
            groupValuesLabel: prop.groupValuesLabel,
            operators: prop.operators || ['='],
          }))}
          filteringOptions={filteringOptions}
          filteringStatusType={filteringStatusType}
          onLoadItems={handleLoadItems}
          disabled={isLoading}
          filteringPlaceholder="Filter data"
          filteringEmpty="No matches found"
          filteringLoadingText="Loading options..."
          filteringFinishedText="End of results"
          hideOperations={true}
          i18nStrings={{
            filteringAriaLabel: 'Filter data',
            dismissAriaLabel: 'Dismiss',
            filteringPlaceholder: 'Filter data',
            groupValuesText: 'Values',
            groupPropertiesText: 'Properties',
            operatorsText: 'Operators',
            operationAndText: 'and',
            operationOrText: 'or',
            operatorLessText: 'Less than',
            operatorLessOrEqualText: 'Less than or equal',
            operatorGreaterText: 'Greater than',
            operatorGreaterOrEqualText: 'Greater than or equal',
            operatorContainsText: 'Contains',
            operatorDoesNotContainText: 'Does not contain',
            operatorEqualsText: 'Equals',
            operatorDoesNotEqualText: 'Does not equal',
            editTokenHeader: 'Edit filter',
            propertyText: 'Property',
            operatorText: 'Operator',
            valueText: 'Value',
            cancelActionText: 'Cancel',
            applyActionText: 'Apply',
            allPropertiesLabel: 'All properties',
            tokenLimitShowMore: 'Show more',
            tokenLimitShowFewer: 'Show fewer',
            clearFiltersText: 'Clear filters',
            removeTokenButtonAriaLabel: (token) => `Remove token ${token.propertyKey}`,
            enteredTextLabel: (text) => `Use: "${text}"`,
          }}
        />
      )}

      {/* Third Row: Grouping Controls (only if groupingMode is not 'none') */}
      {groupingMode !== 'none' && (
        <div>
          {groupingMode === 'additive' ? (
            <Multiselect
              selectedOptions={
                Array.isArray(grouping)
                  ? multiselectOptions.filter((opt) => grouping.includes(opt.value ?? ''))
                  : []
              }
              onChange={({ detail }) => {
                const selectedValues = detail.selectedOptions
                  .map((opt) => opt.value)
                  .filter((v): v is string => v !== undefined);
                setGrouping(selectedValues);
              }}
              options={multiselectOptions}
              placeholder="Select grouping dimensions"
              disabled={isLoading}
              selectedAriaLabel="Selected grouping dimensions"
            />
          ) : (
            <SegmentedControl
              selectedId={typeof grouping === 'string' ? grouping : groupingDimensions[0]?.value ?? ''}
              onChange={({ detail }) => setGrouping(detail.selectedId)}
              options={segmentedControlOptions}
            />
          )}
        </div>
      )}
    </SpaceBetween>
  );
};
