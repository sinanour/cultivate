import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import { MapView } from '../components/features/MapView';
import { ActivityTypeService } from '../services/api/activity-type.service';

type MapMode = 'activities' | 'participantHomes' | 'venues' | 'activityCategories';

export default function MapViewPage() {
  const [mapMode, setMapMode] = useState<MapMode>('activities');

  // Fetch activity types for the legend
  const { data: activityTypes = [] } = useQuery({
    queryKey: ['activityTypes'],
    queryFn: () => ActivityTypeService.getActivityTypes(),
  });

  return (
    <ContentLayout>
      <Container 
        header={
          <Header 
            variant="h2"
            actions={
              <SegmentedControl
                selectedId={mapMode}
                onChange={({ detail }) => setMapMode(detail.selectedId as MapMode)}
                options={[
                  { id: 'activities', text: 'Activities' },
                  { id: 'activityCategories', text: 'By Category' },
                  { id: 'participantHomes', text: 'Participant Homes' },
                  { id: 'venues', text: 'Venues' }
                ]}
              />
            }
          >
            Map View
          </Header>
        }
        disableContentPaddings
      >
        <div style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          <MapView mode={mapMode} activityTypes={activityTypes} />
        </div>
      </Container>
    </ContentLayout>
  );
}
