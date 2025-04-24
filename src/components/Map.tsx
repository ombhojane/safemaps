import { useEffect, useRef, useState, forwardRef } from "react";
import { Route, Location, StreetViewLocation } from "@/types";
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
  selectedStreetViewLocation?: StreetViewLocation | null;
}

const Map = forwardRef<HTMLDivElement, MapProps>(({
  routes,
  selectedRouteId,
  onRouteSelect,
  className,
  currentLocation = null,
  selectedStreetViewLocation = null
}, ref) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [googleMap, setGoogleMap] = useState<any>(null);
  const routePolylinesRef = useRef<any[]>([]);
  const markersRef = useRef<any[]>([]);
  const currentLocationMarkerRef = useRef<any>(null);
  const streetViewMarkerRef = useRef<any>(null);
  const streetViewInfoWindowRef = useRef<any>(null);

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

  // Add a new effect to handle the selected street view location
  useEffect(() => {
    if (!googleMap || !window.google) return;
    
    try {
      console.log("Street view location effect triggered:", selectedStreetViewLocation);
      
      // Clear existing street view marker and info window
      if (streetViewMarkerRef.current) {
        streetViewMarkerRef.current.setMap(null);
        streetViewMarkerRef.current = null;
      }
      
      if (streetViewInfoWindowRef.current) {
        streetViewInfoWindowRef.current.close();
        streetViewInfoWindowRef.current = null;
      }
      
      // If we have a selected street view location, show it on the map
      if (selectedStreetViewLocation) {
        console.log("Showing street view location on map:", selectedStreetViewLocation);
        
        // Create a distinctive, larger custom SVG marker
        const svgMarker = {
          path: "M 0,0 C -2,-20 -10,-22 -10,-30 A 10,10 0 1,1 10,-30 C 10,-22 2,-20 0,0 z",
          fillColor: '#7e22ce',
          fillOpacity: 1,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 1.5,
          labelOrigin: new window.google.maps.Point(0, -30)
        };
        
        // Explicitly set center and zoom
        googleMap.setCenter(selectedStreetViewLocation.coordinates);
        googleMap.setZoom(19); // Zoom in very close for better visibility
        
        // Create a marker at the street view location
        const marker = new window.google.maps.Marker({
          position: selectedStreetViewLocation.coordinates,
          map: googleMap,
          animation: window.google.maps.Animation.BOUNCE,
          icon: svgMarker,
          label: {
            text: `${selectedStreetViewLocation.index + 1}`,
            color: 'white',
            fontSize: '14px',
            fontWeight: 'bold'
          },
          zIndex: 1000
        });
        
        // Create an info window with the street name
        const infoContent = document.createElement('div');
        infoContent.className = 'p-4 max-w-xs';
        infoContent.innerHTML = `
          <div class="font-bold text-base text-purple-700 mb-2">${
            selectedStreetViewLocation.streetName || 'Street View Location'
          }</div>
          <div class="text-sm font-medium">Location #${selectedStreetViewLocation.index + 1}</div>
          <div class="text-xs text-muted-foreground mt-2">
            Heading: ${Math.round(selectedStreetViewLocation.heading)}°<br>
            Coordinates: ${selectedStreetViewLocation.coordinates.lat.toFixed(5)}, 
            ${selectedStreetViewLocation.coordinates.lng.toFixed(5)}
          </div>
        `;
        
        const infoWindow = new window.google.maps.InfoWindow({
          content: infoContent,
          pixelOffset: new window.google.maps.Size(0, -15)
        });
        
        // Open the info window immediately
        infoWindow.open(googleMap, marker);
        
        // Add directional indicator (arrow showing view direction)
        const headingRadians = selectedStreetViewLocation.heading * Math.PI / 180;
        const arrowLength = 40; // meters
        const endLat = selectedStreetViewLocation.coordinates.lat + 
                       Math.cos(headingRadians) * arrowLength * 0.000009;
        const endLng = selectedStreetViewLocation.coordinates.lng + 
                       Math.sin(headingRadians) * arrowLength * 0.000009 / 
                       Math.cos(selectedStreetViewLocation.coordinates.lat * Math.PI / 180);
        
        const viewLine = new window.google.maps.Polyline({
          path: [
            selectedStreetViewLocation.coordinates,
            { lat: endLat, lng: endLng }
          ],
          geodesic: true,
          strokeColor: '#7e22ce',
          strokeOpacity: 1.0,
          strokeWeight: 4,
          icons: [{
            icon: { path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
            offset: '100%',
            repeat: '0px'
          }],
          map: googleMap,
          zIndex: 900
        });
        
        // Add highlighted area around marker
        const circle = new window.google.maps.Circle({
          strokeColor: "#7e22ce",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#7e22ce",
          fillOpacity: 0.2,
          map: googleMap,
          center: selectedStreetViewLocation.coordinates,
          radius: 25,
          zIndex: 800
        });
        
        // Store references for cleanup
        streetViewMarkerRef.current = marker;
        streetViewInfoWindowRef.current = infoWindow;
        
        // Stop bounce after 3 seconds but keep marker
        setTimeout(() => {
          if (streetViewMarkerRef.current) {
            streetViewMarkerRef.current.setAnimation(null);
          }
        }, 3000);
      }
    } catch (error) {
      console.error("Error updating street view marker:", error);
    }
  }, [googleMap, selectedStreetViewLocation]);

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

