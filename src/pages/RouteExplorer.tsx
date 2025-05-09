import React, { useState, useEffect } from 'react';
import TravelModeSelector from '@/components/TravelModeSelector';
import RouteDisplay from '@/components/RouteDisplay';
import SafestRoute from '@/components/SafestRoute';
import { computeRoutes, TravelMode } from '@/services/mapsService';
import { Route, Location } from '@/types';
import { useLocation as useRouterLocation, useNavigate } from 'react-router-dom';

const RouteExplorer: React.FC = () => {
  const [selectedTravelMode, setSelectedTravelMode] = useState<TravelMode>(TravelMode.DRIVE);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  
  const location = useRouterLocation();
  const navigate = useNavigate();
  
  // Extract source and destination from URL parameters or use defaults
  const queryParams = new URLSearchParams(location.search);
  const sourceParam = queryParams.get('source');
  const destParam = queryParams.get('destination');
  
  // Default locations (can be replaced with user's current location)
  const defaultSource: Location = {
    name: sourceParam || "Current Location",
    coordinates: { lat: 37.7749, lng: -122.4194 } // San Francisco
  };
  
  const defaultDestination: Location = {
    name: destParam || "Destination",
    coordinates: { lat: 37.7833, lng: -122.4167 } // San Francisco downtown
  };
  
  // Initial source and destination states
  const [source] = useState<Location>(defaultSource);
  const [destination] = useState<Location>(defaultDestination);
  
  // Fetch routes whenever travel mode changes
  useEffect(() => {
    const fetchRoutes = async () => {
      setLoading(true);
      try {
        const newRoutes = await computeRoutes(source, destination, selectedTravelMode);
        setRoutes(newRoutes);
        
        // Select the first route by default
        if (newRoutes.length > 0 && (!selectedRouteId || !newRoutes.find(r => r.id === selectedRouteId))) {
          setSelectedRouteId(newRoutes[0].id);
        }
      } catch (error) {
        console.error('Error fetching routes:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRoutes();
  }, [selectedTravelMode, source, destination]);
  
  // Handle travel mode change
  const handleTravelModeChange = (mode: TravelMode) => {
    setSelectedTravelMode(mode);
  };
  
  // Handle route selection
  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
  };
  
  // Navigate to detailed route view
  const viewRouteDetails = () => {
    if (selectedRouteId) {
      navigate(`/route/${selectedRouteId}`);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Route Explorer</h1>
      
      {/* Source and destination info */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex items-center mb-2">
          <div className="h-6 w-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs mr-2">A</div>
          <div className="font-medium">{source.name}</div>
        </div>
        <div className="flex items-center">
          <div className="h-6 w-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs mr-2">B</div>
          <div className="font-medium">{destination.name}</div>
        </div>
      </div>
      
      {/* Travel mode selector */}
      <TravelModeSelector 
        selectedMode={selectedTravelMode} 
        onModeChange={handleTravelModeChange} 
      />
      
      {/* Loading indicator */}
      {loading && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex justify-center items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2">Loading routes...</span>
          </div>
        </div>
      )}
      
      {/* Route display */}
      {!loading && routes.length > 0 && (
        <>
          {/* Safest Route Display */}
          <SafestRoute 
            routes={routes} 
            onRouteSelect={handleRouteSelect}
            travelMode={selectedTravelMode}
            isLoading={loading}
          />
          
          {/* All Routes Display */}
          <RouteDisplay 
            routes={routes} 
            selectedRouteId={selectedRouteId} 
            onRouteSelect={handleRouteSelect}
            travelMode={selectedTravelMode}
          />
        </>
      )}
      
      {/* View details button */}
      {!loading && selectedRouteId && (
        <button 
          onClick={viewRouteDetails}
          className="mt-4 w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-md transition-colors"
        >
          View Detailed Route
        </button>
      )}
    </div>
  );
};

export default RouteExplorer; 