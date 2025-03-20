
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
}

export interface RiskArea {
  id: string;
  location: {
    lat: number;
    lng: number;
  };
  riskLevel: 'low' | 'medium' | 'high';
  description: string;
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

