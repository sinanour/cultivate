import { useMemo } from 'react';
import BreadcrumbGroup, { type BreadcrumbGroupProps } from '@cloudscape-design/components/breadcrumb-group';
import Button from '@cloudscape-design/components/button';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import { GeographicAreaSelector } from '../common/GeographicAreaSelector';
import styles from './GeographicAreaFilterSelector.mobile.module.css';

export function GeographicAreaFilterSelector() {
  const {
    selectedGeographicAreaId,
    selectedGeographicArea,
    availableAreas,
    setGeographicAreaFilter,
    clearFilter,
    isLoading,
    setSearchQuery,
    isSearching,
  } = useGlobalGeographicFilter();

  const isMobile = useMediaQuery(BREAKPOINTS.mobile);

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
    if (!selectedGeographicAreaId || !selectedGeographicArea || isMobile) {
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
  }, [selectedGeographicAreaId, selectedGeographicArea, availableAreas, isMobile]);

  const handleBreadcrumbClick: BreadcrumbGroupProps['onFollow'] = (event) => {
    event.preventDefault();
    const areaId = event.detail.href.substring(1); // Remove the '#' prefix

    if (!areaId) return;

    // Backend handles authorization - just set the filter
    // If unauthorized, backend will return 403 and filter will be cleared via error event
    setGeographicAreaFilter(areaId);
  };

  return (
    <div className={isMobile ? styles.mobileContainer : styles.desktopContainer}>
      <div className={styles.selectorWrapper}>
        <div style={{ display: 'flex' }}>
          <div style={{ flex: 1 }}>
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
          {selectedGeographicAreaId && (
            <div className={styles.breadcrumbWrapper}>
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
      </div>
    </div>
  );
}
