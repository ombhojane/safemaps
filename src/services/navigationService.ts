import { Route, RoutePoint, StreetViewLocation } from "@/types";
import { calculateHeading, decodePolyline } from "./mapsService";

// Navigation status enum
export enum NavigationStatus {
  IDLE = "idle",
  NAVIGATING = "navigating",
  ARRIVED = "arrived",
  REROUTING = "rerouting",
  ERROR = "error"
}

// Interface for navigation state
export interface NavigationState {
  status: NavigationStatus;
  currentRoute: Route | null;
  currentPosition: GeolocationPosition | null;
  currentStep: NavigationStep | null;
  nextStep: NavigationStep | null;
  distanceToNextTurn: number; // in meters
  distanceToDestination: number; // in meters
  estimatedArrivalTime: Date | null;
  remainingDuration: number; // in seconds
  isOffRoute: boolean;
  navigationProgress: number; // 0-100%
  lastReroute: Date | null;
}

// Interface for turn-by-turn navigation step
export interface NavigationStep {
  index: number;
  instruction: string;
  maneuver: NavigationManeuver;
  distance: number; // in meters
  duration: number; // in seconds
  startPoint: RoutePoint;
  endPoint: RoutePoint;
  streetName: string;
  isRoundabout: boolean;
  exitNumber?: number; // for roundabouts
  drivingSide: 'LEFT' | 'RIGHT';
}

// Types of navigation maneuvers
export enum NavigationManeuver {
  STRAIGHT = "straight",
  TURN_RIGHT = "turn-right",
  TURN_LEFT = "turn-left",
  SLIGHT_RIGHT = "slight-right",
  SLIGHT_LEFT = "slight-left",
  SHARP_RIGHT = "sharp-right",
  SHARP_LEFT = "sharp-left",
  U_TURN = "u-turn",
  MERGE = "merge",
  ROUNDABOUT = "roundabout",
  EXIT = "exit", // Exit highway
  RAMP = "ramp", // Take a ramp
  CONTINUE = "continue",
  ARRIVE = "arrive"
}

// Default navigation state
const initialNavigationState: NavigationState = {
  status: NavigationStatus.IDLE,
  currentRoute: null,
  currentPosition: null,
  currentStep: null,
  nextStep: null,
  distanceToNextTurn: 0,
  distanceToDestination: 0,
  estimatedArrivalTime: null,
  remainingDuration: 0,
  isOffRoute: false,
  navigationProgress: 0,
  lastReroute: null
};

// Navigation state & watchers
let navigationState: NavigationState = { ...initialNavigationState };
let navigationWatchers: ((state: NavigationState) => void)[] = [];
let watchPositionId: number | null = null;
let recalculationInterval: NodeJS.Timeout | null = null;
let voiceGuidanceEnabled = true;

// Speech synthesis for voice guidance
const speakInstruction = (text: string) => {
  if (!voiceGuidanceEnabled || !text || !window.speechSynthesis) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.9; // Slightly slower speech rate for better clarity
  
  // Cancel any ongoing speech
  window.speechSynthesis.cancel();
  
  // Speak the new instruction
  window.speechSynthesis.speak(utterance);
};

