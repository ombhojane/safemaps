import { useEffect, useRef, useState, forwardRef } from "react";
import { Route, Location, StreetViewLocation } from "@/types";
import { loadGoogleMapsApi, decodePolyline, TravelMode } from "@/services/mapsService";
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
  isNavigationMode?: boolean;
}

const Map = forwardRef<HTMLDivElement, MapProps>(({
  routes,
  selectedRouteId,
  onRouteSelect,
  className,
  currentLocation = null,
  selectedStreetViewLocation = null,
  isNavigationMode = false
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

  // Update the useEffect that creates the map
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    try {
      // Create map centered on Mumbai (default location)
      const mapOptions: any = {
        center: { lat: 19.0760, lng: 72.8777 }, // Mumbai coordinates
        zoom: 13,
        mapTypeControl: !isNavigationMode,
        fullscreenControl: !isNavigationMode,
        streetViewControl: !isNavigationMode,
        zoomControl: true,
        mapTypeId: window.google.maps.MapTypeId.ROADMAP,
        controlSize: 24,
        styles: [
          {
            "featureType": "poi",
            "stylers": [{ "visibility": isNavigationMode ? "off" : "simplified" }]
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
      };
      
      // In navigation mode, add custom UI settings
      if (isNavigationMode) {
        mapOptions.disableDefaultUI = true;
        mapOptions.zoomControl = true;
        mapOptions.zoomControlOptions = {
          position: window.google.maps.ControlPosition.RIGHT_CENTER
        };
      }

      const map = new window.google.maps.Map(mapRef.current, mapOptions);

      // Apply navigation mode styles if in navigation mode
      if (isNavigationMode) {
        setNavigationMode(map);
      }
      
      // Handle current location with animated marker if available
      if (currentLocation) {
        const currentPos = new window.google.maps.LatLng(
          currentLocation.coordinates.lat,
          currentLocation.coordinates.lng
        );
        createCurrentLocationMarker(map, currentPos);
      }

      setGoogleMap(map);
    } catch (error) {
      console.error("Error initializing Google Maps:", error);
    }
  }, [mapLoaded, isNavigationMode, currentLocation]);

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

        // Find selected route
        const selectedRoute = routes.find(r => r.id === selectedRouteId) || routes[0];

        // Create polylines for each route
        routes.forEach((route, index) => {
          const isSelected = route.id === selectedRouteId;
          
          // If this route is selected and has step polylines, draw detailed segments
          if (isSelected && route.stepPolylines && route.stepPolylines.length > 0 && route.travelMode === TravelMode.TRANSIT) {
            // Draw each segment with appropriate styling based on travel mode
            route.stepPolylines.forEach(step => {
              const isWalking = step.travelMode === 'WALKING';
              
              // Create custom styling based on travel mode
              const polyline = new window.google.maps.Polyline({
                path: step.points,
                geodesic: true,
                strokeColor: isWalking ? '#4A87D5' : getRiskColor(route.riskScore, isSelected),
                strokeOpacity: isSelected ? 1.0 : 0.7,
                strokeWeight: isSelected ? 4 : 3,
                map: googleMap,
                zIndex: isSelected ? 10 : index,
                // Use dotted line for walking segments
                icons: isWalking ? [{
                  icon: {
                    path: 'M 0,-0.1 0,0.1',
                    strokeOpacity: 1,
                    scale: 3
                  },
                  offset: '0',
                  repeat: '10px'
                }] : null
              });
              
              // Store the polyline for later cleanup
              routePolylinesRef.current.push(polyline);
              
              // Extend bounds to include this segment
              step.points.forEach(point => {
                bounds.extend(point);
              });
              
              // If this is a transit step with departure/arrival points, add station markers
              if (step.travelMode === 'TRANSIT') {
                const transitDetails = route.transitDetails?.find(t => t.polyline === step.points.map(p => `${p.lat},${p.lng}`).join(';'));
                
                if (transitDetails?.departureCoordinates) {
                  const stationMarker = new window.google.maps.Marker({
                    position: transitDetails.departureCoordinates,
                    map: googleMap,
                    title: transitDetails.departureStop || "Transit Stop",
                    icon: {
                      path: window.google.maps.SymbolPath.CIRCLE,
                      fillColor: transitDetails.color || "#3b82f6",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 1,
                      scale: 4
                    }
                  });
                  markersRef.current.push(stationMarker);
                }
                
                if (transitDetails?.arrivalCoordinates) {
                  const stationMarker = new window.google.maps.Marker({
                    position: transitDetails.arrivalCoordinates,
                    map: googleMap,
                    title: transitDetails.arrivalStop || "Transit Stop",
                    icon: {
                      path: window.google.maps.SymbolPath.CIRCLE,
                      fillColor: transitDetails.color || "#3b82f6",
                      fillOpacity: 1,
                      strokeColor: "#ffffff",
                      strokeWeight: 1,
                      scale: 4
                    }
                  });
                  markersRef.current.push(stationMarker);
                }
              }
            });
          } 
          // For walking routes, use dotted lines
          else if (isSelected && route.travelMode === TravelMode.WALK) {
            // Decode polyline if needed
            const points = route.points.map(point => point.coordinates);
            
            // Create a dotted polyline for walking routes
            const polyline = new window.google.maps.Polyline({
              path: points,
              geodesic: true,
              strokeColor: getRiskColor(route.riskScore, isSelected),
              strokeOpacity: isSelected ? 1.0 : 0.7,
              strokeWeight: isSelected ? 4 : 3,
              map: googleMap,
              zIndex: isSelected ? 10 : index,
              icons: [{
                icon: {
                  path: 'M 0,-0.1 0,0.1',
                  strokeOpacity: 1,
                  scale: 3
                },
                offset: '0',
                repeat: '10px'
              }]
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
          } 
          // For non-selected routes or routes without step polylines, draw as usual
          else {
          // Decode polyline if needed
          const points = route.points.map(point => point.coordinates);
          
          // Create a polyline for the route
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
          }
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
        const markerOptions: any = {
          position: currentLocation.coordinates,
          map: googleMap,
          title: "Your Location",
          animation: window.google.maps.Animation.DROP,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            fillColor: "#22c55e", // Green
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 8
          }
        };
        
        // Use a different marker style in navigation mode
        if (isNavigationMode) {
          markerOptions.icon = {
            path: window.google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
            fillColor: "#3b82f6", // Blue
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            scale: 8,
            rotation: 0 // Will be updated with heading
          };
          
          // If we have direction, update the arrow rotation
          if (window.navigator.geolocation) {
            try {
              window.navigator.geolocation.getCurrentPosition(
                (position) => {
                  if (position.coords.heading !== null && !isNaN(position.coords.heading)) {
                    markerOptions.icon.rotation = position.coords.heading;
                  }
                },
                null,
                { enableHighAccuracy: true }
              );
            } catch (error) {
              console.error("Error getting device heading:", error);
            }
          }
        }
        
        const marker = new window.google.maps.Marker(markerOptions);
        
        // Add a pulsating circle around the current location
        const circle = new window.google.maps.Circle({
          strokeColor: "#22c55e",
          strokeOpacity: 0.8,
          strokeWeight: 2,
          fillColor: "#22c55e",
          fillOpacity: 0.2,
          map: googleMap,
          center: currentLocation.coordinates,
          radius: isNavigationMode ? 30 : 50, // Smaller radius in navigation mode
          animation: window.google.maps.Animation.DROP
        });
        
        currentLocationMarkerRef.current = marker;
        
        // If in navigation mode or no routes are showing, center map on current location
        if (isNavigationMode || routes.length === 0) {
          googleMap.setCenter(currentLocation.coordinates);
          googleMap.setZoom(isNavigationMode ? 17 : 15); // Higher zoom level in navigation mode
          
          // In navigation mode, also set up auto-follow
          if (isNavigationMode) {
            // Make map follow current location
            // We already set the center above, but for continued tracking,
            // we would need to subscribe to location updates, which is handled
            // in the NavigationView component
          }
        }
      }
    } catch (error) {
      console.error("Error updating current location marker:", error);
    }
  }, [googleMap, currentLocation, routes.length, isNavigationMode]);

  // Update selected route when it changes
  useEffect(() => {
    if (!googleMap || !routes.length) return;
    
    try {
      // Update polyline styles based on selection
      routePolylinesRef.current.forEach((polyline, index) => {
        if (index < routes.length) {
        const route = routes[index];
          const isSelected = route && route.id === selectedRouteId;
        
        polyline.setOptions({
            strokeColor: getRiskColor(route ? route.riskScore : 0, isSelected),
          strokeOpacity: isSelected ? 1.0 : 0.7,
          strokeWeight: isSelected ? 5 : 3,
          zIndex: isSelected ? 10 : index
        });
        }
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

  // Set map to navigation mode
  const setNavigationMode = (map: google.maps.Map) => {
    if (isNavigationMode) {
      map.setOptions({
        zoomControl: false,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        rotateControl: false,
        scrollwheel: false,
        gestureHandling: "greedy",
        maxZoom: 21,
        mapId: "navigation_map",
        styles: [
          {
            featureType: "poi",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "transit",
            elementType: "labels",
            stylers: [{ visibility: "off" }]
          },
          {
            featureType: "road",
            elementType: "geometry",
            stylers: [{ weight: 1.5 }]
          },
          {
            featureType: "road.arterial",
            elementType: "geometry",
            stylers: [{ weight: 2 }]
          },
          {
            featureType: "road.highway",
            elementType: "geometry",
            stylers: [{ weight: 3 }]
          },
          {
            featureType: "road.local",
            elementType: "labels",
            stylers: [{ visibility: "simplified" }]
          }
        ]
      });
    }
  };

  // Create marker for current location
  const createCurrentLocationMarker = (map: google.maps.Map, position: google.maps.LatLng) => {
    // Remove existing marker if it exists
    if (currentLocationMarkerRef.current) {
      currentLocationMarkerRef.current.setMap(null);
    }

    if (isNavigationMode) {
      // Create pulsing dot for navigation mode
      const pulsingDot = {
        url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
          <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="10" fill="#4285F4" fill-opacity="0.2">
              <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values="0.5;0.2;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
            <circle cx="12" cy="12" r="6" fill="#4285F4" stroke="white" stroke-width="2" />
          </svg>
        `),
        size: new google.maps.Size(24, 24),
        anchor: new google.maps.Point(12, 12),
        scaledSize: new google.maps.Size(24, 24),
      };

      currentLocationMarkerRef.current = new google.maps.Marker({
        position,
        map,
        icon: pulsingDot,
        zIndex: 999,
      });
    } else {
      // Default marker for non-navigation mode
      currentLocationMarkerRef.current = new google.maps.Marker({
        position,
        map,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: "#4285F4",
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
        zIndex: 999,
      });
    }
  };

  // Draw routes
  const drawRoutes = (map: google.maps.Map) => {
    // Clear existing route polylines
    clearRoutePolylines();

    if (!routes?.length) return;

    // Add route polylines
    routes.forEach((route) => {
      if (!route.encodedPolyline) return;

      // Get path from encoded polyline
      const path = google.maps.geometry.encoding.decodePath(route.encodedPolyline);

      // Create polyline for the route
      const isSelected = route.id === selectedRouteId;
      const isNavigationModeAndSelected = isNavigationMode && isSelected;

      const routePolyline = new google.maps.Polyline({
        path,
        strokeColor: isNavigationModeAndSelected 
          ? "#1DB954" // Green color for selected route in navigation mode
          : isSelected 
            ? "#1976D2" // Blue color for selected route
            : "#757575", // Gray for unselected routes
        strokeOpacity: isNavigationModeAndSelected ? 1.0 : isSelected ? 0.9 : 0.7,
        strokeWeight: isNavigationModeAndSelected ? 6 : isSelected ? 5 : 3,
        map,
        zIndex: isSelected ? 2 : 1,
      });

      // If in navigation mode and this is selected route, add animated arrow polyline
      if (isNavigationModeAndSelected) {
        // Add animated arrow icons along the route
        const arrowSymbol = {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          fillColor: "#FFFFFF",
          fillOpacity: 1,
          scale: 3,
          strokeColor: "#1DB954",
          strokeWeight: 1,
        };

        const arrowPolyline = new google.maps.Polyline({
          path,
          icons: [{
            icon: arrowSymbol,
            offset: "0%",
            repeat: "10%"
          }],
          strokeColor: "#1DB954",
          strokeOpacity: 0,
          map,
          zIndex: 3,
        });

        // Animate the arrow
        let offset = 0;
        setInterval(() => {
          offset = (offset + 1) % 100;
          const icons = arrowPolyline.get("icons");
          icons[0].offset = offset + "%";
          arrowPolyline.set("icons", icons);
        }, 100);

        // Store for later cleanup
        routePolylinesRef.current.push(arrowPolyline);
      }

      // Create pulse effect on the selected route if in navigation mode
      if (isNavigationModeAndSelected) {
        const pulsePolyline = new google.maps.Polyline({
          path,
          strokeColor: "#1DB954",
          strokeOpacity: 0.4,
          strokeWeight: 9,
          map,
          zIndex: 1,
        });

        // Animate the pulse effect
        let opacity = 0.4;
        let increasing = false;
        setInterval(() => {
          if (increasing) {
            opacity += 0.01;
            if (opacity >= 0.4) {
              increasing = false;
            }
          } else {
            opacity -= 0.01;
            if (opacity <= 0.2) {
              increasing = true;
            }
          }
          pulsePolyline.setOptions({ strokeOpacity: opacity });
        }, 50);

        // Store for later cleanup
        routePolylinesRef.current.push(pulsePolyline);
      }

      // Store for later cleanup
      routePolylinesRef.current.push(routePolyline);

      // Add start and end markers if needed
      if (showMarkers && route.origin && route.destination) {
        const originMarker = new google.maps.Marker({
          position: { lat: route.origin.coordinates.lat, lng: route.origin.coordinates.lng },
          map,
          icon: isNavigationModeAndSelected ? {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="12" fill="#1DB954" />
                <circle cx="12" cy="12" r="8" fill="white" />
                <circle cx="12" cy="12" r="4" fill="#1DB954" />
              </svg>
            `),
            size: new google.maps.Size(24, 24),
            anchor: new google.maps.Point(12, 12),
          } : originMarkerIcon,
          title: route.origin.name,
          zIndex: 999,
        });

        const destinationMarker = new google.maps.Marker({
          position: { lat: route.destination.coordinates.lat, lng: route.destination.coordinates.lng },
          map,
          icon: isNavigationModeAndSelected ? {
            url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(`
              <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                <path d="M24 4c-7.73 0-14 6.27-14 14 0 10.5 14 26 14 26s14-15.5 14-26c0-7.73-6.27-14-14-14zm0 19c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z" fill="#1DB954"/>
                <path d="M24 14c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3z" fill="white"/>
              </svg>
            `),
            size: new google.maps.Size(48, 48),
            anchor: new google.maps.Point(24, 40),
          } : destinationMarkerIcon,
          title: route.destination.name,
          zIndex: 998,
        });

        routeMarkersRef.current.push(originMarker, destinationMarker);
      }
    });
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

