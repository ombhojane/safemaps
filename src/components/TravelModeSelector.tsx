import React from 'react';
import { TravelMode, SUPPORTED_TRAVEL_MODES } from '@/services/mapsService';

interface TravelModeSelectorProps {
  selectedMode: TravelMode;
  onModeChange: (mode: TravelMode) => void;
  isLoading?: boolean;
}

const TravelModeSelector: React.FC<TravelModeSelectorProps> = ({ 
  selectedMode, 
  onModeChange,
  isLoading = false
}) => {
  // Travel mode options with icons and labels
  const travelModes = [
    { 
      mode: TravelMode.DRIVE, 
      label: 'Drive', 
      icon: '🚗',
      description: 'Car or motorcycle route',
    },
    { 
      mode: TravelMode.TRANSIT, 
      label: 'Transit', 
      icon: '🚌',
      description: 'Public transportation',
    },
    { 
      mode: TravelMode.WALK, 
      label: 'Walk', 
      icon: '🚶',
      description: 'Walking directions',
    }
  ];

  // Filter out unsupported modes
  const filteredModes = travelModes.filter(({ mode }) => 
    SUPPORTED_TRAVEL_MODES.includes(mode)
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-2 mb-4">
      <div className="flex justify-between items-center">
        {filteredModes.map(({ mode, label, icon, description }) => (
          <button
            key={mode}
            onClick={() => onModeChange(mode)}
            className={`flex flex-col items-center p-2 rounded-md transition-colors ${
              selectedMode === mode 
                ? 'bg-blue-100 text-blue-700' 
                : 'hover:bg-gray-100'
            }`}
            disabled={isLoading}
            title={description}
          >
            <span className="text-2xl mb-1">{icon}</span>
            <span className="text-sm font-medium">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TravelModeSelector; 