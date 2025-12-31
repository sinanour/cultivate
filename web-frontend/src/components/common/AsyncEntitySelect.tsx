import React, { useState, useCallback, useMemo } from 'react';
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
  entityType: 'venue' | 'participant' | 'geographic-area';
  fetchFunction: (params: {
    page?: number;
    limit?: number;
    geographicAreaId?: string;
    search?: string;
  }) => Promise<{ data: any[] }>;
  formatOption: (entity: any) => AsyncEntitySelectOption;
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaLabel?: string;
  clearable?: boolean; // New prop to enable clear button
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
}) => {
  const [filterText, setFilterText] = useState('');
  
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

  // Fetch options based on search text and geographic filter
  const { data, isLoading, error } = useQuery({
    queryKey: [entityType, 'list', debouncedSearch, selectedGeographicAreaId],
    queryFn: () =>
      fetchFunction({
        page: 1,
        limit: 50,
        geographicAreaId: selectedGeographicAreaId || undefined,
        search: debouncedSearch || undefined,
      }),
    staleTime: 30000, // Cache for 30 seconds
  });

  // Format options for Autosuggest
  const options: AutosuggestProps.Option[] = useMemo(() => {
    if (!data?.data) return [];
    return data.data.map((entity) => {
      const formatted = formatOption(entity);
      return {
        value: formatted.value,
        label: formatted.label,
        description: formatted.description,
      };
    });
  }, [data, formatOption]);

  // Find the display text for the selected value
  const selectedLabel = useMemo(() => {
    const selected = options.find((opt) => opt.value === value);
    return selected?.label || '';
  }, [options, value]);

  const handleSelect = useCallback(
    (detail: AutosuggestProps.SelectDetail) => {
      if (detail.selectedOption) {
        onChange(detail.selectedOption.value || '');
        setFilterText(''); // Clear filter text after selection
      }
    },
    [onChange]
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
