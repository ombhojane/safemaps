import React from 'react';
import { TravelMode, SUPPORTED_TRAVEL_MODES } from '@/services/mapsService';
import { MapPin } from 'lucide-react';
import { Location } from '@/types';

interface TravelModeSelectorProps {
  selectedMode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  isLoading?: boolean;
  source?: Location;
  destination?: Location;
}

const TravelModeSelector: React.FC<TravelModeSelectorProps> = ({ 
  selectedMode, 
  onModeChange,
  isLoading = false,
  source,
  destination
}) => {
  // Travel mode options with icons and labels
  const travelModes = [
    { 
      mode: TravelMode.DRIVE, 
      label: 'Drive', 
      icon: '🚗'
    },
    { 
      mode: TravelMode.TRANSIT, 
      label: 'Transit', 
      icon: '🚌'
    },
    { 
      mode: TravelMode.WALK, 
      label: 'Walk', 
      icon: '🚶'
    }
  ];

  // Filter out unsupported modes
  const filteredModes = travelModes.filter(({ mode }) => 
    SUPPORTED_TRAVEL_MODES.includes(mode)
  );

  // Format location name to be more concise
  const formatLocationName = (location?: Location) => {
    if (!location) return '';
    // Split by commas and take first part (usually the street/place name)
    const parts = location.name.split(',');
    return parts[0].trim();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border mb-4">
      {/* Location Header */}
      {source && destination && (
        <div className="p-4 border-b">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <MapPin className="w-4 h-4" />
            <div className="flex-1 truncate">
              <span className="font-medium text-foreground">{formatLocationName(source)}</span>
              <span className="mx-2">→</span>
              <span className="font-medium text-foreground">{formatLocationName(destination)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Travel Mode Selector */}
      <div className="grid grid-cols-3 gap-1 p-1">
        {filteredModes.map(({ mode, label, icon }) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`flex flex-col items-center justify-center p-3 rounded-md transition-all ${
              selectedMode === mode 
                ? 'bg-primary/10 text-primary shadow-sm' 
                : 'hover:bg-gray-50 text-muted-foreground hover:text-foreground'
            }`}
            disabled={isLoading}
          >
            <span className="text-2xl mb-1">{icon}</span>
            <span className="text-xs font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TravelModeSelector; 