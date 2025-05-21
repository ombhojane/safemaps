import { Location, Route, RoutePoint, TransitStep } from "@/types";
import { analyzeStreetViewImages, calculateAverageRiskScore } from "@/services/geminiService";
import { getRouteLocationWeather, getWeatherCondition } from "@/services/weatherService";
import { getAccidentHotspotData, analyzeRouteAccidentHotspots } from './accidentHotspotsService';

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
          walkingRoute.legs = routeData.legs as unknown as Route['legs'];
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
      const streetViewResult = await fetchStreetViewImages(points, 300, source.city || "");
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
        legs: route.legs as unknown as Route['legs']
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
    const resolvedRoutes = await Promise.all(routePromises) as Route[];
    if (resolvedRoutes.length > 0) {
      analyzeAllRoutes(resolvedRoutes);
    }
    
    return resolvedRoutes;
  } catch (error) {
    console.error(`Error computing routes for ${travelMode}:`, error);
    if (travelMode === TravelMode.WALK) {
      // For walking mode, return a single direct route as a Promise
      return createDirectWalkingRoute(source, destination).then(route => [route]);
    }
    // For other modes, return two mock routes for better error recovery
    const mockRoutePromises = [
      createMockRoute(source, destination, 'route-0', travelMode),
      createMockRoute(source, destination, 'route-1', travelMode)
    ];
    // Start Gemini analysis for the mock routes too
    return Promise.all(mockRoutePromises).then(mockRoutes => {
      analyzeAllRoutes(mockRoutes);
      return mockRoutes;
    });
  }
};

