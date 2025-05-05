import React from 'react';
import { TransitStep } from '@/types';

interface TransitDetailsProps {
  steps: TransitStep[];
}

const TransitDetails: React.FC<TransitDetailsProps> = ({ steps }) => {
  if (!steps || steps.length === 0) {
    return null;
  }

  // Get icon for transit type
  const getTransitIcon = (type: string, mode?: string) => {
    if (type === 'TRANSIT') {
      switch (mode?.toLowerCase()) {
        case 'bus': return '🚌';
        case 'subway': return '🚇';
        case 'train': return '🚆';
        case 'tram': return '🚊';
        case 'light_rail': return '🚈';
        case 'rail': return '🚆';
        case 'ferry': return '⛴️';
        default: return '🚌';
      }
    } else if (type === 'WALK') {
      return '🚶';
    } else if (type === 'DRIVE') {
      return '🚗';
    } else if (type === 'BICYCLE') {
      return '🚲';
    }
    return '➡️';
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-3 mb-2">
      <div className="space-y-3">
        {steps.map((step, index) => {
          if (step.type === 'TRANSIT') {
            // Render transit step with detailed information
            return (
              <div key={index} className="border-l-4 pl-3" style={{ borderColor: step.color || '#1A73E8' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{getTransitIcon(step.type, step.mode)}</span>
                  <div>
                    <span className="font-medium">{step.line}</span>
                    {step.headsign && (
                      <span className="text-gray-600 ml-2">towards {step.headsign}</span>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="text-gray-500">Depart</div>
                    <div className="font-medium">{step.departureStop}</div>
                    <div className="text-blue-600">{step.departureTime}</div>
                  </div>
                  
                  <div>
                    <div className="text-gray-500">Arrive</div>
                    <div className="font-medium">{step.arrivalStop}</div>
                    <div className="text-blue-600">{step.arrivalTime}</div>
                  </div>
                </div>
                
                <div className="text-sm text-gray-600 mt-2">
                  {step.numStops !== undefined && (
                    <div>{step.numStops} {step.numStops === 1 ? 'stop' : 'stops'}</div>
                  )}
                  {step.agency && <div>Operated by {step.agency}</div>}
                  <div>{step.durationText}</div>
                </div>
              </div>
            );
          } else {
            // Render walking/driving step with minimal information
            return (
              <div key={index} className="flex items-center gap-2 text-sm border-b pb-2">
                <span className="text-xl">{getTransitIcon(step.type)}</span>
                <div>
                  <span className="capitalize font-medium">{step.type.toLowerCase()}</span>
                  {step.durationText && <span className="text-gray-600 ml-2">{step.durationText}</span>}
                  {step.distance && <span className="text-gray-600 ml-2">({step.distance})</span>}
                </div>
              </div>
            );
          }
        })}
      </div>
    </div>
  );
};

export default TransitDetails; 