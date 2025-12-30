import { Suspense, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import AppLayoutComponent from '@cloudscape-design/components/app-layout';
import SideNavigation, { type SideNavigationProps } from '@cloudscape-design/components/side-navigation';
import TopNavigation from '@cloudscape-design/components/top-navigation';
import Spinner from '@cloudscape-design/components/spinner';
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

  const baseNavigationItems: SideNavigationProps['items'] = [
    { type: 'link', text: 'Dashboard', href: '/dashboard' },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Configuration',
      items: [
        { type: 'link', text: 'Activity Configuration', href: '/configuration' },
        { type: 'link', text: 'Participant Roles', href: '/participant-roles' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Management',
      items: [
        { type: 'link', text: 'Geographic Areas', href: '/geographic-areas' },
        { type: 'link', text: 'Venues', href: '/venues' },
        { type: 'link', text: 'Activities', href: '/activities' },
        { type: 'link', text: 'Participants', href: '/participants' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Visualization',
      items: [
        { type: 'link', text: 'Map View', href: '/map' },
      ],
    },
    { type: 'divider' },
    {
      type: 'section',
      text: 'Analytics',
      items: [
        { type: 'link', text: 'Engagement', href: '/analytics/engagement' },
        { type: 'link', text: 'Growth', href: '/analytics/growth' },
      ],
    },
  ];

  // Add Users section for administrators
  const navigationItems: SideNavigationProps['items'] = user?.role === 'ADMINISTRATOR'
    ? [
        ...baseNavigationItems,
        { type: 'divider' },
        {
          type: 'section',
          text: 'Administration',
          items: [
            { type: 'link', text: 'Users', href: '/users' },
          ],
        },
      ]
    : baseNavigationItems;

  return (
    <>
      <TopNavigation
        identity={{
          href: '/',
          title: 'Community Activity Tracker',
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
