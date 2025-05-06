// Re-export types
export * from './types';

// Re-export API functions
export { loadGoogleMapsApi } from './api/maps.api';
export { computeRoutes } from './api/routes.api';

// Re-export utility functions
export {
  calculateDistance,
  formatDistance,
  calculateHeading,
  deg2rad
} from './utils/distance.utils';

export {
  formatDuration,
  formatTransitTime
} from './utils/duration.utils';

export {
  generateSVGPath,
  generateSmoothPath
} from './utils/path.utils';

export {
  decodePolyline,
  encodePolyline
} from './utils/polyline.utils';

export {
  generateNavigationUrl
} from './utils/navigation.utils';

// Re-export analysis functions
export { analyzeAllRoutes } from './analysis/route.analysis';
export { ROUTE_ANALYSIS_COMPLETE_EVENT } from './analysis/events'; 