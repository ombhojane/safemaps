import { Location, Route, RoutePoint } from "@/types";
import { analyzeStreetViewImages, calculateAverageRiskScore } from "@/services/geminiService";
import { getRouteLocationWeather, getWeatherCondition } from "@/services/weatherService";

// Get API key from environment variables
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Define a custom event for route analysis updates
export const ROUTE_ANALYSIS_COMPLETE_EVENT = 'route-analysis-complete';

// Custom event to dispatch when route analysis is complete
export const dispatchRouteAnalysisComplete = (route: Route) => {
  const event = new CustomEvent(ROUTE_ANALYSIS_COMPLETE_EVENT, { 
    detail: { 
      routeId: route.id,
      analysis: route.geminiAnalysis
    } 
  });
  window.dispatchEvent(event);
};

interface ComputeRoutesResponse {
  routes: {
    distanceMeters: number;
    duration: string;
    polyline: {
      encodedPolyline: string;
    };
    legs: {
      steps: {
        polyline: {
          encodedPolyline: string;
        };
        distanceMeters: number;
        staticDuration: string;
      }[];
    }[];
    routeLabels: string[];
  }[];
}

// Function to load Google Maps API script
export const loadGoogleMapsApi = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&libraries=places,marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = (error) => reject(new Error(`Failed to load Google Maps API: ${error}`));
    document.head.appendChild(script);
  });
};

// Function to decode a polyline
export function decodePolyline(encodedPolyline: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encodedPolyline.length) {
    let result = 1;
    let shift = 0;
    let b: number;
    do {
      b = encodedPolyline.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lat += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);

    result = 1;
    shift = 0;
    do {
      b = encodedPolyline.charCodeAt(index++) - 63 - 1;
      result += b << shift;
      shift += 5;
    } while (b >= 0x1f);
    lng += (result & 1) !== 0 ? ~(result >> 1) : (result >> 1);

    points.push({ lat: lat * 1e-5, lng: lng * 1e-5 });
  }
  return points;
}

