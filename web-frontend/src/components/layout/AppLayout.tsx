import { Suspense, useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppLayoutComponent from '@cloudscape-design/components/app-layout';
import SideNavigation, { type SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import Spinner from '@cloudscape-design/components/spinner';
import Icon from '@cloudscape-design/components/icon';
import { useAuth } from '../../hooks/useAuth';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { BREAKPOINTS } from '../../utils/responsive';
import { GeographicAreaFilterSelector } from './GeographicAreaFilterSelector';
import styles from './AppLayout.mobile.module.css';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isOnline } = useConnectionStatus();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const isMobile = useMediaQuery(BREAKPOINTS.mobile);
  const [navigationOpen, setNavigationOpen] = useState(!isMobile);

  // Close navigation by default on mobile when viewport changes
  useEffect(() => {
    if (isMobile) {
      setNavigationOpen(false);
    } else {
      setNavigationOpen(true);
    }
  }, [isMobile]);

  // Helper function to create menu item with icon on the left
  // Accepts either an icon name or a URL (URLs should start with '/' or 'http')
  const createMenuItem = (text: string, iconNameOrUrl: string) => {
    const isUrl = iconNameOrUrl.startsWith('/') || iconNameOrUrl.startsWith('http');
    return (
      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {isUrl ? <Icon url={iconNameOrUrl} /> : <Icon name={iconNameOrUrl as any} />}
        <span>{text}</span>
      </span>
    );
  };

  // CloudScape accepts React elements in text property despite TypeScript types
  // Filter navigation items based on user role
  const getBaseNavigationItems = (): SideNavigationProps['items'] => {
    const isPIIRestricted = user?.role === 'PII_RESTRICTED';

    const managementItems: any[] = [
      // @ts-ignore - CloudScape handles React elements in text property
      { type: 'link', text: createMenuItem('Geographic Areas', 'globe'), href: '/geographic-areas' },
    ];

    // Add venue, participants, and activities only for non-PII_RESTRICTED users
    if (!isPIIRestricted) {
      managementItems.push(
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Venues', 'location-pin'), href: '/venues' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Participants', 'user-profile'), href: '/participants' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Activities', 'group'), href: '/activities' }
      );
    }

    const analyticsItems: any[] = [];

    // Add map view only for non-PII_RESTRICTED users
    if (!isPIIRestricted) {
      analyticsItems.push(
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Map View', 'map'), href: '/map' }
      );
    }

    // Add engagement and growth for all users
    analyticsItems.push(
      // @ts-ignore - CloudScape handles React elements in text property
      { type: 'link', text: createMenuItem('Engagement', 'gen-ai'), href: '/analytics/engagement' },
      // @ts-ignore - CloudScape handles React elements in text property
      { type: 'link', text: createMenuItem('Growth', 'expand'), href: '/analytics/growth' }
    );

    return [
      // @ts-ignore - CloudScape handles React elements in text property
      { type: 'link', text: createMenuItem('Home', '/home.svg'), href: '/' },
      { type: 'divider' },
      {
        type: 'section',
        text: 'Management',
        items: managementItems,
      },
      { type: 'divider' },
      {
        type: 'section',
        text: 'Analytics',
        items: analyticsItems,
      },
    ] as SideNavigationProps['items'];
  };

  const baseNavigationItems = getBaseNavigationItems();

  // Add Administration section for administrators
  const navigationItems: SideNavigationProps['items'] = user?.role === 'ADMINISTRATOR'
    ? [
        // @ts-ignore - Spread operator with CloudScape navigation items
        ...baseNavigationItems,
        { type: 'divider' },
        {
          type: 'section',
          text: 'Administration',
          items: [
            // @ts-ignore - CloudScape handles React elements in text property
            { type: 'link', text: createMenuItem('Configuration', 'settings'), href: '/configuration' },
            // @ts-ignore - CloudScape handles React elements in text property
            { type: 'link', text: createMenuItem('Users', 'lock-private'), href: '/users' },
          ],
        },
        { type: 'divider' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('About', 'status-info'), href: '/about' },
      ]
    : [
        // @ts-ignore - Spread operator with CloudScape navigation items
        ...baseNavigationItems,
        { type: 'divider' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('About', 'status-info'), href: '/about' },
      ];

  return (
    <>
      <div 
        className={styles.topNavigationContainer}
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1001,
          backgroundColor: '#ffffff',
        }}
      >
        <TopNavigation
          identity={{
            href: '/',
            title: 'Cultivate',
            logo: {
              src: '/icon-no-bg.svg',
              alt: 'Cultivate Logo',
            },
          }}
          utilities={[
            {
              type: 'button',
              text: isOnline ? 'Online' : 'Offline',
              iconName: isOnline ? 'status-positive' : 'status-negative',
              disableUtilityCollapse: true,
            },
            {
              type: 'menu-dropdown',
              text: user?.displayName || user?.email || 'User',
              description: user?.role,
              iconName: 'user-profile',
              items: [
                {
                  id: 'role',
                  text: `Role: ${user?.role}`,
                  disabled: true,
                },
                {
                  id: 'profile',
                  text: 'My Profile',
                  iconName: 'settings',
                },
                {
                  id: 'logout',
                  text: 'Logout',
                },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === 'logout') {
                  logout(); // Hard navigation to /login is handled inside logout()
                } else if (detail.id === 'profile') {
                  navigate('/profile');
                }
              },
            },
          ]}
        />
      </div>
      <div
        className={styles.filterContainer}
        style={{ 
          position: isMobile ? 'relative' : 'sticky',
          top: isMobile ? 'auto' : '56px',
          zIndex: 1000,
          padding: isMobile ? '12px 16px' : '8px 20px',
          borderBottom: '2px solid #e9ebed',
          backgroundColor: selectedGeographicAreaId ? '#f1fdf6' : '#ffffff',
          boxShadow: '0 1px 1px 0 rgba(0,28,36,0.3)',
          transition: 'background-color 0.2s ease',
        }}
      >
        <GeographicAreaFilterSelector />
      </div>
      <AppLayoutComponent
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            items={navigationItems}
            onFollow={(event) => {
              event.preventDefault();
              navigate(event.detail.href);
              // Auto-close navigation on mobile after selection
              if (isMobile) {
                setNavigationOpen(false);
              }
            }}
          />
        }
        navigationOpen={navigationOpen}
        navigationWidth={isMobile ? 280 : 320}
        onNavigationChange={({ detail }: { detail: { open: boolean } }) => setNavigationOpen(detail.open)}
        content={
          <Suspense fallback={<Spinner size="large" />}>
            <Outlet />
          </Suspense>
        }
        toolsHide
      />
    </>
  );
}
