// Helper function to generate an SVG path from a series of points
export const generateSVGPath = (points: { lat: number; lng: number }[]): string => {
  if (points.length === 0) return '';
  
  // For an SVG path, we need to normalize the points to fit within a viewBox
  const minLat = Math.min(...points.map(p => p.lat));
  const maxLat = Math.max(...points.map(p => p.lat));
  const minLng = Math.min(...points.map(p => p.lng));
  const maxLng = Math.max(...points.map(p => p.lng));
  
  const width = 1000; // SVG viewBox width
  const height = 1000; // SVG viewBox height
  
  // Calculate the scaling for latitude and longitude
  const latRange = maxLat - minLat;
  const lngRange = maxLng - minLng;
  
  // Generate the path
  return points.reduce((path, point, index) => {
    // Normalize the points to fit in the SVG viewBox
    const x = ((point.lng - minLng) / (lngRange || 1)) * width;
    const y = height - ((point.lat - minLat) / (latRange || 1)) * height;
    
    // First point is a move-to, others are line-to
    return `${path}${index === 0 ? 'M' : 'L'}${x},${y}`;
  }, '');
};

// Helper function to generate a smooth path between waypoints
export const generateSmoothPath = (
  waypoints: { lat: number; lng: number }[], 
  totalPoints: number
): { lat: number; lng: number }[] => {
  if (waypoints.length <= 1) return waypoints;
  if (waypoints.length === 2) {
    // Just create evenly spaced points between the two waypoints
    const result = [];
    for (let i = 0; i < totalPoints; i++) {
      const ratio = i / (totalPoints - 1);
      result.push({
        lat: waypoints[0].lat * (1 - ratio) + waypoints[1].lat * ratio,
        lng: waypoints[0].lng * (1 - ratio) + waypoints[1].lng * ratio
      });
    }
    return result;
  }
  
  // For more complex paths, use a simple spline interpolation
  const result = [];
  
  // Always include the first waypoint
  result.push(waypoints[0]);
  
  // Number of points to generate between each pair of waypoints
  const pointsPerSegment = Math.max(2, Math.floor(totalPoints / (waypoints.length - 1)));
  
  // Generate points between each pair of waypoints
  for (let i = 0; i < waypoints.length - 1; i++) {
    const start = waypoints[i];
    const end = waypoints[i + 1];
    
    // Calculate control points for a quadratic bezier curve
    let controlPoint;
    
    if (i === 0 || i === waypoints.length - 2) {
      // For first and last segments, use a simple midpoint
      controlPoint = {
        lat: (start.lat + end.lat) / 2,
        lng: (start.lng + end.lng) / 2
      };
    } else {
      // For middle segments, use previous and next points to influence control point
      const prev = waypoints[i - 1];
      const next = waypoints[i + 2 >= waypoints.length ? i + 1 : i + 2];
      
      controlPoint = {
        lat: (prev.lat + next.lat) / 2,
        lng: (prev.lng + next.lng) / 2
      };
    }
    
    // Generate points along the curve
    for (let j = 1; j <= pointsPerSegment; j++) {
      const t = j / pointsPerSegment;
      
      // Quadratic bezier formula: (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
      const lat = (1 - t) * (1 - t) * start.lat + 
                  2 * (1 - t) * t * controlPoint.lat + 
                  t * t * end.lat;
      
      const lng = (1 - t) * (1 - t) * start.lng + 
                  2 * (1 - t) * t * controlPoint.lng + 
                  t * t * end.lng;
      
      result.push({ lat, lng });
    }
  }
  
  // Add small random jitter to make the route look more natural
  return result.map(point => ({
    lat: point.lat + (Math.random() - 0.5) * 0.0005,
    lng: point.lng + (Math.random() - 0.5) * 0.0005
  }));
}; 