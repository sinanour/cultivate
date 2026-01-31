# Design Document: Mobile Responsive Design

## Overview

This design extends the Web Frontend package to provide a mobile-optimized experience for smartphone users in portrait orientation (320px to 767px width). The implementation uses CSS media queries, responsive CloudScape components, and React hooks to adapt layouts for mobile devices while preserving the existing desktop and tablet experience.

The design follows a mobile-first responsive approach where mobile-specific styles are applied via media queries at the 768px breakpoint. All changes are purely presentational (CSS and layout) with no changes to application logic or data flow.

## Architecture

### Responsive Strategy

**Breakpoint System:**
- Mobile: 320px - 767px (new support)
- Tablet: 768px - 1024px (existing)
- Desktop: 1025px - 1920px (existing)

**CSS Media Query Pattern:**
```css
/* Mobile-first approach */
.component {
  /* Mobile styles (default) */
}

@media (min-width: 768px) {
  .component {
    /* Tablet and desktop styles */
  }
}
```

**Implementation Approach:**
1. Add viewport meta tag to index.html
2. Create mobile-specific CSS modules for each component
3. Use CloudScape's responsive props where available
4. Implement custom responsive hooks for complex layouts
5. Test on real devices and browser dev tools

### Technology Stack

**Existing (No Changes):**
- React 18+ with TypeScript
- CloudScape Design System
- Vite build system
- CSS Modules

**New Additions:**
- CSS media queries for responsive breakpoints
- React useMediaQuery custom hook for JavaScript-based responsive logic
- Mobile-specific CSS modules (*.mobile.module.css)

## Components and Interfaces

### 1. Viewport Configuration

**index.html Updates:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes">
```

**Rationale:** Enables proper mobile rendering and allows users to zoom for accessibility.

### 2. Responsive Utilities

**useMediaQuery Hook:**
```typescript
// hooks/useMediaQuery.ts
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, [query]);
  
  return matches;
}

// Usage
const isMobile = useMediaQuery('(max-width: 767px)');
```

**Responsive Breakpoints Constants:**
```typescript
// utils/responsive.ts
export const BREAKPOINTS = {
  mobile: '(max-width: 767px)',
  tablet: '(min-width: 768px) and (max-width: 1024px)',
  desktop: '(min-width: 1025px)',
  tabletAndUp: '(min-width: 768px)',
} as const;
```

### 3. Mobile Navigation Pattern

**AppLayout Component Updates:**

The AppLayout component will use CloudScape's built-in responsive navigation behavior:

```typescript
// components/layout/AppLayout.tsx
const isMobile = useMediaQuery(BREAKPOINTS.mobile);

<AppLayoutComponent
  navigation={<SideNavigation ... />}
  navigationOpen={isMobile ? false : navigationOpen}
  navigationWidth={isMobile ? 280 : 320}
  onNavigationChange={({ detail }) => {
    setNavigationOpen(detail.open);
    // Auto-close on mobile after navigation
    if (isMobile && detail.open) {
      // Will be closed by navigation event
    }
  }}
  ...
/>
```

**Mobile Navigation CSS:**
```css
/* AppLayout.mobile.module.css */
@media (max-width: 767px) {
  .mobileNavToggle {
    min-width: 44px;
    min-height: 44px;
  }
  
  .navigationOverlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 999;
  }
}
```

### 4. Mobile Header Layout

**TopNavigation Mobile Styles:**
```css
/* AppLayout.mobile.module.css */
@media (max-width: 767px) {
  .headerContainer {
    position: sticky;
    top: 0;
    z-index: 1000;
  }
  
  .filterContainer {
    padding: 12px 16px;
    width: 100%;
  }
  
  .filterSelector {
    width: 100%;
  }
  
  .utilityButton {
    min-width: 44px;
    min-height: 44px;
  }
}
```

**GeographicAreaFilterSelector Mobile Updates:**
```typescript
// components/layout/GeographicAreaFilterSelector.tsx
const isMobile = useMediaQuery(BREAKPOINTS.mobile);

