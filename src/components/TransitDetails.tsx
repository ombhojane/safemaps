import React from 'react';
import { TransitStep } from '@/types';
import { formatDistanceTime } from '@/lib/utils';
import { ArrowRight, Clock, Navigation, MapPin } from 'lucide-react';

interface TransitDetailsProps {
  steps: TransitStep[];
}

const TransitDetails: React.FC<TransitDetailsProps> = ({ steps }) => {
  if (!steps || steps.length === 0) {
    return <div className="text-sm text-muted-foreground">No transit details available</div>;
  }

  // Helper function to get appropriate icon for transit mode
  const getTransitIcon = (mode?: string): string => {
    switch (mode?.toLowerCase()) {
      case 'bus':
        return '🚌';
      case 'subway':
        return '🚇';
      case 'train':
        return '🚆';
      case 'tram':
        return '🚊';
      case 'rail':
        return '🚄';
      default:
        return '🚌';
    }
  };

  // Consolidate walking segments
  const walkingSteps = steps.filter(s => s.type === 'WALK');
  const transitSteps = steps.filter(s => s.type === 'TRANSIT');
  
  let totalWalkingDuration = 0;
  let totalWalkingDistance = 0;
  let totalTransitDuration = 0;
  
  walkingSteps.forEach(step => {
    if (step.duration) {
      totalWalkingDuration += parseInt(step.duration.replace('s', '') || '0');
    }
    if (step.distance) {
      // Extract numerical value from distance string (e.g., "2.1 mi" -> 2.1)
      const match = step.distance.match(/(\d+(\.\d+)?)/);
      if (match) {
        const value = parseFloat(match[0]);
        const unit = step.distance.includes('mi') ? 'mi' : 'ft';
        // Convert to consistent unit (we'll use feet)
        if (unit === 'mi') {
          totalWalkingDistance += value * 5280; // 1 mile = 5280 feet
        } else {
          totalWalkingDistance += value;
        }
      }
    }
  });
  
  transitSteps.forEach(step => {
    if (step.duration) {
      totalTransitDuration += parseInt(step.duration.replace('s', '') || '0');
    }
  });
  
  // Format total walking distance
  const formattedWalkingDistance = totalWalkingDistance > 1000 ? 
    `${(totalWalkingDistance / 5280).toFixed(1)} mi` : 
    `${Math.round(totalWalkingDistance)} ft`;

  return (
    <div className="space-y-3">
      {/* Consolidated walking section */}
      {walkingSteps.length > 0 && (
        <div className="flex items-center p-2 bg-blue-50 rounded-lg">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 mr-3 flex-shrink-0">
            🚶
          </div>
          <div className="flex-1">
            <div className="font-medium">Walk</div>
            <div className="text-sm text-muted-foreground">
              Total walking distance: {formattedWalkingDistance}
            </div>
          </div>
          <div className="text-sm text-right flex-shrink-0">
            <div className="font-medium">{Math.round(totalWalkingDuration / 60)} min</div>
          </div>
        </div>
      )}
      
      {/* Transit segments */}
      {transitSteps.map((step, index) => (
        <div key={`transit-${index}`} className="border rounded-lg p-2 bg-white">
          <div className="flex items-start">
            {/* Transit icon with line color */}
            <div 
              className="w-8 h-8 flex items-center justify-center rounded-full mr-3 text-lg flex-shrink-0"
              style={{ backgroundColor: step.color || '#1A73E8', color: step.textColor || 'white' }}
            >
              {getTransitIcon(step.mode)}
            </div>
            
            <div className="flex-1">
              {/* Transit line with headsign */}
              <div className="font-medium">
                {step.line} {step.headsign ? `→ ${step.headsign}` : ''}
              </div>
              
              {/* Departure and arrival stops */}
              <div className="flex items-center text-sm text-muted-foreground mt-1">
                <MapPin className="h-3 w-3 mr-1" />
                <div>
                  <span>{step.departureStop}</span>
                  <ArrowRight className="h-3 w-3 mx-1 inline-flex" />
                  <span>{step.arrivalStop}</span>
                </div>
              </div>
              
              {/* Transit times */}
              {step.departureTime && step.arrivalTime && (
                <div className="flex items-center text-sm mt-1 text-muted-foreground">
                  <Clock className="h-3 w-3 mr-1" />
                  <div>
                    <span>{step.departureTime}</span>
                    <ArrowRight className="h-3 w-3 mx-1 inline-flex" />
                    <span>{step.arrivalTime}</span>
                    <span className="ml-1">({step.durationText})</span>
                  </div>
                </div>
              )}
              
              {/* Number of stops */}
              {step.numStops !== undefined && step.numStops > 0 && (
                <div className="text-xs text-muted-foreground mt-1">
                  {step.numStops} {step.numStops === 1 ? 'stop' : 'stops'}
                </div>
              )}
            </div>
            
            {/* Duration and distance */}
            <div className="text-sm text-right flex-shrink-0">
              <div className="font-medium">{step.durationText}</div>
              <div className="text-muted-foreground">{step.distance}</div>
            </div>
          </div>
        </div>
      ))}
      
      {/* Summary section */}
      <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
        <div className="flex justify-between">
          <div>
            <span className="inline-flex items-center mr-3">
              🚶 {Math.round(totalWalkingDuration / 60)} min walking
            </span>
            <span className="inline-flex items-center">
              {getTransitIcon(transitSteps[0]?.mode)} {Math.round(totalTransitDuration / 60)} min in transit
            </span>
          </div>
          <div>
            {transitSteps.length} {transitSteps.length === 1 ? 'transfer' : 'transfers'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransitDetails; 