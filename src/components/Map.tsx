import { useEffect, useRef, useState, forwardRef } from "react";
import { Route, Location } from "@/types";
import { loadGoogleMapsApi, decodePolyline } from "@/services/mapsService";
import { cn } from "@/lib/utils";

// Add simplified type declarations - remove the previous declaration
interface GoogleMapsType {
  maps: any;
}

declare global {
  interface Window {
    google: GoogleMapsType;
  }
}

interface MapProps {
  routes: Route[];
  selectedRouteId?: string;
  onRouteSelect?: (routeId: string) => void;
  className?: string;
  currentLocation?: Location | null;
}

const Map = forwardRef<HTMLDivElement, MapProps>(({
  routes,
  selectedRouteId,
  onRouteSelect,
  className,
  currentLocation = null
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [googleMap, setGoogleMap] = useState<any>(null);
  const routePolylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const currentLocationMarkerRef = useRef<any>(null);

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

    try {
      // Create map centered on Mumbai (default location)
      const map = new window.google.maps.Map(mapRef.current, {
        center: { lat: 19.0760, lng: 72.8777 }, // Mumbai coordinates
        zoom: 13,
        mapTypeControl: true,
        fullscreenControl: true,
        streetViewControl: true,
        zoomControl: true,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        controlSize: 24,
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
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
    }
  }, [mapLoaded]);

  // Update routes on the map
  useEffect(() => {
    if (!googleMap || !window.google) return;

    try {
      // Clear existing route polylines
      routePolylinesRef.current.forEach(polyline => polyline.setMap(null));
      routePolylinesRef.current = [];
      
      // Clear existing markers
      markersRef.current.forEach(marker => marker.setMap(null));
      markersRef.current = [];

      if (routes.length > 0) {
        // Create bounds to contain all routes
        const bounds = new window.google.maps.LatLngBounds();

        // Create polylines for each route
        routes.forEach((route, index) => {
          // Decode polyline if needed
          const points = route.points.map(point => point.coordinates);
          
          // Create a polyline for the route
          const isSelected = route.id === selectedRouteId;
          
          const polyline = new window.google.maps.Polyline({
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
        const { source, destination } = routes[0]; // All routes have the same source/destination
        
        // Source marker
        const sourceMarker = new window.google.maps.Marker({
          position: source.coordinates,
          map: googleMap,
          title: "Starting Point",
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#22c55e", // Green
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 8
          }
        });
        markersRef.current.push(sourceMarker);
        
        // Destination marker
        const destinationMarker = new window.google.maps.Marker({
          position: destination.coordinates,
          map: googleMap,
          title: "Destination",
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
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
      } else if (currentLocation) {
        // If we don't have routes but do have current location, center on that
        googleMap.setCenter(currentLocation.coordinates);
        googleMap.setZoom(15);
      }
    } catch (error) {
      console.error("Error updating routes on map:", error);
    }
  }, [googleMap, routes, selectedRouteId, onRouteSelect]);

  // Update current location marker when it changes
  useEffect(() => {
    if (!googleMap || !window.google) return;
    
    try {
      // Clear existing current location marker
      if (currentLocationMarkerRef.current) {
        currentLocationMarkerRef.current.setMap(null);
        currentLocationMarkerRef.current = null;
      }
      
      // If we have a current location, add a marker for it
      if (currentLocation) {
        const marker = new window.google.maps.Marker({
          position: currentLocation.coordinates,
          map: googleMap,
          title: "Your Location",
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#22c55e", // Purple
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 8
          }
        });
        
        // Add a pulsating circle around the current location
        const circle = new window.google.maps.Circle({
          strokeColor: "#22c55e",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#22c55e",
          fillOpacity: 0.2,
          map: googleMap,
          center: currentLocation.coordinates,
          radius: 50, // 50 meters
          animation: window.google.maps.Animation.DROP
        });
        
        currentLocationMarkerRef.current = marker;
        
        // If no routes are showing yet, center map on current location
        if (routes.length === 0) {
          googleMap.setCenter(currentLocation.coordinates);
          googleMap.setZoom(15);
        }
      }
    } catch (error) {
      console.error("Error updating current location marker:", error);
    }
  }, [googleMap, currentLocation, routes.length]);

  // Update selected route when it changes
  useEffect(() => {
    if (!googleMap || !routes.length) return;
    
    try {
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
    } catch (error) {
      console.error("Error updating selected route:", error);
    }
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
    <div className={cn("relative h-full w-full", className)}>
      {!mapLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted z-10">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
        </div>
      )}
      <div 
        ref={(node) => {
          // Handle both the forwarded ref and the internal ref
          if (node) {
            mapRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLDivElement>).current = node;
            }
          }
        }}
        className="h-full w-full"
      />
    </div>
  );
});

Map.displayName = "Map";

export default Map;

