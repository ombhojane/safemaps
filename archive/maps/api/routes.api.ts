import { Location } from "@/types";
import { API_KEY } from "./maps.api";
import { ComputeRoutesResponse, Route, TravelMode, SUPPORTED_TRAVEL_MODES } from "../types";
import { analyzeAllRoutes } from "../analysis/route.analysis";
import { extractStepPolylines, extractEnhancedTransitDetails } from "../transit/transit.service";
import { getRouteLocationWeather, getWeatherCondition } from "@/services/weatherService";
import { formatDistance, formatDuration } from "../utils";
import { decodePolyline, generateSVGPath } from "../utils";
import { fetchStreetViewImages } from "../streetview/image.service";

/**
 * Compute routes between source and destination
 */
export const computeRoutes = async (
  source: Location,
  destination: Location,
  travelMode: TravelMode = TravelMode.DRIVE
): Promise<Route[]> => {
  try {
    console.log(`Computing routes from ${source.name} to ${destination.name} via ${travelMode}`);
    
    // Skip unsupported modes
    if (!SUPPORTED_TRAVEL_MODES.includes(travelMode)) {
      throw new Error(`${travelMode} mode is not supported`);
    }

    // Validate source and destination coordinates
    if (!source.coordinates || !destination.coordinates ||
        isNaN(source.coordinates.lat) || isNaN(source.coordinates.lng) ||
        isNaN(destination.coordinates.lat) || isNaN(destination.coordinates.lng)) {
      throw new Error('Invalid source or destination coordinates');
    }

    // Create base request body
    const requestBody = createRequestBody(source, destination, travelMode);
    
    // Make API request to compute routes
    const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': getFieldMask(travelMode),
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(`Routes API error: ${response.status}`);
    }

    const data: ComputeRoutesResponse = await response.json();
    
    // Process and validate routes
    const routes = await processRoutes(data, source, destination, travelMode);
    
    return routes;
  } catch (error) {
    console.error(`Error computing routes for ${travelMode}:`, error);
    throw error; // Let the caller handle the error
  }
};

// Helper function to create request body
const createRequestBody = (source: Location, destination: Location, travelMode: TravelMode) => {
  const requestBody: any = {
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
    computeAlternativeRoutes: true,
    languageCode: "en-US",
    units: "IMPERIAL"
  };

  // Add mode-specific parameters
  if (travelMode === TravelMode.DRIVE || travelMode === TravelMode.TWO_WHEELER) {
    requestBody.routingPreference = "TRAFFIC_AWARE";
    requestBody.routeModifiers = {
      avoidHighways: travelMode === TravelMode.TWO_WHEELER,
      avoidTolls: travelMode === TravelMode.TWO_WHEELER
    };
  } else if (travelMode === TravelMode.TRANSIT) {
    requestBody.transitPreferences = {
      routingPreference: "LESS_WALKING",
      allowedTravelModes: ["BUS", "SUBWAY", "TRAIN", "LIGHT_RAIL", "RAIL"]
    };
  }

  return requestBody;
};

// Helper function to get field mask based on travel mode
const getFieldMask = (travelMode: TravelMode): string => {
  let fieldMask = 'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.polyline,routes.distanceMeters,routes.duration,routes.routeLabels';
  
  if (travelMode === TravelMode.TRANSIT) {
    fieldMask = 'routes.legs.steps.polyline,routes.legs.steps.distanceMeters,routes.legs.steps.staticDuration,routes.legs.steps.travelMode,routes.legs.steps.transitDetails,routes.legs.stepsOverview,routes.polyline,routes.distanceMeters,routes.duration,routes.routeLabels';
  }
  
  return fieldMask;
};

// Helper function to process routes data
const processRoutes = async (
  data: ComputeRoutesResponse,
  source: Location,
  destination: Location,
  travelMode: TravelMode
): Promise<Route[]> => {
  if (!data || !data.routes || !Array.isArray(data.routes) || data.routes.length === 0) {
    throw new Error('No routes returned from API');
  }

  // Fetch weather data for the source location
  const weatherData = await getRouteLocationWeather(
    source.coordinates.lat,
    source.coordinates.lng
  );

  // Process each route
  const routes = data.routes.map((route, index) => {
    if (!route.polyline || !route.polyline.encodedPolyline) {
      throw new Error('Invalid route data: missing polyline');
    }

    // Decode the polyline to get the route path
    const points = decodePolyline(route.polyline.encodedPolyline);

    // Convert duration string to minutes
    const durationInSeconds = route.duration ? parseInt(route.duration.replace('s', '')) : 0;
    const durationText = formatDuration(durationInSeconds);

    // Convert distance in meters to miles or kilometers
    const distanceText = formatDistance(route.distanceMeters || 0);

    // Generate route points
    const routePoints = points.map((point, idx) => ({
      coordinates: point,
      riskScore: 0, // Initial risk score, will be updated by analysis
      position: {
        x: `${idx}`,
        y: `${idx}`,
      },
    }));

    // Get street view images and locations
    const { images: streetViewImages, locations: streetViewLocations } = fetchStreetViewImages(points);

    // Extract transit details if available
    const transitDetails = travelMode === TravelMode.TRANSIT ? 
      extractEnhancedTransitDetails(route) : undefined;

    // Set the route's ID
    const isAlternative = route.routeLabels && 
                         route.routeLabels.includes("DEFAULT_ROUTE_ALTERNATE");
    const routeId = isAlternative ? `route-alt-${index}` : `route-${index}`;

    // Create route object
    const routeObject: Route = {
      id: routeId,
      source,
      destination,
      points: routePoints,
      riskScore: 0, // Initial risk score, will be updated by analysis
      distance: distanceText,
      duration: durationText,
      riskAreas: [],
      path: generateSVGPath(points),
      streetViewImages,
      streetViewLocations,
      travelMode,
      transitDetails,
      geminiAnalysis: {
        riskScores: [],
        averageRiskScore: 0,
        isAnalyzing: false
      },
      distanceMeters: route.distanceMeters,
      polyline: route.polyline,
      legs: route.legs,
      stepPolylines: extractStepPolylines(route, travelMode)
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

  // Start Gemini analysis for all routes
  if (routes.length > 0) {
    analyzeAllRoutes(routes);
  }

  return routes;
}; 