// Start navigation with a route
export const startNavigation = (route: Route): NavigationState => {
  try {
    // Stop any existing navigation
    stopNavigation();
    
    // Process the route to extract detailed steps
    const navigationSteps = processRouteForNavigation(route);
    
    // Set initial navigation state
    navigationState = {
      ...initialNavigationState,
      status: NavigationStatus.NAVIGATING,
      currentRoute: route,
      currentStep: navigationSteps.length > 0 ? navigationSteps[0] : null,
      nextStep: navigationSteps.length > 1 ? navigationSteps[1] : null,
      distanceToDestination: calculateTotalRouteDistance(route),
      remainingDuration: parseRouteDuration(route.duration),
      estimatedArrivalTime: calculateETA(parseRouteDuration(route.duration))
    };
    
    // Start watching user's position
    startPositionTracking();
    
    // Start recalculation interval for ETA and distance updates
    startRecalculationInterval();
    
    // Welcome message
    if (voiceGuidanceEnabled) {
      setTimeout(() => {
        speakInstruction("Starting navigation. " + (navigationState.currentStep?.instruction || ""));
      }, 1000);
    }
    
    // Notify watchers
    notifyWatchers();
    
    return navigationState;
  } catch (error) {
    console.error("Failed to start navigation:", error);
    
    navigationState = {
      ...initialNavigationState,
      status: NavigationStatus.ERROR
    };
    
    notifyWatchers();
    return navigationState;
  }
};

// Stop navigation
export const stopNavigation = (): void => {
  // Clear position watching
  if (watchPositionId !== null) {
    navigator.geolocation.clearWatch(watchPositionId);
    watchPositionId = null;
  }
  
  // Clear recalculation interval
  if (recalculationInterval) {
    clearInterval(recalculationInterval);
    recalculationInterval = null;
  }
  
  // Reset navigation state
  navigationState = { ...initialNavigationState };
  
  // Notify watchers
  notifyWatchers();
};

// Toggle voice guidance
export const toggleVoiceGuidance = (): boolean => {
  voiceGuidanceEnabled = !voiceGuidanceEnabled;
  return voiceGuidanceEnabled;
};

// Get current navigation state
export const getNavigationState = (): NavigationState => {
  return navigationState;
};

// Subscribe to navigation state changes
export const subscribeToNavigation = (callback: (state: NavigationState) => void): () => void => {
  navigationWatchers.push(callback);
  
  // Return unsubscribe function
  return () => {
    navigationWatchers = navigationWatchers.filter(watcher => watcher !== callback);
  };
};

// Handle position updates from geolocation API
const handlePositionUpdate = (position: GeolocationPosition): void => {
  const previousPosition = navigationState.currentPosition;
  
  // Update current position
  navigationState.currentPosition = position;
  
  // Calculate new distances based on current position
  if (navigationState.currentRoute && navigationState.currentStep) {
    // Calculate distance to next turn
    navigationState.distanceToNextTurn = calculateDistanceToPoint(
      position.coords.latitude,
      position.coords.longitude,
      navigationState.currentStep.endPoint.coordinates.lat,
      navigationState.currentStep.endPoint.coordinates.lng
    );
    
    // Calculate distance to destination
    navigationState.distanceToDestination = calculateDistanceToPoint(
      position.coords.latitude,
      position.coords.longitude,
      navigationState.currentRoute.destination.coordinates.lat,
      navigationState.currentRoute.destination.coordinates.lng
    );
    
    // Update navigation progress
    const totalDistance = calculateTotalRouteDistance(navigationState.currentRoute);
    const traveledDistance = totalDistance - navigationState.distanceToDestination;
    navigationState.navigationProgress = Math.min(Math.floor((traveledDistance / totalDistance) * 100), 100);
    
    // Check if arrived at destination
    if (navigationState.distanceToDestination < 50) { // Less than 50 meters to destination
      handleArrival();
    }
    // Check if we should move to the next step
    else if (navigationState.distanceToNextTurn < 30) { // Less than 30 meters to next turn
      moveToNextStep();
    }
    // Check if user is off route
    else {
      checkIfOffRoute(position);
    }
    
    // Trigger voice guidance based on distance to next turn
    triggerDistanceBasedVoiceGuidance();
  }
  
  // Notify watchers of state update
  notifyWatchers();
};

