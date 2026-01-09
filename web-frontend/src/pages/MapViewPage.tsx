import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import ContentLayout from '@cloudscape-design/components/content-layout';
import Container from '@cloudscape-design/components/container';
import Header from '@cloudscape-design/components/header';
import SegmentedControl from '@cloudscape-design/components/segmented-control';
import Multiselect from '@cloudscape-design/components/multiselect';
import type { MultiselectProps } from '@cloudscape-design/components/multiselect';
import { MapView } from '../components/features/MapView.optimized';
import { PopulationService } from '../services/api/population.service';

type MapMode = 'activitiesByType' | 'activitiesByCategory' | 'participantHomes' | 'venues';

export default function MapViewPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Initialize from URL
  const [mapMode, setMapMode] = useState<MapMode>(() => {
    const urlMode = searchParams.get('mode');
    return (urlMode as MapMode) || 'activitiesByType';
  });
  
  const [selectedPopulations, setSelectedPopulations] = useState<MultiselectProps.Options>(() => {
    const urlPopIds = searchParams.getAll('populationIds');
    return urlPopIds.map(id => ({ label: '', value: id }));
  });

  // Fetch populations for filter
  const { data: allPopulations = [] } = useQuery({
    queryKey: ['populations'],
    queryFn: PopulationService.getPopulations,
  });

  const populationOptions: MultiselectProps.Options = allPopulations.map(pop => ({
    label: pop.name,
    value: pop.id,
  }));

  // Update population labels when populations load
  useEffect(() => {
    if (allPopulations.length > 0 && selectedPopulations.some(opt => !opt.label)) {
      const updated = selectedPopulations.map(opt => {
        const pop = allPopulations.find(p => p.id === opt.value);
        return pop ? { label: pop.name, value: pop.id } : opt;
      }).filter(opt => opt.label);
      
      if (JSON.stringify(updated) !== JSON.stringify(selectedPopulations)) {
        setSelectedPopulations(updated);
      }
    }
  }, [allPopulations, selectedPopulations]);

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    
    // Update mode
    params.set('mode', mapMode);
    
    // Update population filters
    params.delete('populationIds');
    if (selectedPopulations.length > 0) {
      selectedPopulations.forEach(pop => {
        if (pop.value) {
          params.append('populationIds', pop.value);
        }
      });
    }
    
    setSearchParams(params, { replace: true });
  }, [mapMode, selectedPopulations, searchParams, setSearchParams]);

  const selectedPopulationIds = selectedPopulations.map(opt => opt.value!).filter(Boolean);

  return (
    <ContentLayout>
      <Container 
        header={
          <Header 
            variant="h2"
            actions={
              <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                <SegmentedControl
                  selectedId={mapMode}
                  onChange={({ detail }) => setMapMode(detail.selectedId as MapMode)}
                  options={[
                    { id: 'activitiesByType', text: 'Activities by Type' },
                    { id: 'activitiesByCategory', text: 'Activities by Category' },
                    { id: 'participantHomes', text: 'Participant Homes' },
                    { id: 'venues', text: 'Venues' }
                  ]}
                />
                <div style={{ minWidth: '300px', minHeight: '64px' }}>
                  <Multiselect
                    selectedOptions={selectedPopulations}
                    onChange={({ detail }) => setSelectedPopulations(detail.selectedOptions)}
                    options={populationOptions}
                    placeholder="Filter by populations"
                    filteringType="auto"
                    tokenLimit={2}
                    disabled={mapMode === 'venues'}
                  />
                </div>
              </div>
            }
          >
            Map View
          </Header>
        }
        disableContentPaddings
      >
        <div style={{ height: 'calc(100vh - 200px)', minHeight: '500px' }}>
          <MapView 
            mode={mapMode}
            populationIds={selectedPopulationIds}
          />
        </div>
      </Container>
    </ContentLayout>
  );
}
