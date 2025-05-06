import { API_KEY } from "../api/maps.api";
import { calculateHeading } from "../utils";

/**
 * Select evenly spaced samples from an array
 */
const selectEvenlySpacedSamples = <T>(array: T[], sampleCount: number): T[] => {
  if (array.length <= sampleCount) return array;
  
  const result: T[] = [];
  const step = array.length / sampleCount;
  
  for (let i = 0; i < sampleCount; i++) {
    const index = Math.min(Math.floor(i * step), array.length - 1);
    result.push(array[index]);
  }
  
  return result;
};

/**
 * Fetch Street View images along a route
 */
export const fetchStreetViewImages = (
  points: { lat: number; lng: number }[], 
  interval = 300
): { images: string[], locations: import('@/types').StreetViewLocation[] } => {
  // Skip if no points or only one point
  if (!points || points.length < 2) return { images: [], locations: [] };
  
  const MAX_IMAGES = 10; // Limit number of images for performance
  
  // For routes with many points, use evenly spaced samples
  const samplePoints = selectEvenlySpacedSamples(points, MAX_IMAGES - 1); // Reserve one spot for destination
  
  const streetViewImages: string[] = [];
  const streetViewLocations: import('@/types').StreetViewLocation[] = [];
  
  // Generate street view images for each sample point
  for (let i = 0; i < samplePoints.length; i++) {
    const currentPoint = samplePoints[i];
    
    // Find the next point to calculate heading
    const nextPointIndex = i < samplePoints.length - 1 ? i + 1 : points.length - 1;
    const nextPoint = i < samplePoints.length - 1 ? samplePoints[nextPointIndex] : points[points.length - 1];
    
    // Calculate heading (direction)
    const heading = calculateHeading(
      currentPoint.lat, currentPoint.lng,
      nextPoint.lat, nextPoint.lng
    );
    
    // Create Street View image URL
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${currentPoint.lat},${currentPoint.lng}&fov=90&heading=${heading}&pitch=0&key=${API_KEY}`;
    streetViewImages.push(streetViewUrl);
    
    // Store the location information
    streetViewLocations.push({
      coordinates: { 
        lat: Number(currentPoint.lat), 
        lng: Number(currentPoint.lng) 
      },
      heading: Number(heading),
      index: i
    });
  }
  
  // Add destination point if not already included
  const lastSamplePoint = samplePoints[samplePoints.length - 1];
  const lastPoint = points[points.length - 1];
  
  // Check if last sample point is different from destination
  if (lastSamplePoint.lat !== lastPoint.lat || lastSamplePoint.lng !== lastPoint.lng) {
    const secondLastPoint = points[points.length - 2];
    const heading = calculateHeading(
      secondLastPoint.lat, secondLastPoint.lng,
      lastPoint.lat, lastPoint.lng
    );
    
    const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=400x300&location=${lastPoint.lat},${lastPoint.lng}&fov=90&heading=${heading}&pitch=0&key=${API_KEY}`;
    streetViewImages.push(streetViewUrl);
    
    // Store the destination location information
    streetViewLocations.push({
      coordinates: { 
        lat: Number(lastPoint.lat), 
        lng: Number(lastPoint.lng) 
      },
      heading: Number(heading),
      index: streetViewLocations.length
    });
  }
  
  // Attempt to get street names for each location (if running in browser)
  if (typeof window !== 'undefined' && window.google && window.google.maps) {
    // Use setTimeout to delay this process slightly so it doesn't block rendering
    setTimeout(() => {
      try {
        const geocoder = new window.google.maps.Geocoder();
        
        streetViewLocations.forEach((location, idx) => {
          geocoder.geocode(
            { location: location.coordinates },
            (results: google.maps.GeocoderResult[], status: google.maps.GeocoderStatus) => {
              if (status === 'OK' && results[0]) {
                // Extract street name from address components
                const addressComponents = results[0].address_components;
                const route = addressComponents.find((component: google.maps.GeocoderAddressComponent) => 
                  component.types.includes('route')
                );
                
                if (route) {
                  location.streetName = route.long_name;
                  // Dispatch an event to notify that street name was updated
                  const event = new CustomEvent('street-name-updated', { 
                    detail: { index: idx, streetName: route.long_name } 
                  });
                  window.dispatchEvent(event);
                }
              }
            }
          );
        });
      } catch (error) {
        console.error('Error getting street names:', error);
      }
    }, 1000);
  }
  
  return { images: streetViewImages, locations: streetViewLocations };
}; 