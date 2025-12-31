import { useMemo } from 'react';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import BreadcrumbGroup, { type BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { getAreaTypeBadgeColor } from '../../utils/geographic-area.utils';
import type { AreaType } from '../../types';

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

export function GeographicAreaFilterSelector() {
  const {
    selectedGeographicAreaId,
    selectedGeographicArea,
    availableAreas,
    setGeographicAreaFilter,
    clearFilter,
    isLoading,
    formatAreaOption,
  } = useGlobalGeographicFilter();

  const options = useMemo(() => {
    const globalOption: HierarchicalOption = {
      label: 'Global',
      labelContent: <OptionLabel name="Global" areaType="WORLD" /> as any,
      value: '',
      description: 'No filter applied',
    };

    const areaOptions: HierarchicalOption[] = availableAreas.map(area => {
      const formatted = formatAreaOption(area);
      return {
        label: area.name,
        labelContent: <OptionLabel name={area.name} areaType={area.areaType} /> as any,
        value: area.id,
        description: formatted.description,
        hierarchyPath: area.hierarchyPath,
        areaType: area.areaType,
      };
    });

    return [globalOption, ...areaOptions];
  }, [availableAreas, formatAreaOption]);

  const selectedOption = useMemo(() => {
    if (!selectedGeographicAreaId) {
      return options[0]; // Global option
    }
    return options.find(opt => opt.value === selectedGeographicAreaId) || options[0];
  }, [selectedGeographicAreaId, options]);

  const handleChange: SelectProps['onChange'] = ({ detail }) => {
    const newValue = detail.selectedOption.value || null;
    setGeographicAreaFilter(newValue);
  };

  // Build breadcrumb items from the selected area's ancestry
  const breadcrumbItems = useMemo((): BreadcrumbGroupProps.Item[] => {
    if (!selectedGeographicAreaId || !selectedGeographicArea) {
      return [];
    }

    const items: BreadcrumbGroupProps.Item[] = [];
    
    // Find the selected area in availableAreas to get its ancestors
    const areaWithHierarchy = availableAreas.find(a => a.id === selectedGeographicAreaId);
    
    if (areaWithHierarchy && areaWithHierarchy.ancestors.length > 0) {
      // Reverse ancestors for breadcrumb: most distant to closest
      // Backend returns: [closest parent, ..., most distant ancestor]
      // Breadcrumb needs: [most distant ancestor, ..., closest parent]
      const reversedAncestors = [...areaWithHierarchy.ancestors].reverse();
      
      reversedAncestors.forEach((ancestor) => {
        items.push({
          text: ancestor.name,
          href: `#${ancestor.id}`,
        });
      });
    }

    // Add current area as last item
    items.push({
      text: selectedGeographicArea.name,
      href: `#${selectedGeographicArea.id}`,
    });

    return items;
  }, [selectedGeographicAreaId, selectedGeographicArea, availableAreas]);

  const handleBreadcrumbClick: BreadcrumbGroupProps['onFollow'] = (event) => {
    event.preventDefault();
    const areaId = event.detail.href.substring(1); // Remove the '#' prefix
    setGeographicAreaFilter(areaId);
  };

  return (
    <>
      <style>{`
        .awsui-select-option-content {
          width: 100% !important;
          display: block !important;
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ minWidth: '180px' }}>
          <Select
            selectedOption={selectedOption}
            onChange={handleChange}
            options={options}
            placeholder="Select geographic area"
            loadingText="Loading areas..."
            statusType={isLoading ? 'loading' : 'finished'}
            disabled={isLoading}
            filteringType="auto"
            expandToViewport
            selectedAriaLabel="Selected"
            inlineLabelText="Region Filter"
            renderHighlightedAriaLive={(highlighted) => 
              highlighted ? `${highlighted.label}${highlighted.description ? `, ${highlighted.description}` : ''}` : ''
            }
          />
        </div>
        {selectedGeographicAreaId && breadcrumbItems.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <BreadcrumbGroup
              items={breadcrumbItems}
              onFollow={handleBreadcrumbClick}
              ariaLabel="Geographic area hierarchy"
            />
            <Button
              variant="icon"
              iconName="close"
              ariaLabel="Clear geographic area filter"
              onClick={clearFilter}
            />
          </div>
        )}
      </div>
    </>
  );
}