<div className={isMobile ? styles.mobileContainer : styles.desktopContainer}>
  <Geographic_Area_Selector
    {...props}
    className={isMobile ? styles.mobileSelector : undefined}
  />
</div>
```

### 5. Mobile Table Layouts (Card-Based)

**Responsive Table Component:**
```typescript
// components/common/ResponsiveTable.tsx
interface ResponsiveTableProps<T> {
  items: T[];
  columns: ColumnDefinition<T>[];
  mobileCardRenderer?: (item: T) => React.ReactNode;
  onItemClick?: (item: T) => void;
}

export function ResponsiveTable<T>({ items, columns, mobileCardRenderer, onItemClick }: ResponsiveTableProps<T>) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  if (isMobile && mobileCardRenderer) {
    return (
      <div className={styles.mobileCardList}>
        {items.map((item, index) => (
          <div key={index} className={styles.mobileCard} onClick={() => onItemClick?.(item)}>
            {mobileCardRenderer(item)}
          </div>
        ))}
      </div>
    );
  }
  
  return <Table columns={columns} items={items} />;
}
```

**Mobile Card Styles:**
```css
/* ResponsiveTable.mobile.module.css */
@media (max-width: 767px) {
  .mobileCardList {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  
  .mobileCard {
    background: white;
    border: 1px solid #e9ebed;
    border-radius: 8px;
    padding: 16px;
    box-shadow: 0 1px 1px 0 rgba(0,28,36,0.1);
    cursor: pointer;
    min-height: 44px;
  }
  
  .mobileCard:active {
    background: #f9fafb;
  }
  
  .cardHeader {
    font-weight: 600;
    font-size: 16px;
    margin-bottom: 8px;
  }
  
  .cardDetails {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 14px;
    color: #5f6b7a;
  }
  
  .cardActions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e9ebed;
  }
  
  .cardAction {
    flex: 1;
    min-height: 44px;
  }
}
```

**ParticipantList Mobile Card Example:**
```typescript
// components/features/ParticipantList.tsx
const renderMobileCard = (participant: Participant) => (
  <>
    <div className={styles.cardHeader}>{participant.name}</div>
    <div className={styles.cardDetails}>
      {participant.email && <div>📧 {participant.email}</div>}
      {participant.phone && <div>📱 {participant.phone}</div>}
      {participant.populations?.map(pop => (
        <Badge key={pop.id}>{pop.name}</Badge>
      ))}
    </div>
    <div className={styles.cardActions}>
      <Button onClick={() => navigate(`/participants/${participant.id}`)}>View</Button>
      <Button onClick={() => navigate(`/participants/${participant.id}/edit`)}>Edit</Button>
    </div>
  </>
);

<ResponsiveTable
  items={participants}
  columns={columns}
  mobileCardRenderer={renderMobileCard}
  onItemClick={(p) => navigate(`/participants/${p.id}`)}
