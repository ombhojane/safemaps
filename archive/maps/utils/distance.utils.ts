// Helper function to calculate the distance between two geographical coordinates in meters
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371000; // Earth's radius in meters
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Distance in meters
  return distance;
};

// Helper function to convert degrees to radians
export const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
};

// Helper function to format distance
export const formatDistance = (meters: number): string => {
  const miles = meters / 1609.34;
  return miles < 1 
    ? `${(miles * 5280).toFixed(0)} ft` 
    : `${miles.toFixed(1)} mi`;
};

// Calculate the heading (direction) between two points in degrees
export const calculateHeading = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) -
            Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

  let heading = Math.atan2(y, x) * 180 / Math.PI;
  heading = (heading + 360) % 360; // Normalize to 0-360
  
  return heading;
}; 