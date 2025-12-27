import { useContext } from 'react';
import { GlobalGeographicFilterContext } from '../contexts/GlobalGeographicFilterContext';

export const useGlobalGeographicFilter = () => {
  const context = useContext(GlobalGeographicFilterContext);
  
  if (context === undefined) {
    throw new Error('useGlobalGeographicFilter must be used within a GlobalGeographicFilterProvider');
  }
  
  return context;
};
