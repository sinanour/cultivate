import { render, screen } from '@testing-library/react';
import { VenueDisplay } from '../VenueDisplay';
import { describe, it, expect } from 'vitest';

describe('VenueDisplay', () => {
  const mockVenue = {
    id: 'venue-123',
    name: 'Community Center',
    address: '123 Main Street',
    geographicAreaId: 'area-1',
  };

  it('should display venue name for ADMINISTRATOR role', () => {
    render(
      <VenueDisplay 
        venue={mockVenue} 
        currentUserRole="ADMINISTRATOR" 
      />
    );
    expect(screen.getByText('Community Center')).toBeInTheDocument();
  });

  it('should display venue name for EDITOR role', () => {
    render(
      <VenueDisplay 
        venue={mockVenue} 
        currentUserRole="EDITOR" 
      />
    );
    expect(screen.getByText('Community Center')).toBeInTheDocument();
  });

  it('should display venue name for READ_ONLY role', () => {
    render(
      <VenueDisplay 
        venue={mockVenue} 
        currentUserRole="READ_ONLY" 
      />
    );
    expect(screen.getByText('Community Center')).toBeInTheDocument();
  });

  it('should display address for PII_RESTRICTED role', () => {
    render(
      <VenueDisplay 
        venue={mockVenue} 
        currentUserRole="PII_RESTRICTED" 
      />
    );
    expect(screen.getByText('123 Main Street')).toBeInTheDocument();
    expect(screen.queryByText('Community Center')).not.toBeInTheDocument();
  });

  it('should display address as fallback when name is null', () => {
    const venueWithoutName = {
      ...mockVenue,
      name: null,
    };
    
    render(
      <VenueDisplay 
        venue={venueWithoutName} 
        currentUserRole="ADMINISTRATOR" 
      />
    );
    expect(screen.getByText('123 Main Street')).toBeInTheDocument();
  });

  it('should handle null venue gracefully', () => {
    const { container } = render(
      <VenueDisplay 
        venue={null as any} 
        currentUserRole="ADMINISTRATOR" 
      />
    );
    expect(container.textContent).toBe('');
  });
});
