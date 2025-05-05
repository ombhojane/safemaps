import React from 'react';
import { TravelMode, SUPPORTED_TRAVEL_MODES } from '@/services/mapsService';
import { Route } from '@/types';

interface TravelModeTabsProps {
  selectedMode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  routesByMode?: Partial<Record<TravelMode, Route[]>>;
  isLoading?: boolean;
}

const TravelModeTabs: React.FC<TravelModeTabsProps> = ({ 
  selectedMode, 
  onModeChange,
  routesByMode = {},
  isLoading = false
}) => {
  // Define the combined fastest time for drive and two-wheeler
  const driveTime = getFastestRouteTime(routesByMode[TravelMode.DRIVE]);
  const twoWheelerTime = getFastestRouteTime(routesByMode[TravelMode.TWO_WHEELER]);
  const bestDriveTime = driveTime && twoWheelerTime ? 
    (parseInt(driveTime) < parseInt(twoWheelerTime) ? driveTime : twoWheelerTime) : 
    driveTime || twoWheelerTime;

  // Travel mode options with icons and time estimates
  const travelModes = [
    { 
      mode: TravelMode.DRIVE, 
      icon: '🚗',
      label: 'Drive',
      time: bestDriveTime,
    },
    { 
      mode: TravelMode.TRANSIT, 
      icon: '🚌',
      label: 'Transit',
      time: getFastestRouteTime(routesByMode[TravelMode.TRANSIT]),
    },
    { 
      mode: TravelMode.WALK, 
      icon: '🚶',
      label: 'Walk',
      time: getFastestRouteTime(routesByMode[TravelMode.WALK]),
    }
  ];

  // Helper function to get fastest route time for a travel mode
  function getFastestRouteTime(routes?: Route[]): string {
    if (!routes || routes.length === 0) return '';
    
    // Find the fastest route
    const fastestRoute = routes.reduce((fastest, route) => {
      const currentDuration = parseDuration(route.duration);
      const fastestDuration = parseDuration(fastest.duration);
      return currentDuration < fastestDuration ? route : fastest;
    }, routes[0]);
    
    // Return just the number part (e.g., "25 min" -> "25")
    const match = fastestRoute.duration.match(/\d+/);
    return match ? match[0] : '';
  }
  
  // Helper to parse duration string to minutes
  function parseDuration(duration: string): number {
    const hourMatch = duration.match(/(\d+)\s*hr/);
    const minuteMatch = duration.match(/(\d+)\s*min/);
    
    let minutes = 0;
    if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
    if (minuteMatch) minutes += parseInt(minuteMatch[1]);
    
    return minutes;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden mb-3">
      <div className="flex justify-between">
        {travelModes.map(({ mode, icon, label, time }) => (
          <button
            key={`${mode}-${label}`}
            onClick={() => onModeChange(mode)}
            className={`flex flex-col items-center py-2 px-3 flex-1 transition-colors ${
              selectedMode === mode
                ? 'border-b-4 border-blue-500'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
            disabled={isLoading}
          >
            <div className="text-lg">
              {icon}
            </div>
            <div className="text-sm font-medium mt-1">
              {time ? `${time} min` : label}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TravelModeTabs; 