// Function to compute routes between source and destination
export const computeRoutes = async (
  source: Location,
  destination: Location
): Promise<Route[]> => {
  try {
    // Make API request to compute routes
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.polyline,routes.distanceMeters,routes.duration,routes.routeLabels',
      },
      body: JSON.stringify({
        origin: {
          location: {
            latLng: {
              latitude: source.coordinates.lat,
              longitude: source.coordinates.lng,
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.coordinates.lat,
              longitude: destination.coordinates.lng,
            }
          }
        },
        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_AWARE",
        computeAlternativeRoutes: true,
        languageCode: "en-US",
        units: "IMPERIAL",
      }),
    });

    if (!response.ok) {
      throw new Error(`Routes API error: ${response.status}`);
    }

    const data: ComputeRoutesResponse = await response.json();
    
    // Log routes received to help with debugging
    console.log(`Received ${data.routes?.length || 0} routes from API`);
    
    // Check if routes data exists
    if (!data || !data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      console.error('No routes returned from API');
      // Return two mock routes for testing
      return [
        createMockRoute(source, destination, 'route-0'),
        createMockRoute(source, destination, 'route-1')
      ];
    }

    // If we didn't get at least 2 routes, try a second API call with different routing preferences
    if (data.routes.length < 2) {
      console.log('Only one route returned, trying with avoid highways option');
      
      // Try a second API call with avoid highways option
      try {
        const alternativeResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.polyline,routes.distanceMeters,routes.duration,routes.routeLabels',
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: {
                  latitude: source.coordinates.lat,
                  longitude: source.coordinates.lng,
                }
              }
            },
            destination: {
              location: {
                latLng: {
                  latitude: destination.coordinates.lat,
                  longitude: destination.coordinates.lng,
                }
              }
            },
            travelMode: "DRIVE",
            routingPreference: "TRAFFIC_AWARE",
            routeModifiers: {
              avoidTolls: false,
              avoidHighways: true,
              avoidFerries: false,
            },
            languageCode: "en-US",
            units: "IMPERIAL",
          }),
        });
        
        if (alternativeResponse.ok) {
          const alternativeData: ComputeRoutesResponse = await alternativeResponse.json();
          if (alternativeData && alternativeData.routes && alternativeData.routes.length > 0) {
            // Add the alternative route to our routes array
            data.routes.push(alternativeData.routes[0]);
          }
        }
      } catch (err) {
        console.error('Error fetching alternative route:', err);
      }
      
      // If we still don't have 2 routes, try another approach with shortest distance
      if (data.routes.length < 2) {
        console.log('Still only one route, trying with shortest distance option');
        
        try {
          const shortestResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': API_KEY,
              'X-Goog-FieldMask': 'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.polyline,routes.distanceMeters,routes.duration,routes.routeLabels',
            },
            body: JSON.stringify({
              origin: {
                location: {
                  latLng: {
                    latitude: source.coordinates.lat,
                    longitude: source.coordinates.lng,
                  }
                }
              },
              destination: {
                location: {
                  latLng: {
                    latitude: destination.coordinates.lat,
                    longitude: destination.coordinates.lng,
                  }
                }
              },
              travelMode: "DRIVE",
              routingPreference: "ROUTE_PREFERENCE_UNSPECIFIED", // Different preference
              optimizeWaypointOrder: true,
              languageCode: "en-US",
              units: "IMPERIAL",
            }),
          });
          
          if (shortestResponse.ok) {
            const shortestData: ComputeRoutesResponse = await shortestResponse.json();
            if (shortestData && shortestData.routes && shortestData.routes.length > 0) {
              // Add the shortest route to our routes array if it's different from existing route
              if (!isSameRoute(data.routes[0], shortestData.routes[0])) {
                data.routes.push(shortestData.routes[0]);
              }
            }
          }
        } catch (err) {
          console.error('Error fetching shortest route:', err);
        }
      }
      
      // If we still don't have at least 2 routes, create mock alternative routes
      if (data.routes.length < 2) {
        console.log('Creating mock alternative routes as fallback');
        // Create additional mock routes
        for (let i = data.routes.length; i < 2; i++) {
          data.routes.push({
            distanceMeters: Math.round(data.routes[0].distanceMeters * (1 + (i * 0.1))),
            duration: `${Math.round(parseInt(data.routes[0].duration) * (1 + (i * 0.1)))}s`,
            polyline: { encodedPolyline: '' },
            legs: [],
            routeLabels: ["DEFAULT_ROUTE_ALTERNATE"]
          });
        }
      }
    }
    
    // Limit to maximum 4 routes
    if (data.routes.length > 4) {
      data.routes = data.routes.slice(0, 4);
    }
    
    // Fetch weather data for the source location only once
    // This will be used for all routes
    const weatherData = await getRouteLocationWeather(
      source.coordinates.lat,
      source.coordinates.lng
    );
    
    // Process the routes data
    const routes = data.routes.map((route, index) => {
      // For mock routes without polyline data, create a mock route
      if (!route.polyline || !route.polyline.encodedPolyline) {
        console.log(`Route ${index} is missing polyline data, creating mock route`);
        return createMockRoute(source, destination, `route-${index}`);
      }
      
      // Decode the polyline to get the route path
      const points = decodePolyline(route.polyline.encodedPolyline);
      
      // Convert duration string (e.g., "3600s") to minutes
      const durationInSeconds = route.duration ? parseInt(route.duration.replace('s', '')) : 0;
      const durationText = formatDuration(durationInSeconds);
      
      // Convert distance in meters to miles or kilometers
      const distanceText = formatDistance(route.distanceMeters || 0);
      
      // Generate route points with risk scores (mock data for now)
      const routePoints: RoutePoint[] = points.map((point, idx) => ({
        coordinates: point,
        riskScore: Math.random() * 3, // Random risk score between 0 and 3
        position: {
          x: `${idx}`,
          y: `${idx}`,
        },
      }));

      // Calculate overall risk score based on route points
      const riskScore = calculateRouteRiskScore(routePoints);
      
      // Generate street view images for the route
      const { images: streetViewImages, locations: streetViewLocations } = fetchStreetViewImages(points);
      
      // Set the route's ID, using routeLabels if available to mark default vs alternative routes
      const isAlternative = route.routeLabels && 
                           route.routeLabels.includes("DEFAULT_ROUTE_ALTERNATE");
      const routeId = isAlternative ? `route-alt-${index}` : `route-${index}`;
      
      // Create route object with weather data if available
      const routeObject: Route = {
        id: routeId,
        source,
        destination,
        points: routePoints,
        riskScore,
        distance: distanceText,
        duration: durationText,
        riskAreas: [], // Would be populated with real data
        path: generateSVGPath(points), // Create an SVG path for visualization
        streetViewImages,
        streetViewLocations,
        // Initialize Gemini analysis with isAnalyzing: true
        geminiAnalysis: {
          riskScores: [],
          averageRiskScore: 0,
          isAnalyzing: false
        }
      };
      
      // Add weather information if available
      if (weatherData) {
        routeObject.weather = {
          condition: getWeatherCondition(weatherData),
          temperature: weatherData.temperature,
          description: weatherData.description,
          icon: weatherData.icon,
          humidity: weatherData.humidity,
          windSpeed: weatherData.windSpeed
        };
      }
      
      return routeObject;
    });

    // Start Gemini analysis for all routes asynchronously
    // We don't await this so routes are returned to the user immediately
    if (routes.length > 0) {
      analyzeAllRoutes(routes);
    }
    
    return routes;
  } catch (error) {
    console.error('Error computing routes:', error);
    // Return two mock routes for better error recovery
    return [
      createMockRoute(source, destination, 'route-0'),
      createMockRoute(source, destination, 'route-1')
    ];
  }
};