/>
```

### 6. Mobile Form Layouts

**Form Container Component:**
```typescript
// components/common/ResponsiveFormContainer.tsx
export function ResponsiveFormContainer({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  return (
    <div className={isMobile ? styles.mobileForm : styles.desktopForm}>
      {children}
    </div>
  );
}
```

**Mobile Form Styles:**
```css
/* ResponsiveFormContainer.mobile.module.css */
@media (max-width: 767px) {
  .mobileForm {
    padding: 16px;
  }
  
  .mobileForm .formField {
    width: 100%;
    margin-bottom: 16px;
  }
  
  .mobileForm .formSection {
    margin-bottom: 24px;
  }
  
  .mobileForm .formActions {
    display: flex;
    flex-direction: column;
    gap: 12px;
    position: sticky;
    bottom: 0;
    background: white;
    padding: 16px;
    border-top: 1px solid #e9ebed;
    margin: 0 -16px;
  }
  
  .mobileForm .formButton {
    width: 100%;
    min-height: 44px;
  }
  
  /* Venue form map stacking */
  .mobileForm .venueFormLayout {
    display: flex;
    flex-direction: column;
  }
  
  .mobileForm .venueFormFields {
    width: 100%;
    order: 1;
  }
  
  .mobileForm .venueFormMap {
    width: 100%;
    height: 300px;
    order: 2;
    margin-top: 16px;
  }
}

@media (min-width: 768px) {
  .desktopForm .venueFormLayout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}
```

### 7. Mobile FilterGroupingPanel Layout

**FilterGroupingPanel Mobile Updates:**
```typescript
// components/common/FilterGroupingPanel.tsx
const isMobile = useMediaQuery(BREAKPOINTS.mobile);

const layoutClass = isMobile ? styles.mobileLayout : styles.desktopLayout;

<div className={layoutClass}>
  <div className={styles.filterRow}>
    {includeDateRange && <DateRangePicker className={styles.dateRange} />}
    <PropertyFilter className={styles.propertyFilter} />
  </div>
  {groupingMode !== 'none' && (
    <div className={styles.groupingRow}>
      {/* Grouping controls */}
    </div>
  )}
  <div className={styles.actionRow}>
    {!hideUpdateButton && <Button variant="primary">Update</Button>}
    <Button>Clear All</Button>
  </div>
</div>
```

**Mobile FilterGroupingPanel Styles:**
```css
/* FilterGroupingPanel.mobile.module.css */
@media (max-width: 767px) {
  .mobileLayout {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
  }
  
  .filterRow {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  
  .dateRange,
  .propertyFilter {
    width: 100%;
  }
  
  .groupingRow {
    width: 100%;
  }
  
  .actionRow {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .actionRow button {
    width: 100%;
    min-height: 44px;
  }
}

@media (min-width: 768px) {
  .desktopLayout .filterRow {
    display: flex;
    flex-direction: row;
    gap: 16px;
    align-items: flex-start;
  }
  
  .desktopLayout .actionRow {
    display: flex;
    flex-direction: row;
    gap: 12px;
  }
}
```

### 8. Mobile Dashboard Layouts

**Dashboard Container Component:**
```typescript
// components/common/ResponsiveDashboard.tsx
export function ResponsiveDashboard({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  return (
    <div className={isMobile ? styles.mobileDashboard : styles.desktopDashboard}>
      {children}
    </div>
  );
}
```

**Mobile Dashboard Styles:**
```css
/* ResponsiveDashboard.mobile.module.css */
@media (max-width: 767px) {
  .mobileDashboard {
    padding: 16px;
  }
  
  .mobileDashboard .chartContainer {
    width: 100%;
    margin-bottom: 24px;
  }
  
  .mobileDashboard .chart {
    width: 100%;
    height: 300px;
  }
  
  .mobileDashboard .metricsGrid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  
  .mobileDashboard .metricCard {
    width: 100%;
  }
  
  .mobileDashboard .summaryTable {
    width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  
  .mobileDashboard .legend {
    font-size: 12px;
    padding: 8px;
  }
}

@media (min-width: 768px) {
  .desktopDashboard .metricsGrid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 16px;
  }
  
  .desktopDashboard .chartRow {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 24px;
  }
}
```

### 9. Mobile Map View

**MapView Mobile Updates:**
```typescript
// components/features/MapView.tsx
const isMobile = useMediaQuery(BREAKPOINTS.mobile);

<div className={isMobile ? styles.mobileMapContainer : styles.desktopMapContainer}>
  <div className={styles.mapFilters}>
    <FilterGroupingPanel {...filterProps} />
  </div>
  <div className={styles.mapWrapper}>
    <Map
      className={styles.map}
      markers={markers}
      onMarkerClick={handleMarkerClick}
    />
    {legend && (
      <div className={isMobile ? styles.mobileLegend : styles.desktopLegend}>
        {legend}
      </div>
    )}
  </div>
</div>
```

**Mobile Map Styles:**
```css
/* MapView.mobile.module.css */
@media (max-width: 767px) {
  .mobileMapContainer {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }
  
  .mapFilters {
    flex-shrink: 0;
  }
  
  .mapWrapper {
    flex: 1;
    position: relative;
    min-height: 400px;
  }
  
  .map {
    width: 100%;
    height: 100%;
  }
  
  .mobileLegend {
    position: absolute;
    bottom: 16px;
    left: 16px;
    right: 16px;
    background: white;
    border-radius: 8px;
    padding: 12px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    font-size: 12px;
    max-height: 150px;
    overflow-y: auto;
  }
  
  .mapControls {
    position: absolute;
    top: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .mapControl {
    min-width: 44px;
    min-height: 44px;
    background: white;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
  }
}
```

### 10. Mobile Detail Views

**Detail View Container:**
```typescript
// components/common/ResponsiveDetailView.tsx
export function ResponsiveDetailView({ children }: { children: React.ReactNode }) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  return (
    <div className={isMobile ? styles.mobileDetail : styles.desktopDetail}>
      {children}
    </div>
  );
}
```

**Mobile Detail Styles:**
```css
/* ResponsiveDetailView.mobile.module.css */
@media (max-width: 767px) {
  .mobileDetail {
    padding: 16px;
  }
  
  .mobileDetail .detailHeader {
    margin-bottom: 16px;
  }
  
  .mobileDetail .detailActions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 16px;
  }
  
  .mobileDetail .detailAction {
    width: 100%;
    min-height: 44px;
  }
  
  .mobileDetail .detailSection {
    margin-bottom: 24px;
  }
  
  .mobileDetail .relatedList {
    width: 100%;
  }
  
  .mobileDetail .relatedItem {
    padding: 12px;
    border-bottom: 1px solid #e9ebed;
    min-height: 44px;
  }
}
```

## Implementation Strategy

### Phase 1: Foundation (Week 1)
1. Add viewport meta tag to index.html
2. Create useMediaQuery hook and responsive utilities
3. Create base mobile CSS modules
4. Update AppLayout for mobile navigation

### Phase 2: Core Components (Week 2)
5. Implement ResponsiveTable component
6. Update ParticipantList, ActivityList, VenueList with mobile cards
7. Implement ResponsiveFormContainer
8. Update all form pages with mobile layouts

### Phase 3: Advanced Features (Week 3)
9. Update FilterGroupingPanel for mobile
10. Implement ResponsiveDashboard
11. Update EngagementDashboard and GrowthDashboard
12. Update MapView for mobile

### Phase 4: Polish and Testing (Week 4)
13. Update all detail views
14. Implement mobile typography and spacing
15. Test on real devices
16. Fix bugs and refine touch targets

## Testing Strategy

### Device Testing
- iPhone SE (320px width)
- iPhone 12/13/14 (390px width)
- Samsung Galaxy S21 (360px width)
- Google Pixel 5 (393px width)

### Browser Testing
- Mobile Safari (iOS 14+)
- Chrome Mobile (Android 10+)
- Samsung Internet (14+)

### Test Scenarios
1. Navigation: Open/close menu, navigate between pages
2. Forms: Fill out and submit participant/activity forms
3. Lists: Browse and interact with entity lists
4. Filters: Apply filters and grouping on dashboards
5. Map: View and interact with map markers
6. Detail Views: View entity details and related data

### Automated Testing
- Visual regression tests using Playwright
- Responsive layout tests at key breakpoints
- Touch target size validation
- Accessibility tests (WCAG 2.1 AA)

## Performance Considerations

### CSS Optimization
- Use CSS modules to scope mobile styles
- Minimize media query duplication
- Leverage CSS Grid and Flexbox for layouts
- Avoid JavaScript-based layout calculations where possible

### Bundle Size
- Mobile CSS modules loaded on-demand
- No additional JavaScript libraries required
- Estimated bundle size increase: < 5%

### Rendering Performance
- Use CSS transforms for animations
- Minimize reflows and repaints
- Optimize touch event handlers
- Use passive event listeners where appropriate

## Accessibility

### Touch Targets
- Minimum 44x44px for all interactive elements
- Adequate spacing between touch targets (8px minimum)
- Visual feedback for touch interactions

### Screen Readers
- Maintain semantic HTML structure
- Provide appropriate ARIA labels
- Ensure focus management works on mobile

### Keyboard Navigation
- Support external keyboard on mobile devices
- Maintain logical tab order
- Provide visible focus indicators

## Design Rationale

**Why Card-Based Tables on Mobile:**
- Tables with many columns don't fit on narrow screens
- Cards allow vertical stacking of information
- Better touch interaction with larger tap targets
- Familiar mobile UI pattern

**Why Collapsed Navigation by Default:**
- Maximizes content area on small screens
- Reduces cognitive load
- Standard mobile navigation pattern
- Easy to access when needed

**Why Full-Width Form Inputs:**
- Easier to tap and interact with
- Reduces horizontal scrolling risk
- Better use of limited screen width
- Consistent with mobile form best practices

**Why Vertical Stacking:**
- Eliminates horizontal scrolling
- Natural reading flow on mobile
- Easier to implement and maintain
- Better performance than complex responsive grids

## Migration Path

### Backward Compatibility
- All existing desktop/tablet functionality preserved
- No breaking changes to component APIs
- Mobile styles additive, not replacing existing styles
- Gradual rollout possible (component by component)

### Rollout Strategy
1. Deploy to staging environment
2. Test with internal users on mobile devices
3. Gather feedback and iterate
4. Deploy to production with feature flag
5. Monitor analytics and user feedback
6. Remove feature flag after validation

### 11. Mobile Icon-Only Buttons

**Button Icon Mapping Component:**
```typescript
// utils/mobile-button-icons.ts
import { IconProps } from '@cloudscape-design/components';

export const MOBILE_BUTTON_ICONS: Record<string, IconProps['name']> = {
  // Create/Add actions
  'create': 'add-plus',
  'add': 'add-plus',
  'new': 'add-plus',
  
  // Filter actions
  'update': 'filter',
  'apply': 'filter',
  'clear all': 'undo',
  'reset': 'undo',
  
  // CSV actions (already have icons, just hide text)
  'import csv': 'upload',
  'export csv': 'download',
  
  // Activity actions
  'mark complete': 'status-positive',
  'cancel activity': 'status-negative',
  
  // Navigation actions
  'back': 'arrow-left',
  
  // Report actions
  'run report': 'redo',
} as const;

export function getMobileButtonIcon(buttonText: string): IconProps['name'] | undefined {
  const normalizedText = buttonText.toLowerCase().trim();
  return MOBILE_BUTTON_ICONS[normalizedText];
}
```

**Responsive Button Component:**
```typescript
// components/common/ResponsiveButton.tsx
import { Button, ButtonProps, Icon } from '@cloudscape-design/components';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import { getMobileButtonIcon } from '../../utils/mobile-button-icons';

interface ResponsiveButtonProps extends ButtonProps {
  children: React.ReactNode;
  mobileIcon?: ButtonProps['iconName'];
  mobileAriaLabel?: string;
}

export function ResponsiveButton({ 
  children, 
  mobileIcon, 
  mobileAriaLabel,
  iconName,
  ...props 
}: ResponsiveButtonProps) {
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  
  // Auto-detect icon from button text if not provided
  const autoIcon = typeof children === 'string' 
    ? getMobileButtonIcon(children) 
    : undefined;
  
  const effectiveMobileIcon = mobileIcon || autoIcon;
  
  if (isMobile && effectiveMobileIcon) {
    return (
      <Button
        {...props}
        iconName={effectiveMobileIcon}
        ariaLabel={mobileAriaLabel || (typeof children === 'string' ? children : undefined)}
      />
    );
  }
  
  return (
    <Button {...props} iconName={iconName}>
      {children}
    </Button>
  );
}
```

**FilterGroupingPanel Button Updates:**
```typescript
// components/common/FilterGroupingPanel.tsx
import { ResponsiveButton } from './ResponsiveButton';

// Replace custom styled buttons with standard CloudScape buttons
<div className={styles.actionRow}>
  {!hideUpdateButton && (
    <ResponsiveButton 
      variant="primary"
      onClick={onUpdate}
      mobileIcon="filter"
      mobileAriaLabel="Update filters"
    >
      Update
    </ResponsiveButton>
  )}
  <ResponsiveButton 
    onClick={onClearAll}
    mobileIcon="undo"
    mobileAriaLabel="Clear all filters"
  >
    Clear All
  </ResponsiveButton>
</div>
```

**List Page Button Updates:**
```typescript
// Example: ParticipantList.tsx
<ResponsiveButton 
  variant="primary"
  onClick={() => navigate('/participants/new')}
  mobileIcon="add-plus"
  mobileAriaLabel="Create new participant"
>
  Create Participant
</ResponsiveButton>

<ResponsiveButton 
  iconName="upload"
  onClick={handleImportCSV}
  mobileAriaLabel="Import participants from CSV"
>
  Import CSV
</ResponsiveButton>

<ResponsiveButton 
  iconName="download"
  onClick={handleExportCSV}
  mobileAriaLabel="Export participants to CSV"
>
  Export CSV
</ResponsiveButton>
```

**Detail Page Button Updates:**
```typescript
// Example: ActivityDetail.tsx
<ResponsiveButton 
  onClick={() => navigate('/activities')}
  mobileIcon="arrow-left"
  mobileAriaLabel="Back to activities"
>
  Back to Activities
</ResponsiveButton>

<ResponsiveButton 
  variant="primary"
  onClick={handleMarkComplete}
  mobileIcon="status-positive"
  mobileAriaLabel="Mark activity as complete"
>
  Mark Complete
</ResponsiveButton>

<ResponsiveButton 
  onClick={handleCancelActivity}
  mobileIcon="status-negative"
  mobileAriaLabel="Cancel this activity"
>
  Cancel Activity
</ResponsiveButton>
```

**Dashboard Button Updates:**
```typescript
// Example: EngagementDashboard.tsx, GrowthDashboard.tsx
<ResponsiveButton 
  variant="primary"
  onClick={handleRunReport}
  mobileIcon="redo"
  mobileAriaLabel="Run analytics report"
>
  Run Report
</ResponsiveButton>
```

**Mobile Button Styles:**
```css
/* ResponsiveButton.mobile.module.css */
@media (max-width: 767px) {
  /* Icon-only buttons maintain minimum touch target */
  .iconOnlyButton {
    min-width: 44px;
    min-height: 44px;
    padding: 12px;
  }
  
  /* Ensure icon is centered and appropriately sized */
  .iconOnlyButton .icon {
    font-size: 20px;
  }
}
```

**Accessibility Considerations:**
- All icon-only buttons MUST have aria-label attributes
- aria-label should describe the button action clearly
- Screen readers will announce the aria-label instead of missing text
- Visual users rely on familiar icon patterns from CloudScape

**Icon Selection Rationale:**
- **add-plus**: Universal symbol for creation/addition
- **filter**: Represents filtering/updating data views
- **undo**: Represents clearing/resetting to default state
- **upload/download**: Standard icons for CSV import/export
- **status-positive**: Green checkmark for completion
- **status-negative**: Red X for cancellation
- **arrow-left**: Standard back navigation icon
- **redo**: Represents running/executing an action

## Future Enhancements

Out of scope for this spec but potential future work:

1. Landscape orientation optimization
2. Tablet-specific layout improvements
3. Mobile-specific gestures (swipe to delete, pull to refresh)
4. Progressive Web App enhancements (install prompt, offline indicators)
5. Mobile performance optimizations (lazy loading, code splitting)
6. Native app features (camera, geolocation, push notifications)