// Function to analyze all routes with AI
const analyzeAllRoutes = async (routes: Route[]) => {
  try {
    // Import the criminal hotspots service - needs to be imported here to avoid circular dependencies
    const { analyzeRouteCrimeHotspots } = await import('./criminalHotspotsService');
    
    // Process routes in parallel with Promise.all
    await Promise.all(routes.map(async (route) => {
      if (!route.streetViewImages || route.streetViewImages.length === 0) return;
      
      // Update route to show it's being analyzed
      route.geminiAnalysis = {
        riskScores: [],
        averageRiskScore: 0,
        isAnalyzing: true
      };
      
      // Initialize accidentHotspotAnalysis property
      route.accidentHotspotAnalysis = {
        isAnalyzing: true,
        overallSafetyScore: 0,
        highRiskAreas: [],
        safetyAnalysis: "",
        safetySummary: "",
        safetySuggestions: []
      };
      
      // Initialize criminalHotspotAnalysis property
      route.criminalHotspotAnalysis = {
        isAnalyzing: true,
        overallSafetyScore: 0,
        highRiskAreas: [],
        safetyAnalysis: "",
        safetySummary: "",
        safetySuggestions: []
      };
      
      // Dispatch an event to notify that analysis has started
      dispatchRouteAnalysisComplete(route);
      
      try {
        // Use the street view images for analysis
        const imagesToAnalyze = route.streetViewImages;
        
        // Build context information for Gemini analysis
        let contextInfo = "";
        
        // Add weather information if available
        if (route.weather) {
          contextInfo += `Current weather conditions: ${route.weather.condition}, ${route.weather.temperature}°C, ${route.weather.description}. `;
          contextInfo += `Wind speed: ${route.weather.windSpeed} m/s. Humidity: ${route.weather.humidity}%.`;
        }
        
        // Add accident hotspot information from each location
        if (route.streetViewLocations && route.streetViewLocations.length > 0) {
          const accidentInfos = route.streetViewLocations
            .filter(loc => loc.accidentHotspot && loc.streetName)
            .map(loc => {
              const hotspot = loc.accidentHotspot;
              if (!hotspot) return "";
              
              let info = `At ${loc.streetName}: ${hotspot.analysisText} `;
              
              if (hotspot.riskFactors && hotspot.riskFactors.length > 0) {
                info += `Risk factors: ${hotspot.riskFactors.join(", ")}. `;
              }
              
              if (hotspot.suggestedPrecautions && hotspot.suggestedPrecautions.length > 0) {
                info += `Precautions: ${hotspot.suggestedPrecautions.join(". ")}.`;
              }
              
              return info;
            })
            .filter(info => info.length > 0);
            
          if (accidentInfos.length > 0) {
            contextInfo += "\n\nAccident History Information:\n" + accidentInfos.join("\n");
          }
        }
        
        // Add criminal hotspot information from each location
        if (route.streetViewLocations && route.streetViewLocations.length > 0) {
          const crimeInfos = route.streetViewLocations
            .filter(loc => loc.criminalHotspot && loc.streetName)
            .map(loc => {
              const hotspot = loc.criminalHotspot;
              if (!hotspot) return "";
              
              let info = `At ${loc.streetName}: ${hotspot.analysisText} `;
              
              if (hotspot.crimeTypes && hotspot.crimeTypes.length > 0) {
                info += `Crime types: ${hotspot.crimeTypes.join(", ")}. `;
              }
              
              if (hotspot.riskFactors && hotspot.riskFactors.length > 0) {
                info += `Risk factors: ${hotspot.riskFactors.join(", ")}. `;
              }
              
              if (hotspot.suggestedPrecautions && hotspot.suggestedPrecautions.length > 0) {
                info += `Precautions: ${hotspot.suggestedPrecautions.join(". ")}.`;
              }
              
              return info;
            })
            .filter(info => info.length > 0);
            
          if (crimeInfos.length > 0) {
            contextInfo += "\n\nCrime History Information:\n" + crimeInfos.join("\n");
          }
        }
        
        // Analyze accident hotspots and criminal hotspots for the entire route
        if (route.streetViewLocations && route.streetViewLocations.length > 0) {
          const routeName = `${route.source.name} to ${route.destination.name}`;
          
          // Run all analyses in parallel but handle their results/errors independently
          try {
            // Get analysis results with all context information
            const analysisResults = await analyzeStreetViewImages(
              imagesToAnalyze, 
              contextInfo
            );
            
            const averageRiskScore = calculateAverageRiskScore(analysisResults.riskScores);
            
            // Update route with analysis results
            route.geminiAnalysis = {
              riskScores: analysisResults.riskScores,
              explanations: analysisResults.explanations,
              precautions: analysisResults.precautions,
              averageRiskScore,
              isAnalyzing: false
            };
            
            // Dispatch event for Gemini analysis
            dispatchRouteAnalysisComplete(route);
          } catch (geminiError) {
            console.error(`Error in Gemini analysis for route ${route.id}:`, geminiError);
            route.geminiAnalysis = {
              riskScores: [],
              averageRiskScore: 0,
              isAnalyzing: false,
              error: 'Analysis failed'
            };
            dispatchRouteAnalysisComplete(route);
          }
          
          try {
            // Run accident hotspot analysis
            const accidentAnalysis = await analyzeRouteAccidentHotspots(
              route.streetViewLocations,
              routeName
            );
            
            // Update route with accident hotspot analysis
            route.accidentHotspotAnalysis = {
              isAnalyzing: false,
              overallSafetyScore: accidentAnalysis.overallSafetyScore,
              highRiskAreas: accidentAnalysis.highRiskAreas,
              safetyAnalysis: accidentAnalysis.safetyAnalysis,
              safetySummary: accidentAnalysis.safetySummary,
              safetySuggestions: accidentAnalysis.safetySuggestions
            };
            
            // Dispatch custom event for accident analysis
            const accidentEvent = new CustomEvent('accident-analysis-complete', { 
              detail: { 
                routeId: route.id,
                analysis: route.accidentHotspotAnalysis
              } 
            });
            window.dispatchEvent(accidentEvent);
          } catch (accidentError) {
            console.error(`Error in accident hotspot analysis for route ${route.id}:`, accidentError);
            route.accidentHotspotAnalysis = {
              isAnalyzing: false,
              overallSafetyScore: 70,
              highRiskAreas: [],
              safetyAnalysis: "Error analyzing accident data for this route.",
              safetySummary: "Accident analysis unavailable.",
              safetySuggestions: ["Exercise normal caution while traveling."],
              error: 'Analysis failed'
            };
            
            // Dispatch custom event even on error
            const accidentEvent = new CustomEvent('accident-analysis-complete', { 
              detail: { 
                routeId: route.id,
                analysis: route.accidentHotspotAnalysis
              } 
            });
            window.dispatchEvent(accidentEvent);
          }
          
          try {
            // Run criminal hotspot analysis
            const crimeAnalysis = await analyzeRouteCrimeHotspots(
              route.streetViewLocations,
              routeName
            );
            
            // Update route with criminal hotspot analysis
            route.criminalHotspotAnalysis = {
              isAnalyzing: false,
              overallSafetyScore: crimeAnalysis.overallSafetyScore,
              highRiskAreas: crimeAnalysis.highRiskAreas,
              safetyAnalysis: crimeAnalysis.safetyAnalysis,
              safetySummary: crimeAnalysis.safetySummary,
              safetySuggestions: crimeAnalysis.safetySuggestions
            };
            
            // Dispatch custom event for crime analysis
            const crimeEvent = new CustomEvent('crime-analysis-complete', { 
              detail: { 
                routeId: route.id,
                analysis: route.criminalHotspotAnalysis
              } 
            });
            window.dispatchEvent(crimeEvent);
          } catch (crimeError) {
            console.error(`Error in criminal hotspot analysis for route ${route.id}:`, crimeError);
            route.criminalHotspotAnalysis = {
              isAnalyzing: false,
              overallSafetyScore: 70,
              highRiskAreas: [],
              safetyAnalysis: "Error analyzing crime data for this route.",
              safetySummary: "Crime analysis unavailable.",
              safetySuggestions: ["Maintain normal awareness."],
              error: 'Analysis failed'
            };
            
            // Dispatch custom event even on error
            const crimeEvent = new CustomEvent('crime-analysis-complete', { 
              detail: { 
                routeId: route.id,
                analysis: route.criminalHotspotAnalysis
              } 
            });
            window.dispatchEvent(crimeEvent);
          }
        }
        
        // Dispatch an event to notify UI components about the completed analysis
        dispatchRouteAnalysisComplete(route);
      } catch (analysisError) {
        console.error(`Error analyzing route ${route.id}:`, analysisError);
        
        // Update route to show analysis failed
        route.geminiAnalysis = {
          riskScores: [],
          averageRiskScore: 0,
          isAnalyzing: false,
          error: 'Analysis failed'
        };
        
        // Update accident hotspot analysis to show it failed
        if (route.accidentHotspotAnalysis) {
          route.accidentHotspotAnalysis.isAnalyzing = false;
          route.accidentHotspotAnalysis.error = 'Analysis failed';
        }
        
        // Update criminal hotspot analysis to show it failed
        if (route.criminalHotspotAnalysis) {
          route.criminalHotspotAnalysis.isAnalyzing = false;
          route.criminalHotspotAnalysis.error = 'Analysis failed';
        }
        
        // Dispatch event with failure state
        dispatchRouteAnalysisComplete(route);
      }
    }));
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

// Helper function to check if two points are equal
function pointsAreEqual(point1: { lat: number; lng: number }, point2: { lat: number; lng: number }): boolean {
  return point1.lat === point2.lat && point1.lng === point2.lng;
}

// Calculate heading between two points
export function calculateHeading(
  point1: { lat: number; lng: number },
  point2: { lat: number; lng: number }
): number {
  // Convert to radians
  const lat1 = point1.lat * Math.PI / 180;
  const lat2 = point2.lat * Math.PI / 180;
  const lng1 = point1.lng * Math.PI / 180;
  const lng2 = point2.lng * Math.PI / 180;
  
  // Calculate heading
  const y = Math.sin(lng2 - lng1) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lng2 - lng1);
  const heading = Math.atan2(y, x) * 180 / Math.PI;
  
  // Normalize to 0-360
  return (heading + 360) % 360;
}

/**
 * Sample route points at regular intervals
 * 
 * @param points The array of route points
 * @param interval The interval in meters between samples
 * @returns An array of sampled points
 */
const sampleRoutePoints = (points: { lat: number; lng: number }[], interval: number): { lat: number; lng: number }[] => {
  if (!points || points.length < 2) return [];
  
  const MAX_IMAGES = 10; // Limit number of images for performance
  
  // For routes with many points, use evenly spaced samples
  // This ensures we cover the entire route, not just the first kilometer
  const samplePoints = selectEvenlySpacedSamples(points, MAX_IMAGES - 1); // Reserve one spot for destination
  
  // Add the destination point
  const streetViewPoints = [...samplePoints];
  if (!pointsAreEqual(points[points.length - 1], samplePoints[samplePoints.length - 1])) {
    streetViewPoints.push(points[points.length - 1]);
  }
  
  return streetViewPoints;
};

// Function to fetch street view images for a given set of points
export const fetchStreetViewImages = async (
  points: { lat: number; lng: number }[], 
  interval = 300,
  cityName: string = ""
): Promise<{ images: string[], locations: import('@/types').StreetViewLocation[] }> => {
  try {
    // Import related services
    const { getAccidentHotspotData } = await import('./accidentHotspotsService');
    const { updateLocationsWithCrimeData } = await import('./fetchStreetViewImages');
    
    // Sample points along the route at the specified interval
    const sampledPoints = sampleRoutePoints(points, interval);
    
    // Prepare image URLs and location data
    const imagePromises = sampledPoints.map(async (point, index) => {
      try {
        const { lat, lng } = point;
        
        // Get reverse geocoding information
        const locationInfo = await getLocationInfo(lat, lng);
        
        // Calculate heading (direction) between this point and the next point
        const nextPoint = sampledPoints[index + 1] || sampledPoints[index - 1] || { lat: lat + 0.001, lng: lng + 0.001 };
        const heading = calculateHeading(point, nextPoint);
        
        // Get Street View Image URL
        const streetViewUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${lat},${lng}&heading=${heading}&key=${API_KEY}`;
        
        // Extract the street name and formatted address
        const streetName = locationInfo?.streetName || 
                          (locationInfo as any)?.address_components?.find((c: any) => c.types.includes('route'))?.long_name ||
                          `Unnamed Road ${index + 1}`;
        
        const formattedAddress = locationInfo?.formattedAddress || 
                                (streetName + (cityName ? `, ${cityName}` : ''));
        
        // For each location, get accident hotspot data
        let accidentHotspot = undefined;
        if (formattedAddress) {
          try {
            accidentHotspot = await getAccidentHotspotData(formattedAddress);
          } catch (error) {
            console.error(`Error getting accident hotspot data for ${formattedAddress}:`, error);
          }
        }
        
        // Return image URL and location data
        return {
          imageUrl: streetViewUrl,
          location: {
            coordinates: { lat, lng },
            heading,
            index,
            streetName,
            formattedAddress,
            accidentHotspot
          }
        };
      } catch (error) {
        console.error("Error fetching street view image:", error);
        return null;
      }
    });
    
    // Wait for all image promises to resolve
    const results = await Promise.all(imagePromises);
    
    // Filter out any null results
    const validResults = results.filter(result => result !== null);
    
    // Extract images and locations from results
    const images = validResults.map(result => result.imageUrl);
    let locations = validResults.map(result => result.location);
    
    // Update locations with criminal hotspot data
    try {
      const updatedLocations = await updateLocationsWithCrimeData(locations);
      if (updatedLocations && updatedLocations.length > 0) {
        locations = updatedLocations as typeof locations;
      }
    } catch (error) {
      console.error("Error updating locations with crime data:", error);
    }
    
    // Return street view images and their locations
    return { images, locations };
  } catch (error) {
    console.error("Error in fetchStreetViewImages:", error);
    return { images: [], locations: [] };
  }
};

// Helper function to get location information including reverse geocoding
async function getLocationInfo(lat: number, lng: number) {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    const geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;
    
    const response = await fetch(geocodeUrl);
    const data = await response.json();
    
    if (data.status !== 'OK' || !data.results || data.results.length === 0) {
      return { streetName: '', formattedAddress: '' };
    }
    
    // Get formatted address
    const formattedAddress = data.results[0].formatted_address;
    
    // Find street name in address components
    let streetName = '';
    const addressComponents = data.results[0].address_components;
    for (const component of addressComponents) {
      if (component.types.includes('route')) {
        streetName = component.long_name;
        break;
      }
    }
    
    return { streetName, formattedAddress };
  } catch (error) {
    console.error("Error getting location info:", error);
    return { streetName: '', formattedAddress: '' };
  }
}

// Helper function to calculate the distance between two geographical coordinates in meters
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
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
const deg2rad = (deg: number): number => {
  return deg * (Math.PI/180);
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
const createMockRoute = async (source: Location, destination: Location, id = 'route-fallback', travelMode: TravelMode): Promise<Route> => {
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
  const streetViewResult = await fetchStreetViewImages(points);
  const streetViewImages = streetViewResult.images;
  const streetViewLocations = streetViewResult.locations;
  
  // Different risk score based on route number
  const riskScore = routeNumber === 0 ? 3 : routeNumber === 1 ? 6 : 8;
  
  // Create mock transit details if the travel mode is TRANSIT
  const transitDetails = travelMode === TravelMode.TRANSIT ? createMockTransitDetails(source, destination, routeNumber, durationInSeconds) : undefined;
  
  // Create the mock route with required API properties
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
    travelMode,
    transitDetails, // Add transit details to the route
    geminiAnalysis: {
      riskScores: [],
      averageRiskScore: 0,
      isAnalyzing: false
    },
    // Include required API properties
    distanceMeters: distanceInMeters,
    polyline: {
      encodedPolyline: encodePolyline(points)
    },
    legs: [{
      steps: [{
        polyline: {
          encodedPolyline: encodePolyline(points)
        },
        distanceMeters: distanceInMeters,
        staticDuration: `${Math.round(durationInSeconds)}s`,
        travelMode: travelMode === TravelMode.WALK ? 'WALKING' : travelMode
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
    }]
  };
};

// Helper function to create mock transit details
const createMockTransitDetails = (source: Location, destination: Location, routeNumber: number, totalDurationSec: number): TransitStep[] => {
  const transitSteps: TransitStep[] = [];
  
  // For simplicity, create a 3-step journey: Walk to stop, Transit, Walk to destination
  const walkToStopDuration = Math.round(totalDurationSec * 0.15); // 15% of total time
  const transitDuration = Math.round(totalDurationSec * 0.7); // 70% of total time
  const walkToDestDuration = Math.round(totalDurationSec * 0.15); // 15% of total time
  
  // Add walking step to transit stop (consolidated)
  transitSteps.push({
    type: 'WALK',
    duration: `${walkToStopDuration}s`,
    durationText: formatDuration(walkToStopDuration),
    distance: formatDistance(300) // Assume 300m walk to stop
  });
  
  // Create different transit options based on route number
  if (routeNumber === 0) {
    // First route: Bus
    const busNumber = "500A";
    const departureStop = "Central Station";
    const arrivalStop = "Market Square";
    
    // Create departure and arrival times
    const now = new Date();
    const departureTime = new Date(now.getTime() + 300000); // 5 minutes from now
    const arrivalTime = new Date(departureTime.getTime() + transitDuration * 1000);
    
    transitSteps.push({
      type: 'TRANSIT',
      mode: 'bus',
      line: busNumber,
      headsign: "Downtown",
      departureStop,
      arrivalStop,
      departureTime: departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      arrivalTime: arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      numStops: 5,
      agency: "Metro Transit",
      color: '#1A73E8',
      vehicle: 'Bus',
      duration: `${transitDuration}s`,
      durationText: formatDuration(transitDuration),
      distance: formatDistance(3000) // 3km transit ride
    });
  } else if (routeNumber === 1) {
    // Second route: Subway
    const subwayLine = "Blue Line";
    
    // Create departure and arrival times
    const now = new Date();
    const departureTime = new Date(now.getTime() + 420000); // 7 minutes from now
    const arrivalTime = new Date(departureTime.getTime() + transitDuration * 1000);
    
    // Add subway segment
    transitSteps.push({
      type: 'TRANSIT',
      mode: 'subway',
      line: subwayLine,
      headsign: "Westbound",
      departureStop: "North Terminal",
      arrivalStop: "City Center",
      departureTime: departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      arrivalTime: arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      numStops: 3,
      agency: "Metro Transit",
      color: '#0000FF',
      vehicle: 'Subway',
      duration: `${transitDuration}s`,
      durationText: formatDuration(transitDuration),
      distance: formatDistance(2000) // 2km subway ride
    });
  } else {
    // Other routes: Train
    const trainNumber = `${100 + routeNumber * 50}X`;
    const departureStop = "East Junction";
    const arrivalStop = "West End";
    
    // Create departure and arrival times
    const now = new Date();
    const departureTime = new Date(now.getTime() + 600000); // 10 minutes from now
    const arrivalTime = new Date(departureTime.getTime() + transitDuration * 1000);
    
    transitSteps.push({
      type: 'TRANSIT',
      mode: 'train',
      line: trainNumber,
      headsign: "Shopping Mall",
      departureStop,
      arrivalStop,
      departureTime: departureTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      arrivalTime: arrivalTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      numStops: 7,
      agency: "Metro Rail",
      color: '#188038',
      vehicle: 'Train',
      duration: `${transitDuration}s`,
      durationText: formatDuration(transitDuration),
      distance: formatDistance(4000) // 4km train ride
    });
  }
  
  // Add walking step to final destination (consolidated)
  transitSteps.push({
    type: 'WALK',
    duration: `${walkToDestDuration}s`,
    durationText: formatDuration(walkToDestDuration),
    distance: formatDistance(400) // Assume 400m walk to destination
  });
  
  return transitSteps;
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

// Enhanced function to extract polylines for each step to visualize different travel modes
const extractStepPolylines = (route: ComputeRoutesResponse['routes'][0], travelMode: TravelMode) => {
  if (!route.legs || route.legs.length === 0) {
    return [];
  }
  
  const stepPolylines = [];
  
  for (const leg of route.legs) {
    if (!leg.steps || leg.steps.length === 0) continue;
    
    for (const step of leg.steps) {
      if (!step.polyline || !step.polyline.encodedPolyline) continue;
      
      const points = decodePolyline(step.polyline.encodedPolyline);
      
      // Ensure walking segments are properly identified
      // The Google Routes API returns 'WALKING' for walking segments
      const stepTravelMode = step.travelMode || travelMode;
      const isWalking = stepTravelMode === 'WALKING' || stepTravelMode === TravelMode.WALK;
      
      stepPolylines.push({
        points,
        travelMode: isWalking ? 'WALKING' : stepTravelMode,
        distanceMeters: step.distanceMeters || 0,
        duration: step.staticDuration || '0s'
      });
    }
  }
  
  return stepPolylines;
};

// Enhanced transit details extraction for better public transport information
const extractEnhancedTransitDetails = (route: ComputeRoutesResponse['routes'][0]): TransitStep[] => {
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

// Format transit time from API format to readable format
const formatTransitTime = (timeString: string): string => {
  if (!timeString) return '';
  
  try {
    // Expected format: "2023-05-15T15:30:00Z"
    const date = new Date(timeString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('Error formatting transit time:', error);
    return timeString;
  }
};

// Helper function to create a direct walking route when API fails
const createDirectWalkingRoute = async (source: Location, destination: Location): Promise<Route> => {
  console.log('Creating direct walking route between:', source.name, 'and', destination.name);
  
  // Calculate a direct path between the two points
  const directPath = [
    { lat: source.coordinates.lat, lng: source.coordinates.lng },
    { lat: destination.coordinates.lat, lng: destination.coordinates.lng }
  ];
  
  // Calculate distance between points
  const distanceMeters = calculateDistance(
    source.coordinates.lat, 
    source.coordinates.lng,
    destination.coordinates.lat, 
    destination.coordinates.lng
  );
  
  // Estimate duration based on average walking speed (5 km/h = 1.4 m/s)
  const durationInSeconds = Math.round(distanceMeters / 1.4);
  
  // Generate smoother path with more points for better visualization
  const smoothPath = generateSmoothPath(directPath, 10);
  
  // Generate route points with risk scores 
  const routePoints: RoutePoint[] = smoothPath.map((point, idx) => ({
    coordinates: point,
    riskScore: 0, // Will be updated with real safety assessment
    position: {
      x: `${idx}`,
      y: `${idx}`,
    },
  }));
  
  // Get street view images along the direct path
  const streetViewResult = await fetchStreetViewImages(smoothPath, 300, source.city || "");
  
  // Create a walking step
  const walkingStep = {
    polyline: { encodedPolyline: encodePolyline(smoothPath) },
    distanceMeters: distanceMeters,
    staticDuration: `${durationInSeconds}s`,
    travelMode: "WALKING",
  };
  
  // Create route legs array
  const legs = [{
    steps: [walkingStep],
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
  }];
  
  // Create the route object
  const walkingRoute: Route = {
    id: 'direct-walking-route',
    source,
    destination,
    points: routePoints,
    riskScore: 0, // Initial risk score
    distance: formatDistance(distanceMeters),
    duration: formatDuration(durationInSeconds),
    riskAreas: [],
    path: generateSVGPath(smoothPath),
    streetViewImages: streetViewResult.images,
    streetViewLocations: streetViewResult.locations,
    travelMode: TravelMode.WALK,
    geminiAnalysis: {
      riskScores: [],
      averageRiskScore: 0,
      isAnalyzing: false
    },
    // Use proper step polylines
    stepPolylines: [{
      points: smoothPath,
      travelMode: "WALKING",
      distanceMeters: distanceMeters,
      duration: formatDuration(durationInSeconds)
    }],
    // Required for API compatibility
    distanceMeters: distanceMeters,
    polyline: { encodedPolyline: encodePolyline(smoothPath) },
    legs: legs as any // Use type assertion to satisfy TypeScript
  };
  
  return walkingRoute;
};

// Function to analyze a route and return a safety score
export const analyzeRoute = async (
  route: import('@/types').Route, 
  weatherInfo: string = ""
): Promise<import('@/types').RouteAnalysis> => {
  try {
    // Get Street View images along the route
    const streetViewData = await fetchStreetViewImages(
      route.points.map(p => p.coordinates), 
      300, 
      route.source.city || ""
    );
    
    const images = streetViewData.images;
    const locations = streetViewData.locations;
    
    if (images.length === 0) {
      return { 
        overallRiskScore: 50, 
        riskScores: [],
        route,
        riskAreas: [],
        recommendation: "Could not analyze route due to missing Street View data.",
        images: [],
        locations: [],
        explanations: [],
        precautions: []
      };
    }

    // Build context information for Gemini analysis
    let contextInfo = weatherInfo;
    
    // Add accident hotspot information from each location
    if (locations && locations.length > 0) {
      const accidentInfos = locations
        .filter(loc => loc.accidentHotspot && loc.streetName)
        .map(loc => {
          const hotspot = loc.accidentHotspot;
          if (!hotspot) return "";
          
          let info = `At ${loc.streetName}: ${hotspot.analysisText} `;
          
          if (hotspot.riskFactors && hotspot.riskFactors.length > 0) {
            info += `Risk factors: ${hotspot.riskFactors.join(", ")}. `;
          }
          
          if (hotspot.suggestedPrecautions && hotspot.suggestedPrecautions.length > 0) {
            info += `Precautions: ${hotspot.suggestedPrecautions.join(". ")}.`;
          }
          
          return info;
        })
        .filter(info => info.length > 0);
        
      if (accidentInfos.length > 0) {
        contextInfo += "\n\nAccident History Information:\n" + accidentInfos.join("\n");
      }
    }
    
    // Analyze the Street View images with the context information
    const { riskScores, explanations, precautions } = await analyzeStreetViewImages(
      images, 
      contextInfo
    );
    
    // Calculate overall risk score (weighted average)
    const overallRiskScore = calculateAverageRiskScore(riskScores);
    
    // Generate an overall explanation
    let riskLevel = "moderate";
    if (overallRiskScore < 3) riskLevel = "low";
    if (overallRiskScore > 7) riskLevel = "high";
    
    const recommendation = `This route has a ${riskLevel} risk level with an average risk score of ${overallRiskScore.toFixed(1)}.`;
    
    return {
      overallRiskScore,
      riskScores,
      route,
      riskAreas: [],
      recommendation,
      images,
      locations,
      explanations,
      precautions
    };
  } catch (error) {
    console.error("Error analyzing route:", error);
    return { 
      overallRiskScore: 50, 
      riskScores: [],
      route,
      riskAreas: [],
      recommendation: "An error occurred during route analysis.",
      images: [],
      locations: [],
      explanations: [],
      precautions: []
    };
  }
}; 