/**
 * Analyze all routes with AI
 */
const analyzeAllRoutes = async (routes: Route[]) => {
  try {
    for (const route of routes) {
      if (!route.streetViewImages || route.streetViewImages.length === 0) continue;
      
      // Update route to show it's being analyzed
      route.geminiAnalysis = {
        riskScores: [],
        averageRiskScore: 0,
        isAnalyzing: true
      };
      
      // Dispatch an event to notify that analysis has started
      dispatchRouteAnalysisComplete(route);
      
      // Use all street view images since they're now already optimally sampled
      // We're already using the evenly distributed sampling in fetchStreetViewImages
      const imagesToAnalyze = route.streetViewImages;
      
      // Include weather information in the Gemini analysis prompt if available
      let weatherInfo = "";
      if (route.weather) {
        weatherInfo = `Current weather conditions: ${route.weather.condition}, ${route.weather.temperature}°C, ${route.weather.description}. Wind speed: ${route.weather.windSpeed} m/s. Humidity: ${route.weather.humidity}%.`;
      }
      
      // Get analysis results including explanations and precautions, passing weather info
      const analysisResults = await analyzeStreetViewImages(imagesToAnalyze, weatherInfo);
      const averageRiskScore = calculateAverageRiskScore(analysisResults.riskScores);
      
      // Update route with analysis results
      route.geminiAnalysis = {
        riskScores: analysisResults.riskScores,
        explanations: analysisResults.explanations,
        precautions: analysisResults.precautions,
        averageRiskScore,
        isAnalyzing: false
      };
      
      // Dispatch an event to notify UI components about the completed analysis
      dispatchRouteAnalysisComplete(route);
    }
  } catch (error) {
    console.error('Error analyzing routes with Gemini:', error);
  }
};

