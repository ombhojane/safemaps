import { StreetViewLocation } from "@/types";
import { getCriminalHotspotData } from './criminalHotspotsService';

/**
 * Updates street view locations with criminal hotspot data
 * @param locations The array of street view locations to update
 * @returns An updated array of locations with criminal hotspot data
 */
export async function updateLocationsWithCrimeData(
  locations: StreetViewLocation[]
): Promise<StreetViewLocation[]> {
  if (!locations || locations.length === 0) {
    return [];
  }
  
  // Process locations in batches to avoid too many concurrent requests
  const batchSize = 5;
  const updatedLocations: StreetViewLocation[] = [...locations];
  
  // Create sample points by taking every nth location
  // We don't need to analyze every single point, just representative samples
  const samplePoints = selectSamplePoints(locations, 3);
  
  console.log(`Analyzing crime data for ${samplePoints.length} sample locations out of ${locations.length} total locations`);
  
  // Process batches sequentially to avoid overloading API
  for (let i = 0; i < samplePoints.length; i += batchSize) {
    const batch = samplePoints.slice(i, i + batchSize);
    
    // Process each batch in parallel
    const batchPromises = batch.map(async (location) => {
      if (!location.streetName) {
        return null; // Skip locations without street names
      }
      
      try {
        // Get full location string
        const locationString = location.formattedAddress || location.streetName;
        
        // Get criminal hotspot data
        const criminalHotspot = await getCriminalHotspotData(locationString);
        
        // Find the original location in our array and update it
        const index = updatedLocations.findIndex(
          loc => 
            Math.abs(loc.coordinates.lat - location.coordinates.lat) < 0.0000001 &&
            Math.abs(loc.coordinates.lng - location.coordinates.lng) < 0.0000001
        );
        
        if (index !== -1) {
          updatedLocations[index] = {
            ...updatedLocations[index],
            criminalHotspot
          };
        }
        
        return { index, criminalHotspot };
      } catch (error) {
        console.error(`Error getting crime data for ${location.streetName}:`, error);
        return null;
      }
    });
    
    // Wait for the current batch to complete before moving to the next
    await Promise.all(batchPromises);
    
    // Add a small delay between batches to avoid rate limiting
    if (i + batchSize < samplePoints.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Now copy the criminal hotspot data to nearby points
  // This avoids making too many API calls while still providing coverage
  spreadCrimeDataToNearbyPoints(updatedLocations);
  
  return updatedLocations;
}

/**
 * Select a subset of sample points from the full array to analyze
 */
function selectSamplePoints(
  locations: StreetViewLocation[], 
  sampleInterval: number
): StreetViewLocation[] {
  if (locations.length <= 5) return locations;
  
  // For very long routes, take every nth point
  return locations.filter((_, index) => index % sampleInterval === 0);
}

/**
 * Spread crime data from analyzed points to nearby unanalyzed points
 * This optimizes API usage while still providing good coverage
 */
function spreadCrimeDataToNearbyPoints(locations: StreetViewLocation[]): void {
  // Find all locations that have criminal hotspot data
  const analyzedLocations = locations.filter(loc => loc.criminalHotspot);
  
  if (analyzedLocations.length === 0) return;
  
  // For each location without data, find the nearest analyzed location
  locations.forEach((location, index) => {
    if (location.criminalHotspot) return; // Skip if already has data
    
    // Find the nearest analyzed location
    let nearestLocation: StreetViewLocation | null = null;
    let minDistance = Infinity;
    
    analyzedLocations.forEach(analyzedLoc => {
      const distance = calculateDistance(
        location.coordinates.lat, location.coordinates.lng,
        analyzedLoc.coordinates.lat, analyzedLoc.coordinates.lng
      );
      
      if (distance < minDistance) {
        minDistance = distance;
        nearestLocation = analyzedLoc;
      }
    });
    
    // If there's a nearby analyzed location, copy its data
    // Only if the distance is reasonable (< 1km)
    if (nearestLocation && minDistance < 1) {
      locations[index] = {
        ...location,
        criminalHotspot: nearestLocation.criminalHotspot
      };
    }
  });
}

/**
 * Calculate distance between two geographic points in kilometers
 */
function calculateDistance(
  lat1: number, lng1: number, 
  lat2: number, lng2: number
): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = deg2rad(lat2 - lat1);
  const dLng = deg2rad(lng2 - lng1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

/**
 * Convert degrees to radians
 */
function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
} 