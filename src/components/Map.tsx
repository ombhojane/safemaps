import { useEffect, useRef, useState } from "react";
import { Route, Location } from "@/types";
import { loadGoogleMapsApi, decodePolyline } from "@/services/mapsService";
import { cn } from "@/lib/utils";

interface MapProps {
  routes: Route[];
  selectedRouteId?: string;
  onRouteSelect?: (routeId: string) => void;
  className?: string;
}

const Map = ({
  routes,
  selectedRouteId,
  onRouteSelect,
  className,
}: MapProps) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [googleMap, setGoogleMap] = useState<google.maps.Map | null>(null);
  const routePolylinesRef = useRef<google.maps.Polyline[]>([]);
  const markersRef = useRef<google.maps.Marker[]>([]);

  // Load Google Maps API
  useEffect(() => {
    const loadMap = async () => {
      try {
        await loadGoogleMapsApi();
        setMapLoaded(true);
      } catch (error) {
        console.error("Failed to load Google Maps API", error);
      }
    };

    loadMap();
  }, []);

  // Initialize map once API is loaded
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    // Create map centered on San Francisco (default location)
    const map = new google.maps.Map(mapRef.current, {
      center: { lat: 37.7749, lng: -122.4194 },
      zoom: 13,
      mapTypeControl: true,
      fullscreenControl: true,
      streetViewControl: true,
      styles: [
        {
          "featureType": "poi",
          "stylers": [{ "visibility": "simplified" }]
        },
        {
          "featureType": "road",
          "elementType": "labels.icon",
          "stylers": [{ "visibility": "off" }]
        },
        {
          "featureType": "transit",
          "stylers": [{ "visibility": "off" }]
        }
      ]
    });

    setGoogleMap(map);
  }, [mapLoaded]);

  // Update routes on the map
  useEffect(() => {
    if (!googleMap || !routes.length) return;

    // Clear existing route polylines
    routePolylinesRef.current.forEach(polyline => polyline.setMap(null));
    routePolylinesRef.current = [];
    
    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Create bounds to contain all routes
    const bounds = new google.maps.LatLngBounds();

    // Create polylines for each route
    routes.forEach((route, index) => {
      // Decode polyline if needed
      const points = route.points.map(point => point.coordinates);
      
      // Create a polyline for the route
      const isSelected = route.id === selectedRouteId;
      
      const polyline = new google.maps.Polyline({
        path: points,
        geodesic: true,
        strokeColor: getRiskColor(route.riskScore, isSelected),
        strokeOpacity: isSelected ? 1.0 : 0.7,
        strokeWeight: isSelected ? 5 : 3,
        map: googleMap,
        zIndex: isSelected ? 10 : index
      });
      
      // Add click handler for route selection
      if (onRouteSelect) {
        polyline.addListener("click", () => {
          onRouteSelect(route.id);
        });
      }
      
      // Store the polyline for later cleanup
      routePolylinesRef.current.push(polyline);
      
      // Extend bounds to include this route
      points.forEach(point => {
        bounds.extend(point);
      });
    });

    // Add markers for source and destination
    if (routes.length > 0) {
      const { source, destination } = routes[0]; // All routes have the same source/destination
      
      // Source marker
      const sourceMarker = new google.maps.Marker({
        position: source.coordinates,
        map: googleMap,
        title: "Starting Point",
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#22c55e", // Green
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 8
        }
      });
      markersRef.current.push(sourceMarker);
      
      // Destination marker
      const destinationMarker = new google.maps.Marker({
        position: destination.coordinates,
        map: googleMap,
        title: "Destination",
        animation: google.maps.Animation.DROP,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: "#3b82f6", // Blue
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
          scale: 8
        }
      });
      markersRef.current.push(destinationMarker);
      
      // Fit map to bounds
      googleMap.fitBounds(bounds, 50); // 50px padding
    }
  }, [googleMap, routes, selectedRouteId, onRouteSelect]);

  // Update selected route when it changes
  useEffect(() => {
    if (!googleMap || !routes.length) return;
    
    // Update polyline styles based on selection
    routePolylinesRef.current.forEach((polyline, index) => {
      const route = routes[index];
      const isSelected = route.id === selectedRouteId;
      
      polyline.setOptions({
        strokeColor: getRiskColor(route.riskScore, isSelected),
        strokeOpacity: isSelected ? 1.0 : 0.7,
        strokeWeight: isSelected ? 5 : 3,
        zIndex: isSelected ? 10 : index
      });
    });
  }, [googleMap, routes, selectedRouteId]);

  // Helper function to get color based on risk score
  const getRiskColor = (riskScore: number, isSelected: boolean): string => {
    // Risk score categories:
    // 0-3.3: Low risk (green)
    // 3.4-6.6: Medium risk (yellow)
    // 6.7-10: High risk (red)
    
    if (riskScore <= 3.3) {
      return isSelected ? "#16a34a" : "#22c55e"; // Green
    } else if (riskScore <= 6.6) {
      return isSelected ? "#ca8a04" : "#eab308"; // Yellow
    } else {
      return isSelected ? "#dc2626" : "#ef4444"; // Red
    }
  };

  return (
    <div className={cn("h-[400px] w-full rounded-lg overflow-hidden", className)}>
      {!mapLoaded && (
        <div className="h-full w-full flex items-center justify-center bg-muted">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}
      <div 
        ref={mapRef} 
        className={cn(
          "h-full w-full", 
          !mapLoaded && "opacity-0"
        )} 
      />
      
      {/* Add Google attribution if required by Google Maps Platform policy */}
      <div className="text-xs text-muted-foreground mt-1 text-right">
        Map data ©{new Date().getFullYear()} Google
      </div>
    </div>
  );
};

export default Map;

