import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SpaceBetween from '@cloudscape-design/components/space-between';
import Box from '@cloudscape-design/components/box';
import Link from '@cloudscape-design/components/link';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <ContentLayout
      header={
        <Header variant="h1">
          Welcome, {user?.email || 'User'}
        </Header>
      }
    >
      <SpaceBetween size="l">
        <Container>
          <Box variant="p">
            Welcome to the Community Activity Tracker. Use the navigation menu to manage activities,
            participants, venues, and view analytics.
          </Box>
        </Container>

        <Container header={<Header variant="h2">Quick Links</Header>}>
          <SpaceBetween size="m">
            <div>
              <Link href="/participants">Manage Participants</Link>
              <Box variant="small" color="text-body-secondary">
                View and manage community participants
              </Box>
            </div>
            <div>
              <Link href="/activities">Manage Activities</Link>
              <Box variant="small" color="text-body-secondary">
                View and manage community activities
              </Box>
            </div>
            <div>
              <Link href="/venues">Manage Venues</Link>
              <Box variant="small" color="text-body-secondary">
                View and manage activity venues
              </Box>
            </div>
            <div>
              <Link href="/map">Map View</Link>
              <Box variant="small" color="text-body-secondary">
                Visualize activities by geography
              </Box>
            </div>
            <div>
              <Link href="/analytics/engagement">Engagement Analytics</Link>
              <Box variant="small" color="text-body-secondary">
                View engagement metrics and charts
              </Box>
            </div>
            <div>
              <Link href="/analytics/growth">Growth Analytics</Link>
              <Box variant="small" color="text-body-secondary">
                View growth trends over time
              </Box>
            </div>
          </SpaceBetween>
        </Container>
      </SpaceBetween>
    </ContentLayout>
  );
}
