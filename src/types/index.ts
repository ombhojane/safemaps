export interface Location {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
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
  // Add Gemini analysis results
  geminiAnalysis?: {
    riskScores: number[];
    averageRiskScore: number;
    isAnalyzing: boolean;
    explanations?: string[];
    precautions?: string[];
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
}