// Process a route into detailed navigation steps
const processRouteForNavigation = (route: Route): NavigationStep[] => {
  // This is a simplified version - in a real implementation, we would
  // use Google's DirectionsService for detailed turn-by-turn instructions
  
  const steps: NavigationStep[] = [];
  const points = route.points;
  
  if (!points || points.length < 2) {
    return steps;
  }
  
  // In a real implementation, we would analyze the route geometry
  // to detect turns, intersections, etc. Here we'll create simplified
  // steps based on significant heading changes
  
  let currentStreetName = "Unknown Road";
  let currentIndex = 0;
  
  // Try to get the first street name if available
  if (route.streetViewLocations && route.streetViewLocations.length > 0 && route.streetViewLocations[0].streetName) {
    currentStreetName = route.streetViewLocations[0].streetName;
  }
  
  // Add an initial step to start
  steps.push({
    index: currentIndex++,
    instruction: `Start on ${currentStreetName}`,
    maneuver: NavigationManeuver.STRAIGHT,
    distance: 0,
    duration: 0,
    startPoint: points[0],
    endPoint: points[0],
    streetName: currentStreetName,
    isRoundabout: false,
    drivingSide: 'RIGHT'
  });
  
  // Process route points to detect turns
  let lastHeading = 0;
  let currentSegmentStart = 0;
  let segmentDistance = 0;
  
  for (let i = 1; i < points.length; i++) {
    const prevPoint = points[i - 1];
    const currentPoint = points[i];
    
    // Calculate heading (direction) between previous and current point
    const heading = calculateHeading(
      prevPoint.coordinates.lat, prevPoint.coordinates.lng,
      currentPoint.coordinates.lat, currentPoint.coordinates.lng
    );
    
    // Calculate distance between points
    const pointDistance = calculateDistanceToPoint(
      prevPoint.coordinates.lat, prevPoint.coordinates.lng,
      currentPoint.coordinates.lat, currentPoint.coordinates.lng
    );
    
    segmentDistance += pointDistance;
    
    // Skip first point as we need a heading to compare with
    if (i === 1) {
      lastHeading = heading;
      continue;
    }
    
    // Check if there's a significant heading change (a turn)
    const headingDiff = calculateHeadingDifference(lastHeading, heading);
    
    // If there's a significant turn (more than 30 degrees) or if we've reached the last point
    if (headingDiff > 30 || i === points.length - 1) {
      // Determine the type of maneuver based on heading change
      const maneuver = determineManeuver(headingDiff, lastHeading, heading);
      
      // Create a step for this segment
      steps.push({
        index: currentIndex++,
        instruction: generateInstructionFromManeuver(maneuver, currentStreetName),
        maneuver,
        distance: segmentDistance,
        duration: estimateDuration(segmentDistance),
        startPoint: points[currentSegmentStart],
        endPoint: prevPoint,
        streetName: currentStreetName,
        isRoundabout: false,
        drivingSide: 'RIGHT'
      });
      
      // Update for next segment
      currentSegmentStart = i - 1;
      segmentDistance = pointDistance;
      lastHeading = heading;
      
      // Look for street name near this turning point
      if (route.streetViewLocations) {
        const nearbyLocation = findNearestStreetViewLocation(
          prevPoint.coordinates.lat, prevPoint.coordinates.lng,
          route.streetViewLocations
        );
        
        if (nearbyLocation && nearbyLocation.streetName) {
          currentStreetName = nearbyLocation.streetName;
        }
      }
    }
  }
  
  // Add final arrival step
  steps.push({
    index: currentIndex,
    instruction: "You have arrived at your destination",
    maneuver: NavigationManeuver.ARRIVE,
    distance: 0,
    duration: 0,
    startPoint: points[points.length - 1],
    endPoint: points[points.length - 1],
    streetName: currentStreetName,
    isRoundabout: false,
    drivingSide: 'RIGHT'
  });
  
  return steps;
};

