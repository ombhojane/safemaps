
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
