import React from 'react';
import { Route } from '@/types';
import { TravelMode } from '@/services/mapsService';
import TransitDetails from './TransitDetails';

interface RouteOptionsProps {
  routes: Route[];
  selectedRouteId: string;
  onRouteSelect: (routeId: string) => void;
  travelMode: TravelMode;
}

const RouteOptions: React.FC<RouteOptionsProps> = ({ routes, selectedRouteId, onRouteSelect, travelMode }) => {
  if (!routes || routes.length === 0) {
    return null;
  }

  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  return (
    <div className="bg-white rounded-lg shadow-md p-4 mb-4">
      <h3 className="text-lg font-semibold mb-3">Route Options</h3>
      
      <div className="space-y-4">
        {routes.map((route) => {
          const isSelected = route.id === selectedRouteId;
          
          return (
            <div 
              key={route.id}
              className={`border rounded-lg p-3 cursor-pointer transition-all ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'hover:border-gray-400'
              }`}
              onClick={() => onRouteSelect(route.id)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {travelMode === TravelMode.DRIVE ? '🚗' : 
                     travelMode === TravelMode.TRANSIT ? '🚌' : 
                     travelMode === TravelMode.WALK ? '🚶' : 
                     travelMode === TravelMode.BICYCLE ? '🚲' : '🏍️'}
                  </span>
                  <div>
                    <div className="font-medium">{route.duration}</div>
                    <div className="text-sm text-gray-600">{route.distance}</div>
                  </div>
                </div>
                
                {route.riskScore !== undefined && (
                  <div 
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      route.riskScore <= 3.3 ? 'bg-green-100 text-green-800' : 
                      route.riskScore <= 6.6 ? 'bg-yellow-100 text-yellow-800' : 
                      'bg-red-100 text-red-800'
                    }`}
                  >
                    Risk: {route.riskScore.toFixed(1)}
                  </div>
                )}
              </div>
              
              {/* Route details specific to mode */}
              {travelMode === TravelMode.TRANSIT && route.transitDetails && (
                <div className="mt-2">
                  <h4 className="text-sm font-medium mb-2">Transit Details:</h4>
                  <TransitDetails steps={route.transitDetails} />
                </div>
              )}
              
              {/* For walking/cycling, show additional info */}
              {(travelMode === TravelMode.WALK || travelMode === TravelMode.BICYCLE) && (
                <div className="mt-2 text-sm text-gray-600">
                  <div>Distance: {route.distance}</div>
                  <div>Estimated time: {route.duration}</div>
                </div>
              )}
              
              {/* Weather info if available */}
              {route.weather && (
                <div className="mt-2 text-sm flex items-center gap-1 text-gray-600">
                  <span>{route.weather.condition === 'Clear' ? '☀️' : 
                        route.weather.condition.includes('Cloud') ? '☁️' : 
                        route.weather.condition.includes('Rain') ? '🌧️' : '🌤️'}</span>
                  <span>{route.weather.temperature.toFixed(1)}°C, {route.weather.condition}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteOptions; 