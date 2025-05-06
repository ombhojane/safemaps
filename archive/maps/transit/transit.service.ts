import { ComputeRoutesResponse, TransitStep } from "../types";
import { formatDuration, formatDistance } from "../utils";
import { formatTransitTime } from "../utils/duration.utils";

// Enhanced function to extract polylines for each step to visualize different travel modes
export const extractStepPolylines = (route: ComputeRoutesResponse['routes'][0], travelMode: string) => {
  if (!route.legs || route.legs.length === 0) {
    return [];
  }
  
  const stepPolylines = [];
  
  for (const leg of route.legs) {
    if (!leg.steps || leg.steps.length === 0) continue;
    
    for (const step of leg.steps) {
      if (!step.polyline || !step.polyline.encodedPolyline) continue;
      
      // Ensure walking segments are properly identified
      // The Google Routes API returns 'WALKING' for walking segments
      const stepTravelMode = step.travelMode || travelMode;
      const isWalking = stepTravelMode === 'WALKING' || stepTravelMode === 'WALK';
      
      stepPolylines.push({
        points: [],  // Will be populated by polyline decoder
        travelMode: isWalking ? 'WALKING' : stepTravelMode,
        distanceMeters: step.distanceMeters || 0,
        duration: step.staticDuration || '0s'
      });
    }
  }
  
  return stepPolylines;
};

// Enhanced transit details extraction for better public transport information
export const extractEnhancedTransitDetails = (route: ComputeRoutesResponse['routes'][0]): TransitStep[] => {
  const transitSteps: TransitStep[] = [];
  
  if (!route.legs || route.legs.length === 0) {
    return transitSteps;
  }
  
  // Track walking segments to consolidate them
  let currentWalkStep: TransitStep | null = null;
  let totalWalkDistance = 0;
  let totalWalkDuration = 0;
  
  // Iterate through all legs and steps to find transit steps
  route.legs.forEach(leg => {
    if (!leg.steps || leg.steps.length === 0) return;
    
    leg.steps.forEach(step => {
      if (step.travelMode === 'TRANSIT' && step.transitDetails) {
        // If we were accumulating a walking step, add it now
        if (currentWalkStep) {
          currentWalkStep.distance = formatDistance(totalWalkDistance);
          currentWalkStep.duration = `${totalWalkDuration}s`;
          currentWalkStep.durationText = formatDuration(totalWalkDuration);
          transitSteps.push(currentWalkStep);
          currentWalkStep = null;
          totalWalkDistance = 0;
          totalWalkDuration = 0;
        }
        
        // Get transit details or use fallback values
        const transitDetails = step.transitDetails;
        
        // Check if we have stop details
        const hasValidStopDetails = transitDetails.stopDetails && 
                                   transitDetails.stopDetails.departureStop && 
                                   transitDetails.stopDetails.arrivalStop;
        
        // Get line information - prioritize shortName for bus numbers
        const lineInfo = transitDetails.line || {};
        const lineNumber = lineInfo.shortName || '';
        const lineName = lineInfo.name || 'Transit Line';
        const lineColor = lineInfo.color || '#1A73E8';
        
        // Create transit step with fallbacks for missing data
        const transitStep: TransitStep = {
          type: 'TRANSIT',
          mode: transitDetails.line?.vehicle?.type?.toLowerCase() || 'transit',
          line: lineNumber || lineName,
          headsign: transitDetails.headsign || '',
          departureStop: hasValidStopDetails ? transitDetails.stopDetails.departureStop.name : 'Departure Stop',
          arrivalStop: hasValidStopDetails ? transitDetails.stopDetails.arrivalStop.name : 'Arrival Stop',
          departureTime: hasValidStopDetails ? formatTransitTime(transitDetails.stopDetails.departureTime) : '',
          arrivalTime: hasValidStopDetails ? formatTransitTime(transitDetails.stopDetails.arrivalTime) : '',
          numStops: transitDetails.numStops || 0,
          agency: transitDetails.line?.agencies?.[0]?.name || '',
          color: lineColor,
          textColor: lineInfo.textColor || '#FFFFFF',
          vehicle: transitDetails.line?.vehicle?.name || 'Transit',
          iconUri: transitDetails.line?.vehicle?.iconUri || '',
          duration: step.staticDuration,
          durationText: formatDuration(parseInt(step.staticDuration.replace('s', ''))),
          distance: formatDistance(step.distanceMeters),
          polyline: step.polyline?.encodedPolyline || '',
          // Add coordinates for visualization if available
          departureCoordinates: hasValidStopDetails && transitDetails.stopDetails.departureStop.location ? {
            lat: transitDetails.stopDetails.departureStop.location.latLng.latitude,
            lng: transitDetails.stopDetails.departureStop.location.latLng.longitude
          } : undefined,
          arrivalCoordinates: hasValidStopDetails && transitDetails.stopDetails.arrivalStop.location ? {
            lat: transitDetails.stopDetails.arrivalStop.location.latLng.latitude,
            lng: transitDetails.stopDetails.arrivalStop.location.latLng.longitude
          } : undefined
        };
        
        transitSteps.push(transitStep);
      } else if (step.travelMode === 'WALKING') {
        // For walking steps, consolidate them
        if (!currentWalkStep) {
          currentWalkStep = {
            type: 'WALK',
            duration: step.staticDuration,
            durationText: formatDuration(parseInt(step.staticDuration.replace('s', ''))),
            distance: formatDistance(step.distanceMeters),
            polyline: step.polyline?.encodedPolyline || ''
          };
          totalWalkDistance = step.distanceMeters;
          totalWalkDuration = parseInt(step.staticDuration.replace('s', ''));
        } else {
          // Add to existing walk step
          totalWalkDistance += step.distanceMeters;
          totalWalkDuration += parseInt(step.staticDuration.replace('s', ''));
          // Concatenate polylines if available
          if (step.polyline?.encodedPolyline && currentWalkStep.polyline) {
            // In a real app, we'd need to properly join polylines, but for now just store both
            currentWalkStep.polyline += `;${step.polyline.encodedPolyline}`;
          }
        }
      } else if (step.travelMode) {
        // For other modes (not transit or walking)
        // If we were accumulating a walking step, add it now
        if (currentWalkStep) {
          currentWalkStep.distance = formatDistance(totalWalkDistance);
          currentWalkStep.duration = `${totalWalkDuration}s`;
          currentWalkStep.durationText = formatDuration(totalWalkDuration);
          transitSteps.push(currentWalkStep);
          currentWalkStep = null;
          totalWalkDistance = 0;
          totalWalkDuration = 0;
        }
        
        // Add the other mode step
        transitSteps.push({
          type: step.travelMode,
          duration: step.staticDuration,
          durationText: formatDuration(parseInt(step.staticDuration.replace('s', ''))),
          distance: formatDistance(step.distanceMeters),
          polyline: step.polyline?.encodedPolyline || ''
        });
      }
    });
  });
  
  // Add any remaining walk step
  if (currentWalkStep) {
    currentWalkStep.distance = formatDistance(totalWalkDistance);
    currentWalkStep.duration = `${totalWalkDuration}s`;
    currentWalkStep.durationText = formatDuration(totalWalkDuration);
    transitSteps.push(currentWalkStep);
  }
  
  return transitSteps;
}; 