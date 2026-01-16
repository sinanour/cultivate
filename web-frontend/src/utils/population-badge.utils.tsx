import React from 'react';
import Badge from '@cloudscape-design/components/badge';
import Box from '@cloudscape-design/components/box';

export interface Population {
  id: string;
  name: string;
}

/**
 * Renders population badges for a participant
 * @param populations - Array of population objects from API response
 * @returns JSX element with sorted population badges or null if no populations
 */
export function renderPopulationBadges(populations: Population[] | undefined | null): React.ReactNode {
  if (!populations || populations.length === 0) {
    return null;
  }

  // Sort populations alphabetically by name
  const sortedPopulations = [...populations].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Box display="inline" margin={{ left: 'xs' }}>
      {sortedPopulations.map((pop, index) => (
        <React.Fragment key={pop.id}>
          <Badge color="blue">{pop.name}</Badge>
          {index < sortedPopulations.length - 1 && (
            <Box display="inline" margin={{ left: 'xxs', right: 'xxs' }} />
          )}
        </React.Fragment>
      ))}
    </Box>
  );
}
