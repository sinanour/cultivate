import { useMemo } from 'react';
import BreadcrumbGroup, { type BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { GeographicAreaSelector } from '../common/GeographicAreaSelector';

export function GeographicAreaFilterSelector() {
  const {
    selectedGeographicAreaId,
    selectedGeographicArea,
    availableAreas,
    setGeographicAreaFilter,
    clearFilter,
    isLoading,
    isAuthorizedArea,
    setSearchQuery,
    isSearching,
  } = useGlobalGeographicFilter();

  const handleChange = (areaId: string | null) => {
    setGeographicAreaFilter(areaId);
    // Clear search query when selection is made
    setSearchQuery('');
  };

  const handleLoadItems = (filteringText: string) => {
    setSearchQuery(filteringText);
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
        // All ancestors are clickable
        // Authorized ancestors will set filter to that area
        // Unauthorized ancestors will clear the filter (go to "Global")
        items.push({
          text: ancestor.name,
          href: `#${ancestor.id}`,
        });
      });
    }

    // Add current area as last item (always clickable since it's the selected filter)
    items.push({
      text: selectedGeographicArea.name,
      href: `#${selectedGeographicArea.id}`,
    });

    return items;
  }, [selectedGeographicAreaId, selectedGeographicArea, availableAreas]);

  const handleBreadcrumbClick: BreadcrumbGroupProps['onFollow'] = (event) => {
    event.preventDefault();
    const areaId = event.detail.href.substring(1); // Remove the '#' prefix
    
    if (!areaId) return;
    
    // If clicking on an authorized area, set filter to that area
    // If clicking on an unauthorized ancestor, clear the filter (go to "Global")
    if (isAuthorizedArea(areaId)) {
      setGeographicAreaFilter(areaId);
    } else {
      clearFilter();
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
      <div style={{ minWidth: '180px' }}>
        <GeographicAreaSelector
          value={selectedGeographicAreaId}
          onChange={handleChange}
          options={availableAreas}
          loading={isLoading || isSearching}
          placeholder={selectedGeographicAreaId ? undefined : 'Global (All Areas)'}
          inlineLabelText="Region Filter"
          onLoadItems={handleLoadItems}
          filteringType="manual"
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
  );
}
