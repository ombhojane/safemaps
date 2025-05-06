import { Location, Route, RoutePoint, TransitStep } from "@/types";
import { analyzeStreetViewImages, calculateAverageRiskScore } from "@/services/geminiService";
import { getRouteLocationWeather, getWeatherCondition } from "@/services/weatherService";
import { 
  getAccidentHotspotData, 
  getEmptyAccidentHotspotData, 
  loadAccidentHotspotDataAsync,
  ACCIDENT_HOTSPOT_UPDATE_EVENT
} from './accidentHotspotsService';

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
        travelMode?: string;
        transitDetails?: {
          stopDetails?: {
            arrivalStop?: {
              name: string;
              location?: {
                latLng: {
                  latitude: number;
                  longitude: number;
                }
              }
            };
            departureStop?: {
              name: string;
              location?: {
                latLng: {
                  latitude: number;
                  longitude: number;
                }
              }
            };
            arrivalTime?: string;
            departureTime?: string;
          };
          headsign?: string;
          headway?: string;
          localizedValues?: {
            arrivalTime: string;
            departureTime: string;
          };
          line?: {
            agencies?: {
              name: string;
              uri?: string;
            }[];
            name?: string;
            vehicle?: {
              name?: string;
              type?: string;
              iconUri?: string;
            };
            color?: string;
            textColor?: string;
            shortName?: string;
          };
          numStops?: number;
        };
      }[];
      startLocation?: {
        latLng: {
          latitude: number;
          longitude: number;
        }
      };
      endLocation?: {
        latLng: {
          latitude: number;
          longitude: number;
        }
      };
    }[];
    routeLabels: string[];
  }[];
}

// Available travel modes for the Routes API
export enum TravelMode {
  DRIVE = "DRIVE",
  WALK = "WALK",
  BICYCLE = "BICYCLE",
  TRANSIT = "TRANSIT",
  TWO_WHEELER = "TWO_WHEELER"
}

// The supported travel modes (hide unsupported modes)
export const SUPPORTED_TRAVEL_MODES = [
  TravelMode.DRIVE, 
  TravelMode.TRANSIT, 
  TravelMode.WALK,
  TravelMode.TWO_WHEELER
];

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

// Function to encode points into a polyline string
export function encodePolyline(points: { lat: number; lng: number }[]): string {
  const encode = (val: number): string => {
    val = Math.round(val * 1e5);
    val = val << 1;
    if (val < 0) {
      val = ~val;
    }
    let result = '';
    while (val >= 0x20) {
      result += String.fromCharCode((0x20 | (val & 0x1f)) + 63);
      val >>= 5;
    }
    result += String.fromCharCode(val + 63);
    return result;
  };

  let result = '';
  let prevLat = 0;
  let prevLng = 0;

  points.forEach(point => {
    result += encode(point.lat - prevLat);
    result += encode(point.lng - prevLng);
    prevLat = point.lat;
    prevLng = point.lng;
  });

  return result;
}

