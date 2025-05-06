import { Location } from "@/types";
import { TransitStep } from "./transit.types";

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

export interface RoutePoint {
  coordinates: {
    lat: number;
    lng: number;
  };
  riskScore?: number;
  position: {
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
  riskAreas: any[];
  path: string;
  streetViewImages: string[];
  streetViewLocations: any[];
  travelMode: TravelMode;
  transitDetails?: TransitStep[];
  geminiAnalysis: {
    riskScores: number[];
    averageRiskScore: number;
    isAnalyzing: boolean;
    explanations?: string[];
    precautions?: string[];
    error?: string;
  };
  weather?: {
    condition: string;
    temperature: number;
    description: string;
    icon: string;
    humidity: number;
    windSpeed: number;
  };
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
      staticDuration: string;
      travelMode?: string;
      transitDetails?: TransitStep;
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
  stepPolylines?: {
    points: { lat: number; lng: number; }[];
    travelMode: string;
    distanceMeters: number;
    duration: string;
  }[];
}

export interface ComputeRoutesResponse {
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