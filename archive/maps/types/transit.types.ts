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
  duration: string;
  durationText: string;
  distance: string;
  polyline?: string;
  departureCoordinates?: {
    lat: number;
    lng: number;
  };
  arrivalCoordinates?: {
    lat: number;
    lng: number;
  };
} 