// Start tracking user position
const startPositionTracking = (): void => {
  if (navigator.geolocation) {
    watchPositionId = navigator.geolocation.watchPosition(
      handlePositionUpdate,
      (error) => {
        console.error("Geolocation error:", error);
        navigationState.status = NavigationStatus.ERROR;
        notifyWatchers();
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 20000
      }
    );
  } else {
    console.error("Geolocation not supported by this browser");
    navigationState.status = NavigationStatus.ERROR;
    notifyWatchers();
  }
};

// Start recalculation interval
const startRecalculationInterval = (): void => {
  recalculationInterval = setInterval(() => {
    if (navigationState.status !== NavigationStatus.NAVIGATING) return;
    
    // Update ETA
    if (navigationState.remainingDuration > 0) {
      navigationState.remainingDuration = Math.max(0, navigationState.remainingDuration - 1);
      navigationState.estimatedArrivalTime = calculateETA(navigationState.remainingDuration);
    }
    
    notifyWatchers();
  }, 1000);
};

// Determine maneuver type from heading change
const determineManeuver = (headingDiff: number, fromHeading: number, toHeading: number): NavigationManeuver => {
  // Determine turn direction (left or right)
  const isTurnRight = isRightTurn(fromHeading, toHeading);
  
  if (headingDiff < 20) {
    return NavigationManeuver.CONTINUE;
  } else if (headingDiff < 45) {
    return isTurnRight ? NavigationManeuver.SLIGHT_RIGHT : NavigationManeuver.SLIGHT_LEFT;
  } else if (headingDiff < 120) {
    return isTurnRight ? NavigationManeuver.TURN_RIGHT : NavigationManeuver.TURN_LEFT;
  } else if (headingDiff < 170) {
    return isTurnRight ? NavigationManeuver.SHARP_RIGHT : NavigationManeuver.SHARP_LEFT;
  } else {
    return NavigationManeuver.U_TURN;
  }
};

// Generate instruction text from maneuver type
const generateInstructionFromManeuver = (maneuver: NavigationManeuver, streetName: string): string => {
  switch (maneuver) {
    case NavigationManeuver.CONTINUE:
      return `Continue straight on ${streetName}`;
    case NavigationManeuver.SLIGHT_RIGHT:
      return `Slight right onto ${streetName}`;
    case NavigationManeuver.SLIGHT_LEFT:
      return `Slight left onto ${streetName}`;
    case NavigationManeuver.TURN_RIGHT:
      return `Turn right onto ${streetName}`;
    case NavigationManeuver.TURN_LEFT:
      return `Turn left onto ${streetName}`;
    case NavigationManeuver.SHARP_RIGHT:
      return `Sharp right onto ${streetName}`;
    case NavigationManeuver.SHARP_LEFT:
      return `Sharp left onto ${streetName}`;
    case NavigationManeuver.U_TURN:
      return `Make a U-turn onto ${streetName}`;
    case NavigationManeuver.ROUNDABOUT:
      return `Enter the roundabout`;
    case NavigationManeuver.EXIT:
      return `Take the exit toward ${streetName}`;
    case NavigationManeuver.RAMP:
      return `Take the ramp onto ${streetName}`;
    case NavigationManeuver.MERGE:
      return `Merge onto ${streetName}`;
    case NavigationManeuver.ARRIVE:
      return `You have arrived at your destination`;
    default:
      return `Continue on ${streetName}`;
  }
};

// Move to the next navigation step
const moveToNextStep = (): void => {
  if (!navigationState.currentRoute) return;
  
  // Get all steps for the route
  const steps = processRouteForNavigation(navigationState.currentRoute);
  
  // Find index of current step
  const currentIndex = navigationState.currentStep?.index ?? 0;
  
  // If we have a next step
  if (currentIndex < steps.length - 1) {
    const nextStep = steps[currentIndex + 1];
    const nextNextStep = currentIndex + 2 < steps.length ? steps[currentIndex + 2] : null;
    
    navigationState.currentStep = nextStep;
    navigationState.nextStep = nextNextStep;
    
    // Announce the next step
    if (nextStep.maneuver !== NavigationManeuver.ARRIVE) {
      speakInstruction(nextStep.instruction);
    } else {
      speakInstruction("You have arrived at your destination");
    }
  }
};

