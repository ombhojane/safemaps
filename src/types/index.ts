import { TravelMode } from '@/services/mapsService';

export interface Location {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  city?: string;
}

export interface RoutePoint {
  coordinates: {
    lat: number;
    lng: number;
  };
  riskScore?: number;
  riskReason?: string;
  // Added visualization properties
  position?: {
    x: string;
    y: string;
  };
}

export interface Route {
  id: string;
  source: Location;
  destination: Location;
  points: RoutePoint[];
  riskScore: number;
  distance: string;
  duration: string;
  riskAreas: RiskArea[];
  // Add path property for visualization
  path?: string;
  // Add street view images with their locations
  streetViewImages?: string[];
  streetViewLocations?: StreetViewLocation[];
  // Add travel mode and transit details
  travelMode?: TravelMode;
  transitDetails?: TransitStep[];
  // Add Gemini analysis results
  geminiAnalysis?: {
    riskScores: number[];
    averageRiskScore: number;
    isAnalyzing: boolean;
    explanations?: string[];
    precautions?: string[];
    error?: string;
  };
  // Add weather information
  weather?: {
    condition: string;
    temperature: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
  };
  // Add navigation-specific properties
  trafficCondition?: 'light' | 'moderate' | 'heavy';
  tollsOnRoute?: boolean;
  alternateRouteAvailable?: boolean;
  expectedArrivalTime?: Date;
  // Add step polylines for visualizing different segments (walking vs. transit)
  stepPolylines?: StepPolyline[];
  // Google Maps API response properties - required for API compatibility
  distanceMeters: number;
  polyline: {
    encodedPolyline: string;
  };
  legs: {
    steps: {
      polyline: {
        encodedPolyline: string;
      };
      distanceMeters: number;
      staticDuration?: string;
      travelMode?: string;
      transitDetails?: TransitStep;
    }[];
    startLocation?: {
      latLng: {
        latitude: number;
        longitude: number;
      };
    };
    endLocation?: {
      latLng: {
        latitude: number;
        longitude: number;
      };
    };
  }[];
  routeLabels?: string[];
}

export interface RiskArea {
  id: string;
  location: {
    lat: number;
    lng: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
  emergencyContacts?: EmergencyContact[];
}

export interface EmergencyContact {
  id: string;
  name: string;
  type: 'hospital' | 'police' | 'fire' | 'roadside';
  phoneNumber: string;
  address: string;
  distance: string;
}

export type RiskLevel = 'low' | 'medium' | 'high';

export interface RouteAnalysis {
  route: Route;
  overallRiskScore: number;
  riskAreas: RiskArea[];
  recommendation: string;
  riskScores: number[];
  explanations?: string[];
  precautions?: string[];
  images?: string[];
  locations?: StreetViewLocation[];
}

// Map visualization types
export interface RoadPath {
  id: string;
  path: string;
  width: number;
}

export interface Building {
  id: string;
  x: string;
  y: string;
  width: string;
  height: string;
  opacity: number;
}

// Add Google Maps related window type augmentation
declare global {
  interface Window {
    google: {
      maps: any;
    };
  }
}

// Add a type for street view locations with additional metadata
export interface StreetViewLocation {
  coordinates: {
    lat: number;
    lng: number;
  };
  heading: number;
  index: number;
  streetName?: string;
  formattedAddress?: string;
  accidentContext?: string;
  // Add accident hotspot data
  accidentHotspot?: {
    hasAccidentHistory: boolean;
    accidentFrequency: 'low' | 'moderate' | 'high' | 'very_high' | 'unknown';
    accidentSeverity: 'minor' | 'moderate' | 'severe' | 'fatal' | 'unknown';
    analysisText: string;
    riskFactors: string[];
    suggestedPrecautions: string[];
  };
}

// New interface for step polylines
export interface StepPolyline {
  points: { lat: number; lng: number }[];
  travelMode: string;
  distanceMeters: number;
  duration: string;
}

// Transit details interface
export interface TransitStep {
  type: string;
  mode?: string;
  line?: string;
  headsign?: string;
  departureStop?: string;
  arrivalStop?: string;
  departureTime?: string;
  arrivalTime?: string;
  numStops?: number;
  agency?: string;
  color?: string;
  textColor?: string;
  vehicle?: string;
  iconUri?: string;
  duration?: string;
  durationText?: string;
  distance?: string;
  polyline?: string;
  // Simplified coordinates for visualization
  departureCoordinates?: {
    lat: number;
    lng: number;
  };
  arrivalCoordinates?: {
    lat: number;
    lng: number;
  };
  transitDetails?: {
    stopDetails: {
      arrivalStop: {
        name: string;
        location?: {
          latLng: {
            latitude: number;
            longitude: number;
          }
        }
      };
      departureStop: {
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
}
