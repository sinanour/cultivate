import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import Select, { type SelectProps } from '@cloudscape-design/components/select';
import SpaceBetween from '@cloudscape-design/components/space-between';
import BreadcrumbGroup, { type BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import { GeographicAreaService } from '../../services/api/geographic-area.service';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import type { GeographicArea } from '../../types';

interface HierarchicalOption extends SelectProps.Option {
  geographicArea?: GeographicArea;
  level?: number;
}

const buildHierarchicalOptions = (areas: GeographicArea[]): HierarchicalOption[] => {
  // Create a map for quick lookup
  const areaMap = new Map<string, GeographicArea>();
  areas.forEach(area => areaMap.set(area.id, area));

  // Find root areas (no parent)
  const rootAreas = areas.filter(area => !area.parentGeographicAreaId);

  // Recursive function to build options with indentation
  const buildOptions = (area: GeographicArea, level: number = 0): HierarchicalOption[] => {
    const option: HierarchicalOption = {
      label: area.name,
      value: area.id,
      description: area.areaType,
      geographicArea: area,
      level,
    };

    // Find children
    const children = areas
      .filter(a => a.parentGeographicAreaId === area.id)
      .sort((a, b) => a.name.localeCompare(b.name));

    // Recursively add children
    const childOptions = children.flatMap(child => buildOptions(child, level + 1));

    return [option, ...childOptions];
  };

  // Build options starting from root areas
  const options = rootAreas
    .sort((a, b) => a.name.localeCompare(b.name))
    .flatMap(area => buildOptions(area));

  return options;
};

export function GeographicAreaFilterSelector() {
  const {
    selectedGeographicAreaId,
    selectedGeographicArea,
    setGeographicAreaFilter,
    clearFilter,
    isLoading: isFilterLoading,
  } = useGlobalGeographicFilter();

  const { data: geographicAreas = [], isLoading: isAreasLoading } = useQuery({
    queryKey: ['geographicAreas'],
    queryFn: () => GeographicAreaService.getGeographicAreas(),
  });

  const options = useMemo(() => {
    const globalOption: HierarchicalOption = {
      label: 'Global (All Areas)',
      value: '',
      description: 'No filter applied',
    };

    const hierarchicalOptions = buildHierarchicalOptions(geographicAreas);

    return [globalOption, ...hierarchicalOptions];
  }, [geographicAreas]);

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

  const isLoading = isAreasLoading || isFilterLoading;

  // Build breadcrumb items from the selected area's ancestry
  const breadcrumbItems = useMemo((): BreadcrumbGroupProps.Item[] => {
    if (!selectedGeographicAreaId || !selectedGeographicArea) {
      return [];
    }

    const items: BreadcrumbGroupProps.Item[] = [];
    const areaMap = new Map<string, GeographicArea>();
    geographicAreas.forEach(area => areaMap.set(area.id, area));

    // Build ancestry chain
    let currentArea: GeographicArea | undefined = selectedGeographicArea;
    const ancestry: GeographicArea[] = [];

    while (currentArea) {
      ancestry.unshift(currentArea);
      currentArea = currentArea.parentGeographicAreaId
        ? areaMap.get(currentArea.parentGeographicAreaId)
        : undefined;
    }

    // Convert to breadcrumb items
    ancestry.forEach((area, index) => {
      items.push({
        text: area.name,
        href: `#${area.id}`,
      });
    });

    return items;
  }, [selectedGeographicAreaId, selectedGeographicArea, geographicAreas]);

  const handleBreadcrumbClick: BreadcrumbGroupProps['onFollow'] = (event) => {
    event.preventDefault();
    const areaId = event.detail.href.substring(1); // Remove the '#' prefix
    setGeographicAreaFilter(areaId);
  };

  return (
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
        />
      </div>
      {selectedGeographicAreaId && breadcrumbItems.length > 0 && (
        <>
          <div style={{ paddingTop: '4px' }}>
            <BreadcrumbGroup
              items={breadcrumbItems}
              onFollow={handleBreadcrumbClick}
              ariaLabel="Geographic area hierarchy"
            />
          </div>
          <div style={{ paddingTop: '4px' }}>
            <Button
              variant="icon"
              iconName="close"
              ariaLabel="Clear geographic area filter"
              onClick={clearFilter}
            />
          </div>
        </>
      )}
    </div>
  );
}