// Handle arrival at destination
const handleArrival = (): void => {
  navigationState.status = NavigationStatus.ARRIVED;
  speakInstruction("You have arrived at your destination");
  
  // Stop tracking after a short delay to allow final position updates
  setTimeout(() => {
    if (watchPositionId !== null) {
      navigator.geolocation.clearWatch(watchPositionId);
      watchPositionId = null;
    }
  }, 3000);
};

// Check if user is off route
const checkIfOffRoute = (position: GeolocationPosition): void => {
  if (!navigationState.currentRoute || !navigationState.currentStep) return;
  
  // Calculate the distance to the current path
  const distanceToPath = calculateDistanceToPath(
    position.coords.latitude,
    position.coords.longitude,
    navigationState.currentStep.startPoint,
    navigationState.currentStep.endPoint
  );
  
  // If distance to path is greater than threshold (e.g., 50 meters)
  const isOffRoute = distanceToPath > 50;
  
  // If status changed
  if (isOffRoute !== navigationState.isOffRoute) {
    navigationState.isOffRoute = isOffRoute;
    
    if (isOffRoute) {
      // If it's been at least 10 seconds since last reroute, trigger rerouting
      const now = new Date();
      if (!navigationState.lastReroute || (now.getTime() - navigationState.lastReroute.getTime()) > 10000) {
        triggerRerouting();
      }
    }
  }
};

// Trigger rerouting
const triggerRerouting = (): void => {
  if (!navigationState.currentPosition || !navigationState.currentRoute) return;
  
  navigationState.status = NavigationStatus.REROUTING;
  navigationState.lastReroute = new Date();
  
  speakInstruction("Recalculating route");
  
  // In a real implementation, we would call a route service to recalculate
  // the route from current position to destination
  // For now, we'll simulate a successful reroute after a short delay
  
  setTimeout(() => {
    navigationState.status = NavigationStatus.NAVIGATING;
    notifyWatchers();
  }, 3000);
};

// Trigger voice guidance based on distance to next turn
const triggerDistanceBasedVoiceGuidance = (): void => {
  if (!navigationState.currentStep || !voiceGuidanceEnabled) return;
  
  const distanceToTurn = navigationState.distanceToNextTurn;
  
  // Announce based on distance thresholds
  if (navigationState.currentStep.maneuver !== NavigationManeuver.CONTINUE) {
    if (distanceToTurn <= 500 && distanceToTurn > 400) {
      // About 500m before the turn
      speakInstruction(`In 500 meters, ${navigationState.currentStep.instruction}`);
    } else if (distanceToTurn <= 200 && distanceToTurn > 150) {
      // About 200m before the turn
      speakInstruction(`In 200 meters, ${navigationState.currentStep.instruction}`);
    } else if (distanceToTurn <= 100 && distanceToTurn > 50) {
      // About 100m before the turn
      speakInstruction(`In 100 meters, ${navigationState.currentStep.instruction}`);
    } else if (distanceToTurn <= 30 && distanceToTurn > 20) {
      // Right at the turn
      speakInstruction(navigationState.currentStep.instruction);
    }
  }
};

// Notify all navigation watchers of state update
const notifyWatchers = (): void => {
  navigationWatchers.forEach(watcher => {
    try {
      watcher(navigationState);
    } catch (error) {
      console.error("Error in navigation watcher:", error);
    }
  });
};

// Calculate ETA based on remaining duration in seconds
const calculateETA = (durationInSeconds: number): Date => {
  const now = new Date();
  return new Date(now.getTime() + durationInSeconds * 1000);
};