/**
 * Select evenly spaced samples from an array
 * 
 * This function is crucial for route analysis as it ensures we analyze
 * points that are evenly distributed across the entire route length,
 * rather than being concentrated at the beginning of the route.
 * 
 * @param array The array to sample from
 * @param sampleCount The number of samples to take
 * @returns An array of evenly spaced samples
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

// Helper function to calculate route risk score based on route points
const calculateRouteRiskScore = (routePoints: RoutePoint[]): number => {
  // This is a simplified algorithm - in a real app, this would incorporate actual risk data
  if (routePoints.length === 0) return 0;
  
  const totalRisk = routePoints.reduce(
    (sum, point) => sum + (point.riskScore || 0),
    0
  );
  
  return Math.min(Math.round((totalRisk / routePoints.length) * 10) / 10, 10);
};

// Helper function to generate an SVG path from a series of points
const generateSVGPath = (points: { lat: number; lng: number }[]): string => {
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

// Helper function to format distance
const formatDistance = (meters: number): string => {
  const miles = meters / 1609.34;
  return miles < 1 
    ? `${(miles * 5280).toFixed(0)} ft` 
    : `${miles.toFixed(1)} mi`;
};

// Helper function to format duration
const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (hours > 0) {
    return `${hours} hr ${minutes} min`;
  }
  return `${minutes} min`;
};

// Function to fetch Street View images along a route
export const fetchStreetViewImages = (
  points: { lat: number; lng: number }[], 
  interval = 300
): { images: string[], locations: import('@/types').StreetViewLocation[] } => {
  // Skip if no points or only one point
  if (!points || points.length < 2) return { images: [], locations: [] };
  
  const MAX_IMAGES = 10; // Limit number of images for performance (adjusted from 20 to 10)
  
  // For routes with many points, use evenly spaced samples
  // This ensures we cover the entire route, not just the first kilometer
  const samplePoints = selectEvenlySpacedSamples(points, MAX_IMAGES - 1); // Reserve one spot for destination
  
  const streetViewImages: string[] = [];
  const streetViewLocations: import('@/types').StreetViewLocation[] = [];
  
  // Generate street view images for each sample point
  for (let i = 0; i < samplePoints.length; i++) {
    const currentPoint = samplePoints[i];
    
    // Find the next point to calculate heading
    // For the last sample, we'll use the destination
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
    
    // Store the location information - ensure we're storing plain values, not references
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
    
    // Store the destination location information with explicit number conversion
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
            (results: any, status: any) => {
              if (status === 'OK' && results[0]) {
                // Extract street name from address components
                const addressComponents = results[0].address_components;
                const route = addressComponents.find((component: any) => 
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

// Calculate the distance between two coordinates in meters using Haversine formula
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
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

// Helper function to create a mock route when API fails
const createMockRoute = (source: Location, destination: Location, id = 'route-fallback'): Route => {
  // Extract route number from ID if exists
  const routeNumber = id.includes('-') ? parseInt(id.split('-')[1]) || 0 : 0;
  
  // Create different waypoints based on route number
  const waypoints = [];
  const midLat = (source.coordinates.lat + destination.coordinates.lat) / 2;
  const midLng = (source.coordinates.lng + destination.coordinates.lng) / 2;
  
  // Calculate a vector perpendicular to the direct path
  const directionLat = destination.coordinates.lat - source.coordinates.lat;
  const directionLng = destination.coordinates.lng - source.coordinates.lng;
  
  // Normalize and rotate 90 degrees to get perpendicular vector
  const length = Math.sqrt(directionLat * directionLat + directionLng * directionLng);
  const perpLat = -directionLng / length;
  const perpLng = directionLat / length;
  
  // Create different route variations
  if (routeNumber === 0) {
    // First route - mostly direct with slight curve
    waypoints.push(
      { lat: source.coordinates.lat, lng: source.coordinates.lng },
      { 
        lat: midLat + perpLat * 0.01, 
        lng: midLng + perpLng * 0.01 
      },
      { lat: destination.coordinates.lat, lng: destination.coordinates.lng }
    );
  } else if (routeNumber === 1) {
    // Second route - different path
    waypoints.push(
      { lat: source.coordinates.lat, lng: source.coordinates.lng },
      { 
        lat: midLat - perpLat * 0.02, 
        lng: midLng - perpLng * 0.02 
      },
      { lat: destination.coordinates.lat, lng: destination.coordinates.lng }
    );
  } else {
    // For any other route number, create a more varied path
    const deviation = (routeNumber % 2 === 0) ? 0.03 : -0.03;
    
    waypoints.push(
      { lat: source.coordinates.lat, lng: source.coordinates.lng },
      { 
        lat: midLat * 0.7 + source.coordinates.lat * 0.3 + perpLat * deviation * 0.5, 
        lng: midLng * 0.7 + source.coordinates.lng * 0.3 + perpLng * deviation * 0.5 
      },
      { 
        lat: midLat + perpLat * deviation, 
        lng: midLng + perpLng * deviation 
      },
      { 
        lat: midLat * 0.3 + destination.coordinates.lat * 0.7 + perpLat * deviation * 0.5, 
        lng: midLng * 0.3 + destination.coordinates.lng * 0.7 + perpLng * deviation * 0.5 
      },
      { lat: destination.coordinates.lat, lng: destination.coordinates.lng }
    );
  }
  
  // Generate more intermediate points for a smoother path
  const points = generateSmoothPath(waypoints, 15);
  
  // Create route points with mock risk scores
  const routePoints: RoutePoint[] = points.map((point, idx) => ({
    coordinates: point,
    riskScore: routeNumber === 0 ? 2 : routeNumber === 1 ? 5 : 7, // Different risk scores for different routes
    position: {
      x: `${idx}`,
      y: `${idx}`,
    },
  }));
  
  // Calculate total distance along the path
  let distanceInMeters = 0;
  for (let i = 1; i < points.length; i++) {
    distanceInMeters += calculateDistance(
      points[i-1].lat, points[i-1].lng,
      points[i].lat, points[i].lng
    );
  }
  
  // Apply route-specific modifiers to make routes different
  if (routeNumber === 1) {
    // Second route is typically longer but might be faster
    distanceInMeters *= 1.2;
  } else if (routeNumber > 1) {
    // Other routes have more variation
    distanceInMeters *= 1.3;
  }
  
  // Estimate duration (variable speeds depending on route)
  // Speed in km/h: route 0: 60km/h, route 1: 70km/h, others: 50km/h
  const speed = routeNumber === 0 ? 60 : routeNumber === 1 ? 70 : 50;
  const durationInSeconds = (distanceInMeters / 1000) * (60 * 60 / speed);
  
  // Get street view images and locations
  const { images: streetViewImages, locations: streetViewLocations } = fetchStreetViewImages(points);
  
  // Different risk score based on route number
  const riskScore = routeNumber === 0 ? 3 : routeNumber === 1 ? 6 : 8;
  
  return {
    id,
    source,
    destination,
    points: routePoints,
    riskScore,
    distance: formatDistance(distanceInMeters),
    duration: formatDuration(durationInSeconds),
    riskAreas: [],
    path: generateSVGPath(points),
    streetViewImages,
    streetViewLocations,
    geminiAnalysis: {
      riskScores: [],
      averageRiskScore: 0,
      isAnalyzing: false
    }
  };
};

// Helper function to generate a smooth path between waypoints
const generateSmoothPath = (
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

// Helper function to check if two routes are the same
const isSameRoute = (route1: ComputeRoutesResponse['routes'][0], route2: ComputeRoutesResponse['routes'][0]): boolean => {
  if (!route1 || !route2) return false;
  
  // Compare distance and duration with some tolerance
  const distanceTolerance = 0.05; // 5% tolerance
  const distanceDiff = Math.abs(route1.distanceMeters - route2.distanceMeters) / route1.distanceMeters;
  
  const duration1 = parseInt(route1.duration.replace('s', ''));
  const duration2 = parseInt(route2.duration.replace('s', ''));
  const durationDiff = Math.abs(duration1 - duration2) / duration1;
  
  return distanceDiff < distanceTolerance && durationDiff < distanceTolerance;
}; 