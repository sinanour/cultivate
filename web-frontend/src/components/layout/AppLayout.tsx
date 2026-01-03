import { Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppLayoutComponent from '@cloudscape-design/components/app-layout';
import SideNavigation, { type SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import Spinner from '@cloudscape-design/components/spinner';
import Icon from '@cloudscape-design/components/icon';
import { useAuth } from '../../hooks/useAuth';
import { useConnectionStatus } from '../../hooks/useConnectionStatus';
import { useGlobalGeographicFilter } from '../../hooks/useGlobalGeographicFilter';
import { GeographicAreaFilterSelector } from './GeographicAreaFilterSelector';

export function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isOnline } = useConnectionStatus();
  const { selectedGeographicAreaId } = useGlobalGeographicFilter();
  const [navigationOpen, setNavigationOpen] = useState(true);

  // Helper function to create menu item with icon on the left
  const createMenuItem = (text: string, iconName: string) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <Icon name={iconName as any} />
      <span>{text}</span>
    </span>
  );

  // CloudScape accepts React elements in text property despite TypeScript types
  const baseNavigationItems: SideNavigationProps['items'] = [
    // @ts-ignore - CloudScape handles React elements in text property
    { type: 'link', text: createMenuItem('Home', 'anchor-link'), href: '/' },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Management',
      items: [
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Geographic Areas', 'globe'), href: '/geographic-areas' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Venues', 'location-pin'), href: '/venues' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Participants', 'user-profile'), href: '/participants' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Activities', 'group'), href: '/activities' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Analytics',
      items: [
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Map View', 'map'), href: '/map' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Engagement', 'gen-ai'), href: '/analytics/engagement' },
        // @ts-ignore - CloudScape handles React elements in text property
        { type: 'link', text: createMenuItem('Growth', 'expand'), href: '/analytics/growth' },
      ],
    },
  ];

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
      ]
    : baseNavigationItems;

  return (
    <>
      <div style={{
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        backgroundColor: '#ffffff',
      }}>
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
              text: user?.email || 'User',
              description: user?.role,
              iconName: 'user-profile',
              items: [
                {
                  id: 'role',
                  text: `Role: ${user?.role}`,
                  disabled: true,
                },
                {
                  id: 'logout',
                  text: 'Logout',
                },
              ],
              onItemClick: ({ detail }) => {
                if (detail.id === 'logout') {
                  logout();
                  navigate('/login');
                }
              },
            },
          ]}
        />
        <div style={{ 
          padding: '8px 20px', 
          borderBottom: '2px solid #e9ebed', 
          backgroundColor: selectedGeographicAreaId ? '#f1fdf6' : '#ffffff',
          boxShadow: '0 1px 1px 0 rgba(0,28,36,0.3)',
          transition: 'background-color 0.2s ease',
        }}>
          <GeographicAreaFilterSelector />
        </div>
      </div>
      <AppLayoutComponent
        navigation={
          <SideNavigation
            activeHref={location.pathname}
            items={navigationItems}
            onFollow={(event) => {
              event.preventDefault();
              navigate(event.detail.href);
            }}
          />
        }
        navigationOpen={navigationOpen}
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