// Parse a duration string (e.g. "1 hr 30 min") to seconds
const parseRouteDuration = (durationText: string): number => {
  let totalSeconds = 0;
  
  const hourMatch = durationText.match(/(\d+)\s+hr/);
  if (hourMatch && hourMatch[1]) {
    totalSeconds += parseInt(hourMatch[1]) * 3600;
  }
  
  const minuteMatch = durationText.match(/(\d+)\s+min/);
  if (minuteMatch && minuteMatch[1]) {
    totalSeconds += parseInt(minuteMatch[1]) * 60;
  }
  
  return totalSeconds;
};

// Calculate total route distance (in meters)
const calculateTotalRouteDistance = (route: Route): number => {
  if (!route.points || route.points.length < 2) return 0;
  
  let totalDistance = 0;
  
  for (let i = 1; i < route.points.length; i++) {
    const prevPoint = route.points[i - 1];
    const currentPoint = route.points[i];
    
    totalDistance += calculateDistanceToPoint(
      prevPoint.coordinates.lat, prevPoint.coordinates.lng,
      currentPoint.coordinates.lat, currentPoint.coordinates.lng
    );
  }
  
  return totalDistance;
};

// Calculate distance between two points using Haversine formula (in meters)
const calculateDistanceToPoint = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
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

// Calculate the difference between two headings (0-180 degrees)
const calculateHeadingDifference = (heading1: number, heading2: number): number => {
  const diff = Math.abs(heading1 - heading2) % 360;
  return diff > 180 ? 360 - diff : diff;
};

// Determine if a turn is to the right
const isRightTurn = (fromHeading: number, toHeading: number): boolean => {
  // Normalize headings to 0-360
  const from = fromHeading % 360;
  const to = toHeading % 360;
  
  // Calculate angle between headings
  const angle = (to - from + 360) % 360;
  
  // If angle is between 0 and 180, it's a right turn
  return angle > 0 && angle < 180;
};

// Calculate approximate duration based on distance and average speed
const estimateDuration = (distanceInMeters: number): number => {
  // Assume average speed of 40 km/h in urban areas
  const averageSpeedMps = (40 * 1000) / 3600; // 11.11 meters per second
  
  return Math.round(distanceInMeters / averageSpeedMps);
};

// Find the nearest street view location to a point
const findNearestStreetViewLocation = (
  lat: number, 
  lng: number, 
  locations: StreetViewLocation[]
): StreetViewLocation | null => {
  if (!locations || locations.length === 0) return null;
  
  let nearestLocation = locations[0];
  let nearestDistance = calculateDistanceToPoint(
    lat, lng,
    nearestLocation.coordinates.lat, nearestLocation.coordinates.lng
  );
  
  for (let i = 1; i < locations.length; i++) {
    const location = locations[i];
    const distance = calculateDistanceToPoint(
      lat, lng,
      location.coordinates.lat, location.coordinates.lng
    );
    
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestLocation = location;
    }
  }
  
  return nearestLocation;
};

// Calculate distance from a point to a path segment
const calculateDistanceToPath = (
  lat: number, 
  lng: number, 
  startPoint: RoutePoint, 
  endPoint: RoutePoint
): number => {
  // Convert to Cartesian coordinates for simplicity
  const x = lng;
  const y = lat;
  const x1 = startPoint.coordinates.lng;
  const y1 = startPoint.coordinates.lat;
  const x2 = endPoint.coordinates.lng;
  const y2 = endPoint.coordinates.lat;
  
  // Calculate the line segment length squared
  const dx = x2 - x1;
  const dy = y2 - y1;
  const segmentLengthSq = dx * dx + dy * dy;
  
  // If segment is a point, just return distance to that point
  if (segmentLengthSq === 0) {
    return calculateDistanceToPoint(lat, lng, y1, x1);
  }
  
  // Calculate projection of point onto line segment
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / segmentLengthSq));
  
  // Calculate closest point on line segment
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  
  // Return distance to closest point
  return calculateDistanceToPoint(lat, lng, projY, projX);
}; 