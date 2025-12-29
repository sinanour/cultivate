import { useContext } from 'react';
import { GlobalGeographicFilterContext } from '../contexts/GlobalGeographicFilterContext';

export function useGlobalGeographicFilter() {
  const context = useContext(GlobalGeographicFilterContext);
  if (!context) {
    throw new Error('useGlobalGeographicFilter must be used within GlobalGeographicFilterProvider');
  }
  return context;
}
