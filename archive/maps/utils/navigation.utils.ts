import { Route } from '../types';

/**
 * Generate a Google Maps navigation URL for the given route
 * When opened, this URL will start navigation in Google Maps app or website
 */
export const generateNavigationUrl = (route: Route): string => {
  // Get source and destination coordinates
  const { source, destination, points } = route;
  
  // On mobile, we'll try to use the platform-specific maps app
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  
  if (isMobile) {
    // On mobile devices, create a URL that will open in the native maps app
    // Format: https://www.google.com/maps/dir/?api=1&origin=LAT,LNG&destination=LAT,LNG&travelmode=driving
    const url = new URL('https://www.google.com/maps/dir/');
    url.searchParams.append('api', '1');
    url.searchParams.append('origin', `${source.coordinates.lat},${source.coordinates.lng}`);
    url.searchParams.append('destination', `${destination.coordinates.lat},${destination.coordinates.lng}`);
    url.searchParams.append('travelmode', 'driving');
    
    return url.toString();
  } else {
    // On desktop, use the more detailed URL format that can include waypoints
    // This provides more accurate routing following our calculated path
    
    // Build a URL like: https://www.google.com/maps/dir/source/waypoint1/waypoint2/destination/
    let url = 'https://www.google.com/maps/dir/';
    
    // Add source
    url += `${source.coordinates.lat},${source.coordinates.lng}/`;
    
    // Add waypoints (limited to a few key points to avoid URL length issues)
    // Select a few evenly spaced points from the route to use as waypoints
    if (points && points.length > 2) {
      const waypointCount = Math.min(5, Math.floor(points.length / 5));
      const step = Math.floor(points.length / (waypointCount + 1));
      
      for (let i = 1; i <= waypointCount; i++) {
        const index = i * step;
        if (index > 0 && index < points.length - 1) {
          const point = points[index].coordinates;
          url += `${point.lat},${point.lng}/`;
        }
      }
    }
    
    // Add destination
    url += `${destination.coordinates.lat},${destination.coordinates.lng}/`;
    
    return url;
  }
}; 