// Function to compute routes between source and destination
export const computeRoutes = async (
  source: Location,
  destination: Location,
  travelMode: TravelMode = TravelMode.DRIVE // Default to driving
): Promise<Route[]> => {
  try {
    console.log(`Computing routes from ${source.name} to ${destination.name} via ${travelMode}`);
    
    // Skip unsupported modes
    if (!SUPPORTED_TRAVEL_MODES.includes(travelMode)) {
      console.warn(`${travelMode} mode is not fully supported, using mock routes`);
      const mockRoutePromises = [
        createMockRoute(source, destination, 'route-0', travelMode),
        createMockRoute(source, destination, 'route-1', travelMode)
      ];
      // Start Gemini analysis for the mock routes after they're created
      return Promise.all(mockRoutePromises).then(mockRoutes => {
        analyzeAllRoutes(mockRoutes);
        return mockRoutes;
      });
    }
    
    // Special handling for TWO_WHEELER mode
    let routingPreference = "";
    let routeModifiers = {};
    let computeAlternativeRoutes = true;
    
    // Enhanced field masks for better data retrieval
    let fieldMask = 'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.polyline,routes.distanceMeters,routes.duration,routes.routeLabels';
    
    // Transit specific options
    let transitPreferences = undefined;
    
    // Configure parameters based on travel mode
    if (travelMode === TravelMode.DRIVE || travelMode === TravelMode.TWO_WHEELER) {
      routingPreference = "TRAFFIC_AWARE";
      routeModifiers = {
        avoidHighways: travelMode === TravelMode.TWO_WHEELER,
        avoidTolls: travelMode === TravelMode.TWO_WHEELER
      };
    } else if (travelMode === TravelMode.TRANSIT) {
      // Enhanced field mask for transit to get more detailed transit information
      fieldMask = 'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.legs.steps.transitDetails,routes.legs.stepsOverview,routes.polyline,routes.distanceMeters,routes.duration,routes.routeLabels';
      
      // Configure transit preferences for better routes
      transitPreferences = {
        routingPreference: "LESS_WALKING",
        allowedTravelModes: ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"]
      };
    } else if (travelMode === TravelMode.WALK) {
      // For walking routes, we want the most accurate path
      // Don't set routingPreference for walking as it's not supported
      computeAlternativeRoutes = true;
    } else if (travelMode === TravelMode.BICYCLE) {
      // For bicycle routes, we prefer safer routes with dedicated bike lanes
      // Don't set routingPreference for bicycle as it's not supported
      routeModifiers = {
        avoidHighways: true
      };
    }
    
    // Validate source and destination coordinates
    if (!source.coordinates || !destination.coordinates ||
        isNaN(source.coordinates.lat) || isNaN(source.coordinates.lng) ||
        isNaN(destination.coordinates.lat) || isNaN(destination.coordinates.lng)) {
      console.error('Invalid source or destination coordinates');
      // Return mock routes for graceful degradation
      const mockRoutePromises = [
        createMockRoute(source, destination, 'route-0', travelMode),
        createMockRoute(source, destination, 'route-1', travelMode)
      ];
      // Start Gemini analysis for the mock routes
      return Promise.all(mockRoutePromises).then(mockRoutes => {
        analyzeAllRoutes(mockRoutes);
        return mockRoutes;
      });
    }
    
    // Calculate distance between source and destination
    const distance = calculateDistance(
      source.coordinates.lat, source.coordinates.lng,
      destination.coordinates.lat, destination.coordinates.lng
    );
    
    // Check if distance is too far for walking or bicycling (more than 30km)
    if ((travelMode === TravelMode.WALK || travelMode === TravelMode.BICYCLE) && distance > 30000) {
      console.warn(`Distance of ${Math.round(distance/1000)}km is too far for ${travelMode} mode. Using mock routes.`);
      // Return mock routes for walking/bicycling when distance is too far
      const mockRoutePromises = [
        createMockRoute(source, destination, 'route-0', travelMode),
        createMockRoute(source, destination, 'route-1', travelMode)
      ];
      // Start Gemini analysis for the mock routes
      return Promise.all(mockRoutePromises).then(mockRoutes => {
        analyzeAllRoutes(mockRoutes);
        return mockRoutes;
      });
    }
    
    // Create base request body
    interface RequestBody {
      origin: {
        location: {
          latLng: {
            latitude: number;
            longitude: number;
          }
        }
      };
      destination: {
        location: {
          latLng: {
            latitude: number;
            longitude: number;
          }
        }
      };
      travelMode: string;
      computeAlternativeRoutes: boolean;
      languageCode: string;
      units: string;
      routingPreference?: string;
      transitPreferences?: {
        routingPreference: string;
        allowedTravelModes?: string[];
      };
      routeModifiers?: {
        avoidHighways?: boolean;
        avoidTolls?: boolean;
      };
    }
    
    const requestBody: RequestBody = {
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
      travelMode: travelMode,
      computeAlternativeRoutes: computeAlternativeRoutes,
        languageCode: "en-US",
      units: "IMPERIAL"
    };
    
    // Add mode-specific parameters if defined
    if (routingPreference) {
      requestBody.routingPreference = routingPreference;
    }
    
    if (Object.keys(routeModifiers).length > 0) {
      requestBody.routeModifiers = routeModifiers;
    }
    
    if (transitPreferences && travelMode === TravelMode.TRANSIT) {
      requestBody.transitPreferences = transitPreferences;
    }
    
    console.log("Routes API request:", JSON.stringify(requestBody, null, 2));
    
    // Make API request to compute routes
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error(`Routes API error: ${response.status}`);
      console.error('Request that caused error:', JSON.stringify(requestBody, null, 2));
      
      // Try to get more details from the error response
      try {
        const errorText = await response.text();
        console.error('Error response:', errorText);
      } catch (textError) {
        console.error('Could not get error response text');
      }
      
      throw new Error(`Routes API error: ${response.status}`);
    }

    const data: ComputeRoutesResponse = await response.json();
    
    // Log routes received to help with debugging
    console.log(`Received ${data.routes?.length || 0} routes from API for ${travelMode} mode`);
    
    // Check if routes data exists
    if (!data || !data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
      console.error('No routes returned from API');
      // Return two mock routes for testing
      const mockRoutePromises = [
        createMockRoute(source, destination, 'route-0', travelMode),
        createMockRoute(source, destination, 'route-1', travelMode)
      ];
      return Promise.all(mockRoutePromises);
    }

    // For transit mode, validate transit details
    if (travelMode === TravelMode.TRANSIT) {
      console.log('Checking for transit details in the routes...');
      let hasTransitDetails = false;
      
      // Check if the route has transit details
      for (const route of data.routes) {
        if (route.legs && route.legs.length > 0) {
          for (const leg of route.legs) {
            if (leg.steps && leg.steps.length > 0) {
              for (const step of leg.steps) {
                if (step.travelMode === 'TRANSIT' && step.transitDetails) {
                  hasTransitDetails = true;
                  break;
                }
              }
              if (hasTransitDetails) break;
            }
          }
          if (hasTransitDetails) break;
        }
      }
      
      // If no transit details found, log and retry with different preferences
      if (!hasTransitDetails) {
        console.log('No transit details found in the response. Retrying with different preferences...');
        
        // Try with a different set of preferences
        const alternativeTransitPreferences = {
          routingPreference: "FEWER_TRANSFERS"
        };
        
        requestBody.transitPreferences = alternativeTransitPreferences;
        
        // Try again with different preferences
        try {
          const alternativeResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': API_KEY,
              'X-Goog-FieldMask': fieldMask,
            },
            body: JSON.stringify(requestBody),
          });
          
          if (alternativeResponse.ok) {
            const alternativeData = await alternativeResponse.json();
            if (alternativeData && alternativeData.routes && alternativeData.routes.length > 0) {
              // Use this data instead
              console.log('Successfully retrieved transit routes with FEWER_TRANSFERS preference');
              data.routes = alternativeData.routes;
            }
          }
        } catch (error) {
          console.error('Error retrying with alternative transit preferences:', error);
        }
        
        // If still no valid transit routes, use mock transit routes
        let hasValidTransitDetails = false;
        for (const route of data.routes) {
          if (route.legs && route.legs.length > 0) {
            for (const leg of route.legs) {
              if (leg.steps && leg.steps.length > 0) {
                for (const step of leg.steps) {
                  if (step.travelMode === 'TRANSIT' && step.transitDetails) {
                    hasValidTransitDetails = true;
                    break;
                  }
                }
                if (hasValidTransitDetails) break;
              }
            }
            if (hasValidTransitDetails) break;
          }
        }
        
        if (!hasValidTransitDetails) {
          return Promise.all([
            createMockRoute(source, destination, 'route-0', travelMode),
            createMockRoute(source, destination, 'route-1', travelMode)
          ]);
        }
      }
    }

    // If we didn't get at least 2 routes and travel mode is not transit or walk
    if (data.routes.length < 2 && ![TravelMode.TRANSIT, TravelMode.WALK].includes(travelMode)) {
      console.log(`Only one route returned for ${travelMode}, trying with avoid highways option`);
      
      // For DRIVE mode, try with avoid highways
      if (travelMode === TravelMode.DRIVE) {
        try {
          const alternativeResponse = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': API_KEY,
              'X-Goog-FieldMask': fieldMask,
            },
            body: JSON.stringify({
              ...requestBody,
              routeModifiers: {
                avoidTolls: false,
                avoidHighways: true,
                avoidFerries: false,
              }
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
      }
      
      // If still don't have 2 routes and travel mode is not transit or walk, use mock alternative
      if (data.routes.length < 2 && travelMode !== TravelMode.TRANSIT && travelMode !== TravelMode.WALK) {
        console.log('Creating mock alternative routes as fallback');
        // Create additional mock routes
        for (let i = data.routes.length; i < 2; i++) {
          const mockRoutePromise = createMockRoute(source, destination, `route-${i}`, travelMode);
          // Use a synchronous approach here with as any to avoid changing the flow too much 
          const mockRoute = {
            distanceMeters: 0,
            duration: "0s",
            polyline: data.routes[0].polyline ? { 
              encodedPolyline: data.routes[0].polyline.encodedPolyline 
            } : { encodedPolyline: "" },
            legs: data.routes[0].legs ? JSON.parse(JSON.stringify(data.routes[0].legs)) : [],
            routeLabels: ["DEFAULT_ROUTE_ALTERNATE"]
          };
          data.routes.push(mockRoute as any);
        }
      }
    }
    
    // For walking mode, we accept single routes as valid
    if (travelMode === TravelMode.WALK && data.routes.length === 0) {
      console.error('No walking routes returned from API');
      // Create a direct walking route as fallback and continue with the rest of the function
      return createDirectWalkingRoute(source, destination).then(route => [route]);
    }
    
    // Limit to maximum 4 routes, except for walking mode which can have just 1
    if (travelMode !== TravelMode.WALK && data.routes.length > 4) {
      data.routes = data.routes.slice(0, 4);
    }
    
    // Fetch weather data for the source location only once
    // This will be used for all routes
    const weatherData = await getRouteLocationWeather(
      source.coordinates.lat,
      source.coordinates.lng
    );
    
    // Process the routes data
    const routePromises = data.routes.map(async (route, index) => {
      // For mock routes without polyline data, create a mock route
      if (!route.polyline || !route.polyline.encodedPolyline) {
        console.error(`Route ${index} is missing polyline data, this should not happen for walking routes`);
        // For walking routes, we should always have polyline data
        if (travelMode === TravelMode.WALK) {
          // Create a direct path between source and destination
          const points = [
            { lat: source.coordinates.lat, lng: source.coordinates.lng },
            { lat: destination.coordinates.lat, lng: destination.coordinates.lng }
          ];
          const walkingRoute = await createMockRoute(source, destination, `route-${index}`, travelMode);
          const distanceMeters = calculateDistance(
            source.coordinates.lat, source.coordinates.lng,
            destination.coordinates.lat, destination.coordinates.lng
          );
          
          // Create mock walking step
          const walkingStep: TransitStep = {
            type: 'WALKING',
            mode: 'WALKING',
            departureStop: source.name,
            arrivalStop: destination.name,
            duration: `${Math.round(distanceMeters / 83.3)}s`, // Average walking speed 5km/h (83.3m/min)
            distance: `${distanceMeters}m`,
          };
          
          // Create mock walking route data
          const routeData = {
            distanceMeters: distanceMeters,
            duration: `${Math.round(distanceMeters / 83.3)}s`,
            polyline: {
              encodedPolyline: encodePolyline(points)
            },
            legs: [{
              steps: [{
                polyline: {
                  encodedPolyline: encodePolyline(points)
                },
                distanceMeters: distanceMeters,
                staticDuration: `${Math.round(distanceMeters / 83.3)}s`,
                travelMode: "WALKING"
              }],
              startLocation: {
                latLng: {
                  latitude: source.coordinates.lat,
                  longitude: source.coordinates.lng
                }
              },
              endLocation: {
                latLng: {
                  latitude: destination.coordinates.lat,
                  longitude: destination.coordinates.lng
                }
              }
            }],
            routeLabels: ["DEFAULT_ROUTE"]
          };
          
          // Merge the route data with the mock route
          walkingRoute.distanceMeters = routeData.distanceMeters;
          walkingRoute.duration = routeData.duration;
          walkingRoute.polyline = routeData.polyline;
          walkingRoute.legs = routeData.legs as any;
          walkingRoute.routeLabels = routeData.routeLabels;
          walkingRoute.transitDetails = [walkingStep];
          return walkingRoute;
        } else {
          console.log(`Route ${index} is missing polyline data, creating mock route`);
          return createMockRoute(source, destination, `route-${index}`, travelMode);
        }
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
      const streetViewResult = await fetchStreetViewImages(points, 300, source.city || "", route.id);
      const streetViewImages = streetViewResult.images;
      const streetViewLocations = streetViewResult.locations;
      
      // Extract transit details if available - enhanced extraction
      const transitDetails = travelMode === TravelMode.TRANSIT ? 
        extractEnhancedTransitDetails(route) : undefined;
      
      // Log transit details for debugging
      if (travelMode === TravelMode.TRANSIT) {
        console.log(`Transit details for route ${index}:`, transitDetails);
        console.log('Route legs:', route.legs?.length);
        console.log('Steps in first leg:', route.legs?.[0]?.steps?.length);
        console.log('Travel modes in steps:', route.legs?.[0]?.steps?.map(s => s.travelMode).join(', '));
      }
      
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
        travelMode, // Add travel mode to route object
        transitDetails, // Add transit details if available
        // Initialize Gemini analysis with isAnalyzing: false
        geminiAnalysis: {
          riskScores: [],
          averageRiskScore: 0,
          isAnalyzing: false
        },
        // Add step polylines for visualizing different segments
        stepPolylines: extractStepPolylines(route, travelMode),
        // Include required API properties
        distanceMeters: route.distanceMeters,
        polyline: route.polyline,
        legs: route.legs as any
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

    // Start Gemini analysis for all routes asynchronously for any travel mode
    // We don't await this so routes are returned to the user immediately
    const resolvedRoutes = await Promise.all(routePromises) as any as Route[];
    if (resolvedRoutes.length > 0) {
      // Start loading accident hotspot data asynchronously
      resolvedRoutes.forEach(route => {
        if (route.id && route.streetViewLocations && route.streetViewLocations.length > 0) {
          // Don't await - this will run in the background and update via events
          loadAccidentHotspotDataAsync(route.streetViewLocations, route.id)
            .catch(error => console.error(`Error loading accident data for route ${route.id}:`, error));
        }
      });
      
      // Start image analysis
      analyzeAllRoutes(resolvedRoutes);
    }
    
    return resolvedRoutes;
  } catch (error) {
    console.error('Error computing routes:', error);
    throw error;
  }
};

// Function to analyze all routes with Gemini
const analyzeAllRoutes = async (routes: Route[]) => {
  try {
    if (!routes || routes.length === 0) {
      console.error('No routes to analyze');
      return;
    }

    console.log(`Starting Gemini analysis for ${routes.length} routes`);

    const analysisPromises = routes.map(async (route) => {
      if (route.id && route.points && route.points.length > 0) {
        console.log(`Analyzing route ${route.id}`);
        return analyzeRoute(route);
      } else {
        console.warn(`Route ${route.id} is missing points or is empty, skipping analysis`);
        return null;
      }
    });

    const analysisResults = await Promise.all(analysisPromises);

    // Filter out any null results
    const validResults = analysisResults.filter(result => result !== null);

    // Process valid results
    validResults.forEach((result, index) => {
      if (result) {
        console.log(`Route ${routes[index].id} analysis completed`);
        routes[index].geminiAnalysis = result;
        dispatchRouteAnalysisComplete(routes[index]);
      } else {
        console.warn(`Route ${routes[index].id} analysis skipped`);
      }
    });

    // Start loading accident data asynchronously for all routes
    loadAccidentDataForRoutes(routes);
  } catch (error) {
    console.error('Error analyzing routes:', error);
    throw error;
  }
};

// Start loading accident data asynchronously for all routes
export const loadAccidentDataForRoutes = (routes: Route[]): void => {
  if (!routes || routes.length === 0) return;
  
  console.log(`Starting async accident data loading for ${routes.length} routes`);
  
  // Process each route
  routes.forEach(route => {
    if (route.id && route.streetViewLocations && route.streetViewLocations.length > 0) {
      // Start async loading of accident data
      loadAccidentHotspotDataAsync(route.streetViewLocations, route.id).catch(error => {
        console.error(`Error loading accident data for route ${route.id}:`, error);
      });
    }
  });
};

// Listen for accident hotspot updates and update the route data
window.addEventListener(ACCIDENT_HOTSPOT_UPDATE_EVENT, ((event: CustomEvent) => {
  const { locationIndex, routeId, accidentHotspotData } = event.detail;
  
  // Find the route in allRoutes
  const routeIndex = allRoutes.findIndex(r => r.id === routeId);
  if (routeIndex === -1 || !allRoutes[routeIndex].streetViewLocations) return;
  
  // Find the location in the route's locations
  const location = allRoutes[routeIndex].streetViewLocations[locationIndex];
  if (!location) return;
  
  // Update the accident hotspot data
  location.accidentHotspot = accidentHotspotData;
  
  // Dispatch event to notify UI components
  dispatchRouteAnalysisComplete(allRoutes[routeIndex]);
}) as EventListener);

export const fetchStreetViewImages = async (
  points: { lat: number; lng: number }[], 
  interval = 300,
  cityName: string = ""
): Promise<{ images: string[], locations: import('@/types').StreetViewLocation[] }> => {
  try {
    // Use sample strategy to reduce number of API calls
    // We sample roughly one point every 300 meters of the route
    const sampledPoints = sampleRoutePoints(points, interval);
    
    if (sampledPoints.length === 0) {
      console.warn('No points to fetch street view images for');
      return { images: [], locations: [] };
    }
    
    console.log(`Fetching ${sampledPoints.length} street view images for route`);
    
    // Fetch street view metadata and images in parallel
    const results = await Promise.all(sampledPoints.map(async (point) => {
      try {
        // Get location details for this point
        const locationInfo = await getLocationInfo(point.lat, point.lng);
        const streetName = locationInfo?.streetName || 'Unknown Street';
        const formattedAddress = locationInfo?.formattedAddress || '';
        const city = cityName || '';
        const region = '';
        
        // Create empty accident hotspot data - will be loaded asynchronously later
        const emptyAccidentHotspotData = getEmptyAccidentHotspotData();
        
        // Build the Street View URL
        const zoom = 90; // Default zoom level
        const pitch = 10; // Slight upward tilt
        const fov = 90; // Wide field of view
        
        // Determine heading based on route direction
        const headingTowardsNext = sampledPoints.indexOf(point) < sampledPoints.length - 1 
          ? calculateHeading(point, sampledPoints[sampledPoints.indexOf(point) + 1])
          : 0;
        
        // Form the URL with all parameters
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        const url = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${point.lat},${point.lng}&heading=${headingTowardsNext}&pitch=${pitch}&fov=${fov}&key=${apiKey}`;
        
        return {
          url,
          location: {
            coordinates: point,
            heading: headingTowardsNext,
            index: sampledPoints.indexOf(point),
            streetName,
            formattedAddress,
            // Initialize with empty accident hotspot data
            accidentHotspot: emptyAccidentHotspotData
          }
        };
      } catch (error) {
        console.error(`Error fetching Street View for location ${point.lat},${point.lng}:`, error);
        return null;
      }
    }));
    
    // Filter out any failed requests
    const validResults = results.filter(result => result !== null);
    
    const images = validResults.map(result => result.url);
    const locations = validResults.map(result => result.location);
    
    return { images, locations };
  } catch (error) {
    console.error('Error fetching Street View images:', error);
    return { images: [], locations: [] };
  }
};