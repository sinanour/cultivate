import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { Autosuggest, type AutosuggestProps } from '@cloudscape-design/components';
import Button from '@cloudscape-design/components/button';
import SpaceBetween from '@cloudscape-design/components/space-between';
import { useQuery } from '@tanstack/react-query';
import { useDebounce } from '../../hooks/useDebounce';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';

export interface AsyncEntitySelectOption {
  value: string;
  label: string;
  description?: string;
}

export interface AsyncEntitySelectProps {
  value: string;
  onChange: (value: string) => void;
  entityType: 'venue' | 'participant' | 'geographic-area' | 'activity' | 'activity-type' | 'population';
  fetchFunction: (params: {
    page?: number;
    limit?: number;
    geographicAreaId?: string;
    filter?: Record<string, any>;
    fields?: string[];
  }) => Promise<{ data: any[]; pagination?: any }>;
  formatOption: (entity: any) => AsyncEntitySelectOption;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  clearable?: boolean; // New prop to enable clear button
  /** ID of a specific entity that must be included in options (e.g., when pre-selected) */
  ensureIncluded?: string | null;
  /** Function to fetch a single entity by ID (required when ensureIncluded is provided) */
  fetchByIdFunction?: (id: string) => Promise<any>;
}

export const AsyncEntitySelect: React.FC<AsyncEntitySelectProps> = ({
  value,
  onChange,
  entityType,
  fetchFunction,
  formatOption,
  placeholder = 'Select an option',
  disabled = false,
  invalid = false,
  ariaLabel,
  clearable = false,
  ensureIncluded,
  fetchByIdFunction,
}) => {
  const [filterText, setFilterText] = useState('');
  const [ensuredEntity, setEnsuredEntity] = useState<any | null>(null);
  const [hasEnsuredFetch, setHasEnsuredFetch] = useState(false);

  // Reset ensured entity state when ensureIncluded changes (e.g., after swap)
  useEffect(() => {
    // Only reset the fetch flag, keep the entity to prevent flicker
    setHasEnsuredFetch(false);
  }, [ensureIncluded]);

  // Also reset when value changes to a different entity (user selected a new entity)
  useEffect(() => {
    if (value && value !== ensureIncluded) {
      // Only reset the fetch flag, keep the entity to prevent flicker
      setHasEnsuredFetch(false);
    }
  }, [value, ensureIncluded]);
  
  // Try to get global geographic filter, but don't fail if context not available
  let selectedGeographicAreaId: string | null = null;
  try {
    const filterContext = useGlobalGeographicFilter();
    selectedGeographicAreaId = filterContext.selectedGeographicAreaId;
  } catch (e) {
    // Context not available yet, that's okay
  }

  // Debounce the search text to avoid excessive API calls
  const debouncedSearch = useDebounce(filterText, 300);

  // Reset hasEnsuredFetch when search query changes so we refetch with new results
  useEffect(() => {
    setHasEnsuredFetch(false);
  }, [debouncedSearch]);

  // Fetch options based on search text and geographic filter
  const { data, isLoading, error } = useQuery({
    queryKey: [entityType, 'list', debouncedSearch, selectedGeographicAreaId],
    queryFn: () =>
      fetchFunction({
        page: 1,
        limit: 50,
        geographicAreaId: selectedGeographicAreaId || undefined,
        filter: debouncedSearch ? { name: debouncedSearch } : undefined,
      }),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Fetch ensured entity if needed (only once, after initial data is loaded)
  // This handles both the ensureIncluded prop and the current value
  useEffect(() => {
    const entityIdToEnsure = ensureIncluded || value;

    if (!entityIdToEnsure || !fetchByIdFunction || hasEnsuredFetch || !data?.data) {
      return;
    }

    // Check if entity is already in the initial results
    const hasEntity = data.data.some((entity: any) => entity.id === entityIdToEnsure);
    if (hasEntity) {
      setHasEnsuredFetch(true); // Mark as complete, no need to fetch
      return;
    }

    const fetchEnsured = async () => {
      try {
        const entity = await fetchByIdFunction(entityIdToEnsure);
        setEnsuredEntity(entity);
        setHasEnsuredFetch(true);
      } catch (error) {
        console.error('Failed to fetch ensured entity:', error, {
          entityIdToEnsure,
          entityType,
        });
        setHasEnsuredFetch(true); // Mark as attempted even on failure
      }
    };

    fetchEnsured();
  }, [ensureIncluded, value, fetchByIdFunction, hasEnsuredFetch, data, entityType]);

  // Format options for Autosuggest
  const options: AutosuggestProps.Option[] = useMemo(() => {
    if (!data?.data) return [];

    const searchResults = data.data.map((entity) => {
      const formatted = formatOption(entity);
      return {
        value: formatted.value,
        label: formatted.label,
        description: formatted.description,
      };
    });

    // Check if ensured entity is already in results
    // Use ensureIncluded if provided, otherwise use value (for user selections)
    const entityIdToEnsure = ensureIncluded || value;
    if (ensuredEntity && entityIdToEnsure) {
      const hasEnsured = searchResults.some(opt => opt.value === entityIdToEnsure);
      if (!hasEnsured) {
        const formatted = formatOption(ensuredEntity);
        searchResults.unshift({
          value: formatted.value,
          label: formatted.label,
          description: formatted.description,
        });
      }
    }

    return searchResults;
  }, [data, formatOption, ensuredEntity, ensureIncluded, value]);

  // Find the display text for the selected value
  const selectedLabel = useMemo(() => {
    const selected = options.find((opt) => opt.value === value);
    return selected?.label || '';
  }, [options, value]);

  const handleSelect = useCallback(
    (detail: AutosuggestProps.SelectDetail) => {
      if (detail.selectedOption) {
        // Find the full entity data from current options before clearing search
        const selectedEntity = data?.data?.find((entity: any) => entity.id === detail.selectedOption?.value);

        // Immediately set as ensured entity to prevent flicker when search clears
        if (selectedEntity && fetchByIdFunction) {
          setEnsuredEntity(selectedEntity);
          setHasEnsuredFetch(true);
        }

        onChange(detail.selectedOption.value || '');
        setFilterText(''); // Clear filter text after selection
      }
    },
    [onChange, data, fetchByIdFunction]
  );

  const handleChange = useCallback(
    (detail: { value: string }) => {
      setFilterText(detail.value);
      // If user clears the input completely, clear the selection
      if (detail.value === '') {
        onChange('');
      }
    },
    [onChange]
  );

  const handleClear = useCallback(() => {
    setFilterText('');
    onChange('');
  }, [onChange]);

  if (clearable) {
    return (
      <SpaceBetween direction="horizontal" size="xs">
        <div style={{ flex: 1 }}>
          <Autosuggest
            value={filterText || selectedLabel}
            onChange={({ detail }) => handleChange(detail)}
            onSelect={({ detail }) => handleSelect(detail)}
            options={options}
            placeholder={placeholder}
            disabled={disabled}
            invalid={invalid}
            ariaLabel={ariaLabel || `Select ${entityType}`}
            statusType={isLoading ? 'loading' : error ? 'error' : 'finished'}
            loadingText="Loading options..."
            errorText="Error loading options"
            empty="No matches found"
            enteredTextLabel={(text) => `Use: "${text}"`}
            filteringType="manual"
          />
        </div>
        {value && (
          <Button
            iconName="close"
            variant="icon"
            onClick={handleClear}
            ariaLabel="Clear selection"
            disabled={disabled}
          />
        )}
      </SpaceBetween>
    );
  }

  return (
    <Autosuggest
      value={filterText || selectedLabel}
      onChange={({ detail }) => handleChange(detail)}
      onSelect={({ detail }) => handleSelect(detail)}
      options={options}
      placeholder={placeholder}
      disabled={disabled}
      invalid={invalid}
      ariaLabel={ariaLabel || `Select ${entityType}`}
      statusType={isLoading ? 'loading' : error ? 'error' : 'finished'}
      loadingText="Loading options..."
      errorText="Error loading options"
      empty="No matches found"
      enteredTextLabel={(text) => `Use: "${text}"`}
      filteringType="manual"
    />
  );
};
