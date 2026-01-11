import React, { useState, useMemo } from 'react';
import {
  SpaceBetween,
  Button,
  DateRangePicker,
  PropertyFilter,
  Multiselect,
  SegmentedControl,
} from '@cloudscape-design/components';
import type {
  PropertyFilterProps,
  DateRangePickerProps,
  MultiselectProps,
  SegmentedControlProps,
} from '@cloudscape-design/components';

export interface FilterGroupingState {
  dateRange: { startDate?: string; endDate?: string } | null;
  filterTokens: PropertyFilterProps.Query;
  grouping: string[] | string; // Array for additive, string for exclusive
}

export interface FilterProperty {
  key: string;
  propertyLabel: string;
  groupValuesLabel: string;
  operators?: PropertyFilterProps.ComparisonOperator[];
}

export interface GroupingDimension {
  value: string;
  label: string;
}

interface FilterGroupingPanelProps {
  filterProperties: FilterProperty[];
  groupingMode: 'additive' | 'exclusive';
  groupingDimensions: GroupingDimension[];
  initialDateRange?: { startDate?: string; endDate?: string } | null;
  initialFilterTokens?: PropertyFilterProps.Query;
  initialGrouping?: string[] | string;
  onUpdate: (state: FilterGroupingState) => void;
  onLoadItems?: PropertyFilterProps['onLoadItems'];
  filteringOptions?: PropertyFilterProps.FilteringOption[];
  filteringStatusType?: 'pending' | 'loading' | 'finished' | 'error';
  isLoading?: boolean;
  disablePopulationFilter?: boolean;
}

export const FilterGroupingPanel: React.FC<FilterGroupingPanelProps> = ({
  filterProperties,
  groupingMode,
  groupingDimensions,
  initialDateRange = null,
  initialFilterTokens = { tokens: [], operation: 'and' },
  initialGrouping,
  onUpdate,
  onLoadItems,
  filteringOptions = [],
  filteringStatusType = 'finished',
  isLoading = false,
  disablePopulationFilter = false,
}) => {
  // Internal state for pending changes
  const [dateRange, setDateRange] = useState<DateRangePickerProps.Value | null>(
    initialDateRange
      ? {
          type: 'absolute',
          startDate: initialDateRange.startDate || '',
          endDate: initialDateRange.endDate || '',
        }
      : null
  );
  const [filterQuery, setFilterQuery] = useState<PropertyFilterProps.Query>(
    initialFilterTokens
  );
  const [grouping, setGrouping] = useState<string[] | string>(
    initialGrouping || (groupingMode === 'additive' ? [] : groupingDimensions[0]?.value || '')
  );

  // Track last applied state to determine if changes are pending
  const [lastAppliedState, setLastAppliedState] = useState<FilterGroupingState>({
    dateRange: initialDateRange || null,
    filterTokens: initialFilterTokens,
    grouping: initialGrouping || (groupingMode === 'additive' ? [] : groupingDimensions[0]?.value || ''),
  });

  // Determine if there are pending changes
  const isDirty = useMemo(() => {
    const currentDateRange =
      dateRange?.type === 'absolute'
        ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
        : null;
    const lastDateRange = lastAppliedState.dateRange;

    const dateRangeChanged =
      JSON.stringify(currentDateRange) !== JSON.stringify(lastDateRange);
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

  const handleUpdate = () => {
    const currentDateRange =
      dateRange?.type === 'absolute'
        ? { startDate: dateRange.startDate, endDate: dateRange.endDate }
        : null;

    const newState: FilterGroupingState = {
      dateRange: currentDateRange,
      filterTokens: filterQuery,
      grouping,
    };

    setLastAppliedState(newState);
    onUpdate(newState);
  };

  const handleClearAll = () => {
    setDateRange(null);
    setFilterQuery({ tokens: [], operation: 'and' });
    const defaultGrouping = groupingMode === 'additive' ? [] : groupingDimensions[0]?.value || '';
    setGrouping(defaultGrouping);
  };

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
    <SpaceBetween size="m">
      <SpaceBetween direction="horizontal" size="m">
        {/* Date Range Picker */}
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

        {/* Property Filter */}
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
          onLoadItems={onLoadItems}
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
      </SpaceBetween>

      {/* Grouping Controls and Action Buttons Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px' }}>
        {/* Grouping Controls - Left Side */}
        <div style={{ flex: 1 }}>
          {groupingMode === 'additive' ? (
            <Multiselect
              selectedOptions={
                Array.isArray(grouping)
                  ? multiselectOptions.filter((opt) => grouping.includes(opt.value || ''))
                  : []
              }
              onChange={({ detail }) => {
                const selectedValues = detail.selectedOptions.map((opt) => opt.value || '');
                setGrouping(selectedValues);
              }}
              options={multiselectOptions}
              placeholder="Select grouping dimensions"
              disabled={isLoading}
              selectedAriaLabel="Selected grouping dimensions"
            />
          ) : (
            <SegmentedControl
              selectedId={typeof grouping === 'string' ? grouping : groupingDimensions[0]?.value || ''}
              onChange={({ detail }) => setGrouping(detail.selectedId)}
              options={segmentedControlOptions}
            />
          )}
        </div>

        {/* Action Buttons - Right Side */}
        <SpaceBetween direction="horizontal" size="xs">
          <Button onClick={handleClearAll} disabled={isLoading}>
            Clear All
          </Button>
          <Button
            variant="primary"
            onClick={handleUpdate}
            disabled={!isDirty || isLoading}
            loading={isLoading}
          >
            Update
          </Button>
        </SpaceBetween>
      </div>
    </SpaceBetween>
  );
};
