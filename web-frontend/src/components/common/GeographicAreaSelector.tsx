import { useMemo } from 'react';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import type { AreaType, GeographicAreaWithHierarchy } from '../../types';

interface HierarchicalOption extends SelectProps.Option {
  hierarchyPath?: string;
  areaType?: AreaType;
}

const OptionLabel = ({ name, areaType }: { name: string; areaType?: AreaType }) => (
  <Box display="block" variant="div">
    {/* Left: area name */}
    <Box>{name}</Box>
    {/* Right: area type badge */}
    {areaType && (
      <Box>
        <Badge color={getAreaTypeBadgeColor(areaType)}>{areaType}</Badge>
      </Box>
    )}
  </Box>
);

export interface GeographicAreaSelectorProps {
  value: string | null;
  onChange: (areaId: string | null) => void;
  options: GeographicAreaWithHierarchy[];
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  placeholder?: string;
  inlineLabelText?: string;
  ariaLabel?: string;
}

export function GeographicAreaSelector({
  value,
  onChange,
  options: areas,
  loading = false,
  disabled = false,
  error,
  placeholder = 'Select a geographic area',
  inlineLabelText,
  ariaLabel = 'Geographic area',
}: GeographicAreaSelectorProps) {
  const options = useMemo((): HierarchicalOption[] => {
    return areas.map(area => {
      const description = area.hierarchyPath || 'No parent areas';
      
      return {
        label: area.name,
        labelContent: <OptionLabel name={area.name} areaType={area.areaType} /> as any,
        value: area.id,
        description,
        hierarchyPath: area.hierarchyPath,
        areaType: area.areaType,
      };
    });
  }, [areas]);

  const selectedOption = useMemo(() => {
    if (!value) {
      return null;
    }
    return options.find(opt => opt.value === value) || null;
  }, [value, options]);

  const handleChange: SelectProps['onChange'] = ({ detail }) => {
    const newValue = detail.selectedOption.value || null;
    onChange(newValue);
  };

  return (
    <>
      <style>{`
        .awsui-select-option-content {
          width: 100% !important;
          display: block !important;
        }
      `}</style>
      <Select
        selectedOption={selectedOption}
        onChange={handleChange}
        options={options}
        placeholder={placeholder}
        loadingText="Loading areas..."
        statusType={loading ? 'loading' : 'finished'}
        disabled={disabled || loading}
        filteringType="auto"
        expandToViewport
        selectedAriaLabel="Selected"
        inlineLabelText={inlineLabelText}
        ariaLabel={ariaLabel}
        invalid={!!error}
        renderHighlightedAriaLive={(highlighted) => 
          highlighted ? `${highlighted.label}${highlighted.description ? `, ${highlighted.description}` : ''}` : ''
        }
      />
      {error && (
        <Box color="text-status-error" fontSize="body-s" margin={{ top: 'xxxs' }}>
          {error}
        </Box>
      )}
    </>
  );
}
