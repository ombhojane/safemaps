import { useState, useRef, useEffect, useMemo } from "react";
import Map from "@/components/Map";
import RouteForm from "@/components/RouteForm";
import RouteDisplay from '@/components/RouteDisplay';
import StreetViewGallery from "@/components/StreetViewGallery";
import { Location, Route, StreetViewLocation } from "@/types";
import { 
  computeRoutes, 
  generateNavigationUrl, 
  ROUTE_ANALYSIS_COMPLETE_EVENT,
  TravelMode 
} from "@/services/mapsService";
import TravelModeTabs from "@/components/TravelModeTabs";
import TravelModeSelector from "@/components/TravelModeSelector";
import { MapPinned, AlertTriangle, MapPin, Image as ImageIcon, BarChart, Navigation, AlertCircle, Lightbulb, Menu, X, ChevronUp, ChevronDown, Twitter, Loader2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import NavigationView from "@/components/NavigationView";
import NavigationPreview from "@/components/NavigationPreview";

const Index = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [bottomSheetState, setBottomSheetState] = useState<'peek' | 'half' | 'full'>('peek');
  const bottomSheetRef = useRef<HTMLDivElement>(null);
  const startDragPositionRef = useRef<number>(0);
  const sheetHeightRef = useRef<number>(0);
  const [showInputs, setShowInputs] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);
  const [selectedStreetViewLocation, setSelectedStreetViewLocation] = useState<StreetViewLocation | null>(null);
  const [viewedLocationIndex, setViewedLocationIndex] = useState<number | undefined>(undefined);
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigatingRoute, setNavigatingRoute] = useState<Route | null>(null);
  
  // Add travel mode state
  const [selectedTravelMode, setSelectedTravelMode] = useState<TravelMode>(TravelMode.DRIVE);
  const [routesByMode, setRoutesByMode] = useState<Partial<Record<TravelMode, Route[]>>>({
    [TravelMode.DRIVE]: [],
    [TravelMode.TRANSIT]: [],
    [TravelMode.WALK]: [],
    [TravelMode.BICYCLE]: [],
    [TravelMode.TWO_WHEELER]: []
  });
  
  // Store source and destination for reuse when changing travel modes
  const [currentSource, setCurrentSource] = useState<Location | null>(null);
  const [currentDestination, setCurrentDestination] = useState<Location | null>(null);

  const handleRouteSubmit = async (source: Location, destination: Location) => {
    setIsLoading(true);
    setError(null);
    setRoutes([]);
    setSelectedRouteId(undefined);
    
    // Store current source and destination for reuse
    setCurrentSource(source);
    setCurrentDestination(destination);
    
    try {
      // Fetch routes using the Routes API via our mapsService with the selected travel mode
      const fetchedRoutes = await computeRoutes(source, destination, selectedTravelMode);
      setRoutes(fetchedRoutes);
      
      // Store routes by travel mode
      setRoutesByMode(prev => ({
        ...prev,
        [selectedTravelMode]: fetchedRoutes
      }));
      
      // Auto-select the safest route (lowest risk score)
      if (fetchedRoutes.length > 0) {
        const safestRoute = [...fetchedRoutes].sort((a, b) => a.riskScore - b.riskScore)[0];
        setSelectedRouteId(safestRoute.id);
      }

      // Open sidebar when routes are found on desktop
      setSidebarOpen(window.innerWidth >= 1024);
      
      // Show bottom sheet when routes are found
      setBottomSheetState('peek');
      
      // Hide inputs on mobile when routes are found
      if (window.innerWidth < 1024) {
        setShowInputs(false);
      }
    } catch (error) {
      console.error("Error fetching routes:", error);
      setError("Failed to fetch routes. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle travel mode change
  const handleTravelModeChange = async (mode: TravelMode) => {
    if (!currentSource || !currentDestination) return;
    
    // Set the selected travel mode
    setSelectedTravelMode(mode);
    
    // Check if we already have routes for this mode
    if (routesByMode[mode].length > 0) {
      setRoutes(routesByMode[mode]);
      
      // Auto-select the safest route for this mode
      if (routesByMode[mode].length > 0) {
        const safestRoute = [...routesByMode[mode]].sort((a, b) => a.riskScore - b.riskScore)[0];
        setSelectedRouteId(safestRoute.id);
      }
      return;
    }
    
    // If not, fetch routes for this mode
    setIsLoading(true);
    setError(null);
    
    try {
      const fetchedRoutes = await computeRoutes(currentSource, currentDestination, mode);
      
      // Update routes
      setRoutes(fetchedRoutes);
      
      // Store routes by travel mode
      setRoutesByMode(prev => ({
        ...prev,
        [mode]: fetchedRoutes
      }));
      
      // Auto-select the safest route
      if (fetchedRoutes.length > 0) {
        const safestRoute = [...fetchedRoutes].sort((a, b) => a.riskScore - b.riskScore)[0];
        setSelectedRouteId(safestRoute.id);
      }
    } catch (error) {
      console.error(`Error fetching routes for ${mode}:`, error);
      setError(`Failed to fetch ${mode} routes. Please try again.`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRouteSelect = (routeId: string) => {
    setSelectedRouteId(routeId);
  };

  // Handle Gemini analysis completion
  const handleAnalysisComplete = (routeId: string, riskScores: number[], averageRiskScore: number, explanations: string[] = [], precautions: string[] = []) => {
    setRoutes(prevRoutes => 
      prevRoutes.map(route => 
        route.id === routeId ? {
          ...route,
          geminiAnalysis: {
            riskScores,
            averageRiskScore,
            explanations,
            precautions,
            isAnalyzing: false
          }
        } : route
      )
    );
    
    // Also update the routes in routesByMode
    setRoutesByMode(prev => {
      const updatedModes = { ...prev };
      Object.keys(updatedModes).forEach(mode => {
        updatedModes[mode as TravelMode] = updatedModes[mode as TravelMode].map(route =>
          route.id === routeId ? {
            ...route,
            geminiAnalysis: {
              riskScores,
              averageRiskScore,
              explanations,
              precautions,
              isAnalyzing: false
            }
          } : route
        );
      });
      return updatedModes;
    });
  };

  // Start the Gemini analysis process
  const startGeminiAnalysis = (routeId: string) => {
    setRoutes(prevRoutes => 
      prevRoutes.map(route => 
        route.id === routeId ? {
          ...route,
          geminiAnalysis: {
            riskScores: [],
            averageRiskScore: 0,
            explanations: [],
            precautions: [],
            isAnalyzing: true
          }
        } : route
      )
    );
  };

  // Handle starting a trip
  const handleStartTrip = (route: Route) => {
    setIsStartingTrip(true);
    
    // Short delay to show loading state
    setTimeout(() => {
      // Instead of opening Google Maps in a new tab, use our custom navigation
      setNavigatingRoute(route);
      setIsNavigating(true);
      setIsStartingTrip(false);
    }, 500);
  };

  // Handle closing the navigation view
  const handleCloseNavigation = () => {
    setIsNavigating(false);
    setNavigatingRoute(null);
  };

  // Get the selected route object
  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  // Create a unique key for the route details that changes when analysis state changes
  const routeDetailsKey = useMemo(() => {
    if (!selectedRoute) return 'no-route';
    const isAnalyzing = selectedRoute.geminiAnalysis?.isAnalyzing ? 'analyzing' : 'not-analyzing';
    const analysisScore = selectedRoute.geminiAnalysis?.averageRiskScore || 0;
    return `route-${selectedRoute.id}-${isAnalyzing}-${analysisScore}`;
  }, [selectedRoute, 
      selectedRoute?.geminiAnalysis?.isAnalyzing, 
      selectedRoute?.geminiAnalysis?.averageRiskScore]);

  // Setup touch event handlers for the bottom sheet
  useEffect(() => {
    const sheet = bottomSheetRef.current;
    if (!sheet) return;

    const handleTouchStart = (e: TouchEvent) => {
      startDragPositionRef.current = e.touches[0].clientY;
      sheetHeightRef.current = sheet.getBoundingClientRect().height;
      sheet.style.transition = 'none';
    };

    const handleTouchMove = (e: TouchEvent) => {
      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startDragPositionRef.current;
      if (deltaY < 0) {
        // Dragging up
        const newHeight = Math.min(sheetHeightRef.current - deltaY, window.innerHeight * 0.9);
        sheet.style.height = `${newHeight}px`;
      } else if (deltaY > 0) {
        // Dragging down
        const newHeight = Math.max(sheetHeightRef.current - deltaY, 140);
        sheet.style.height = `${newHeight}px`;
      }
    };

    const handleTouchEnd = (e: TouchEvent) => {
      sheet.style.transition = 'height 0.3s ease';
      const height = sheet.getBoundingClientRect().height;
      const windowHeight = window.innerHeight;
      
      if (height < windowHeight * 0.25) {
        // Collapsed state
        setBottomSheetState('peek');
        sheet.style.height = '140px';
      } else if (height < windowHeight * 0.65) {
        // Half-expanded state
        setBottomSheetState('half');
        sheet.style.height = `${windowHeight * 0.5}px`;
      } else {
        // Fully expanded state
        setBottomSheetState('full');
        sheet.style.height = `${windowHeight * 0.9}px`;
      }
    };

    sheet.addEventListener('touchstart', handleTouchStart);
    sheet.addEventListener('touchmove', handleTouchMove);
    sheet.addEventListener('touchend', handleTouchEnd);

    return () => {
      sheet.removeEventListener('touchstart', handleTouchStart);
      sheet.removeEventListener('touchmove', handleTouchMove);
      sheet.removeEventListener('touchend', handleTouchEnd);
    };
  }, [bottomSheetRef.current, routes.length]);

  // Update sheet height when state changes
  useEffect(() => {
    const sheet = bottomSheetRef.current;
    if (!sheet) return;
    
    const windowHeight = window.innerHeight;
    let height = '140px';
    
    if (bottomSheetState === 'half') {
      height = `${windowHeight * 0.5}px`;
    } else if (bottomSheetState === 'full') {
      height = `${windowHeight * 0.9}px`;
    }
    
    sheet.style.transition = 'height 0.3s ease';
    sheet.style.height = height;
  }, [bottomSheetState]);

  const toggleBottomSheet = () => {
    setBottomSheetState(prevState => {
      if (prevState === 'peek') return 'half';
      if (prevState === 'half') return 'full';
      return 'peek';
    });
  };

  // Handle current location change from RouteForm
  const handleSourceLocationChange = (location: Location | null) => {
    setCurrentLocation(location);
  };

  // Listen for route analysis completion events
  useEffect(() => {
    const handleRouteAnalysisComplete = (event: CustomEvent) => {
      const { routeId, analysis } = event.detail;
      setRoutes(prevRoutes => 
        prevRoutes.map(route => 
          route.id === routeId ? {
            ...route,
            geminiAnalysis: analysis
          } : route
        )
      );
    };

    // Add event listener
    window.addEventListener(
      ROUTE_ANALYSIS_COMPLETE_EVENT, 
      handleRouteAnalysisComplete as EventListener
    );

    // Clean up event listener
    return () => {
      window.removeEventListener(
        ROUTE_ANALYSIS_COMPLETE_EVENT, 
        handleRouteAnalysisComplete as EventListener
      );
    };
  }, []);

  // Find the index of the selected location in the current route's locations
  useEffect(() => {
    if (selectedStreetViewLocation && selectedRoute && selectedRoute.streetViewLocations) {
      // Log for debugging
      console.log("Selected location:", selectedStreetViewLocation);
      console.log("Available locations:", selectedRoute.streetViewLocations);
      
      // Find by exact comparison of coordinates (more reliable than index)
      const index = selectedRoute.streetViewLocations.findIndex(
        loc => 
          Math.abs(loc.coordinates.lat - selectedStreetViewLocation.coordinates.lat) < 0.0000001 &&
          Math.abs(loc.coordinates.lng - selectedStreetViewLocation.coordinates.lng) < 0.0000001
      );
      
      if (index !== -1) {
        console.log("Found matching location at index:", index);
        setViewedLocationIndex(index);
      } else {
        console.log("No matching location found");
        // If exact match fails, try matching by index
        if (selectedStreetViewLocation.index !== undefined && 
            selectedStreetViewLocation.index < selectedRoute.streetViewLocations.length) {
          setViewedLocationIndex(selectedStreetViewLocation.index);
        }
      }
    } else {
      setViewedLocationIndex(undefined);
    }
  }, [selectedStreetViewLocation, selectedRoute]);

  // Handle street view image click
  const handleStreetViewImageClick = (location: StreetViewLocation) => {
    // Force reset any existing marker first
    setSelectedStreetViewLocation(null);
    
    // Small delay to ensure cleanup before setting new marker
    setTimeout(() => {
      console.log("Street view image clicked:", location);
      setSelectedStreetViewLocation(location);
      setViewedLocationIndex(location.index);
      
      // On mobile, collapse the bottom sheet when viewing an image on map
      if (window.innerWidth < 1024) {
        setBottomSheetState('peek');
      }
    }, 50);
  };

  // Clear selected location when route changes
  useEffect(() => {
    setSelectedStreetViewLocation(null);
    setViewedLocationIndex(undefined);
  }, [selectedRouteId]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative">
      {/* Render Navigation View when navigating */}
      {isNavigating && navigatingRoute && (
        <NavigationView 
          route={navigatingRoute} 
          onClose={handleCloseNavigation} 
        />
      )}
      
      {/* Map Background - Full Size */}
      <div className="absolute inset-0 z-0">
        <Map 
          routes={routes} 
          selectedRouteId={selectedRouteId}
          onRouteSelect={handleRouteSelect}
          className="h-full w-full"
          currentLocation={currentLocation}
          selectedStreetViewLocation={selectedStreetViewLocation}
        />
      </div>
      
      {/* Top Navigation Bar */}
      <div className="absolute top-0 left-0 right-0 z-10">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center">
            <Button 
              variant="ghost" 
              size="icon" 
              className="mr-2 bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-md lg:flex hidden"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
            <div className="flex items-center gap-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-md">
              <MapPinned className="h-5 w-5 text-primary" />
              <span className="font-semibold">Safe Maps</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* Show toggle for inputs on mobile when routes are found */}
            {routes.length > 0 && window.innerWidth < 1024 && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-md"
                onClick={() => setShowInputs(!showInputs)}
              >
                {showInputs ? <X className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
              </Button>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-md"
              onClick={() => window.open('https://x.com/ombhojane05', '_blank')}
            >
              <Twitter className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Search Form - Positioned in top left */}
      <div className={cn(
        "absolute top-16 left-4 z-10 w-full max-w-md transition-all duration-300",
        // Hide on mobile when routes are found and showInputs is false
        (!showInputs && routes.length > 0 && window.innerWidth < 1024) ? "opacity-0 pointer-events-none -translate-y-4" : "opacity-100"
      )}>
          <RouteForm 
            onSubmit={handleRouteSubmit} 
            isLoading={isLoading} 
            onSourceLocationChange={handleSourceLocationChange}
          />
      </div>
        
      {/* Error Message */}
        {error && (
        <div className="absolute top-28 left-4 z-10 w-full max-w-md p-4 bg-destructive/90 text-destructive-foreground rounded-lg shadow-lg">
            <p>{error}</p>
          </div>
        )}
        
      {/* Loading Indicator */}
      {isLoading && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20 bg-background/80 backdrop-blur-sm p-6 rounded-xl shadow-lg">
          <div className="flex flex-col items-center">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <h3 className="text-lg font-medium">Analyzing Routes</h3>
            <p className="text-muted-foreground text-center mt-2 max-w-xs">
              Scanning all possible routes and analyzing risk factors
              </p>
            </div>
          </div>
      )}
      
      {/* Desktop view sidebar */}
      {routes.length > 0 && (
        <div className={cn(
          "absolute left-0 top-0 bottom-0 z-40 w-full max-w-md bg-background/95 backdrop-blur-md overflow-auto transition-transform duration-300 border-r shadow-lg hidden lg:block",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full py-16 px-4">
            {/* Routes Display - consolidated component */}
            <div className="mb-4">
              <RouteDisplay 
                routes={routes} 
                selectedRouteId={selectedRouteId} 
                onRouteSelect={handleRouteSelect}
                onStartTrip={handleStartTrip}
                isStartingTrip={isStartingTrip}
                travelMode={selectedTravelMode}
                onTravelModeChange={handleTravelModeChange}
                isLoading={isLoading}
              />
            </div>
            
            {/* Selected Route Details */}
              {selectedRoute && (
              <div key={routeDetailsKey} className="bg-card rounded-lg border p-4 shadow-sm mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-lg font-medium">Route Details</h2>
                  </div>
                  
                <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Distance</h3>
                      <p className="text-lg">{selectedRoute.distance}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Duration</h3>
                      <p className="text-lg">{selectedRoute.duration}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">Risk Score</h3>
                      <p className="text-lg">{selectedRoute.riskScore.toFixed(1)}/10</p>
                    </div>
                    
                    {/* Gemini AI Analysis */}
                    <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">AI Safety Score</h3>
                      {selectedRoute.geminiAnalysis?.isAnalyzing ? (
                        <div className="flex items-center gap-1.5">
                          <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="text-sm">Analyzing...</span>
                        </div>
                      ) : selectedRoute.geminiAnalysis?.riskScores?.length > 0 ? (
                        <p className="text-lg">
                          {selectedRoute.geminiAnalysis.averageRiskScore}/100
                        </p>
                      ) : (
                      <Button 
                        variant="ghost" 
                        className="text-xs p-0 h-auto underline text-muted-foreground hover:text-foreground"
                        onClick={() => startGeminiAnalysis(selectedRoute.id)}
                      >
                        Analyze with AI
                      </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Add AI Safety Analysis details card if analysis is complete */}
                  {selectedRoute.geminiAnalysis?.riskScores?.length > 0 && (
                    <div className="p-3 border rounded-lg bg-muted/30 mb-4">
                      <div className="flex items-start gap-2">
                        <BarChart className="h-5 w-5 text-primary mt-0.5" />
                        <div>
                          <h3 className="text-sm font-medium mb-1">AI Safety Analysis</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            Street View analysis detected these risk factors along the route:
                          </p>
                          
                          <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-1">
                            <div 
                              className={cn(
                                "h-full",
                                selectedRoute.geminiAnalysis.averageRiskScore <= 30 ? "bg-green-500" :
                                selectedRoute.geminiAnalysis.averageRiskScore <= 60 ? "bg-yellow-500" :
                                "bg-red-500"
                              )}
                              style={{ width: `${selectedRoute.geminiAnalysis.averageRiskScore}%` }}
                            ></div>
                          </div>
                          
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>Low Risk</span>
                            <span>Medium Risk</span>
                            <span>High Risk</span>
                          </div>
                          
                          {/* Key Insights from Analysis */}
                          {selectedRoute.geminiAnalysis.explanations?.length > 0 && (
                            <div className="mt-3 border-t pt-3">
                              <h4 className="text-sm font-medium mb-2">Key Insights:</h4>
                              <ul className="text-sm space-y-1.5">
                                {selectedRoute.geminiAnalysis.explanations.slice(0, 3).map((explanation, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                    <span>{explanation}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          
                          {/* Precautions from Analysis */}
                          {selectedRoute.geminiAnalysis.precautions?.length > 0 && (
                            <div className="mt-3 border-t pt-3">
                              <h4 className="text-sm font-medium mb-2">Safety Precautions:</h4>
                              <ul className="text-sm space-y-1.5">
                                {selectedRoute.geminiAnalysis.precautions.slice(0, 3).map((precaution, index) => (
                                  <li key={index} className="flex items-start gap-2">
                                    <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                    <span className="text-muted-foreground">{precaution}</span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                  
                <Tabs defaultValue="streetview" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="streetview" className="flex items-center gap-1">
                      <ImageIcon className="h-4 w-4" />
                      <span>Street View</span>
                    </TabsTrigger>
                  </TabsList>
                  <TabsContent value="streetview">
                    <StreetViewGallery
                      images={selectedRoute.streetViewImages || []}
                      className="mb-4"
                      geminiAnalysis={selectedRoute.geminiAnalysis}
                      onAnalysisComplete={(riskScores, averageRiskScore, explanations, precautions) => 
                        handleAnalysisComplete(selectedRoute.id, riskScores, averageRiskScore, explanations, precautions)
                      }
                      locations={selectedRoute.streetViewLocations}
                      onImageClick={handleStreetViewImageClick}
                      currentlyViewedLocationIndex={viewedLocationIndex}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Bottom Sheet for Mobile - Draggable */}
      {routes.length > 0 && (
        <div 
          ref={bottomSheetRef}
          className={cn(
            "fixed left-0 right-0 bottom-0 z-30 lg:hidden bg-background rounded-t-xl shadow-lg overflow-hidden transition-height duration-300 ease-in-out",
            "h-[140px]",
            "flex flex-col"
          )}
        >
          {/* Drag handle */}
          <div 
            className="w-full h-6 flex items-center justify-center cursor-pointer"
            onClick={toggleBottomSheet}
          >
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30"></div>
          </div>
          
          {/* Header with toggle button */}
          <div className="px-4 pb-2 flex items-center justify-between">
            <h2 className="text-lg font-medium">Safe Routes</h2>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={toggleBottomSheet}
              className="rounded-full h-8 w-8"
            >
              {bottomSheetState === 'peek' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
          
          {/* Travel mode tabs for mobile */}
          <div className="px-4 pb-2">
            <TravelModeTabs 
              selectedMode={selectedTravelMode}
              onModeChange={handleTravelModeChange}
              routesByMode={routesByMode}
              isLoading={isLoading}
            />
          </div>
          
          {/* Scrollable content */}
          <div className="overflow-auto pb-safe max-h-[calc(90vh-6rem)] px-4">
            <RouteDisplay 
                routes={routes} 
                selectedRouteId={selectedRouteId} 
                onRouteSelect={handleRouteSelect}
                onStartTrip={handleStartTrip}
                isStartingTrip={isStartingTrip}
              travelMode={selectedTravelMode}
              />
            
            {/* Route details (shown when expanded) */}
            {selectedRoute && bottomSheetState !== 'peek' && (
              <div key={routeDetailsKey} className="bg-card rounded-lg border p-4 shadow-sm mb-4 mt-4">
                <div className="flex justify-between items-start mb-3">
                  <h2 className="text-lg font-medium">Route Details</h2>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Distance</h3>
                    <p className="text-lg">{selectedRoute.distance}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Duration</h3>
                    <p className="text-lg">{selectedRoute.duration}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">Risk Score</h3>
                    <p className="text-lg">{selectedRoute.riskScore.toFixed(1)}/10</p>
                  </div>
                  
                  {/* Gemini AI Analysis */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">AI Safety Score</h3>
                    {selectedRoute.geminiAnalysis?.isAnalyzing ? (
                      <div className="flex items-center gap-1.5">
                        <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                        <span className="text-sm">Analyzing...</span>
                      </div>
                    ) : selectedRoute.geminiAnalysis?.riskScores?.length > 0 ? (
                      <p className="text-lg">
                        {selectedRoute.geminiAnalysis.averageRiskScore}/100
                      </p>
                    ) : (
                      <Button 
                        variant="ghost" 
                        className="text-xs p-0 h-auto underline text-muted-foreground hover:text-foreground"
                        onClick={() => startGeminiAnalysis(selectedRoute.id)}
                      >
                        Analyze with AI
                      </Button>
                    )}
                  </div>
                </div>
                
                {/* AI Safety Analysis Card */}
                {bottomSheetState === 'full' && selectedRoute.geminiAnalysis?.riskScores?.length > 0 && (
                  <div className="p-3 border rounded-lg bg-muted/30 mb-4">
                    <div className="flex items-start gap-2">
                      <BarChart className="h-5 w-5 text-primary mt-0.5" />
                      <div>
                        <h3 className="text-sm font-medium mb-1">AI Safety Analysis</h3>
                        <p className="text-sm text-muted-foreground mb-2">
                          Street View analysis detected these risk factors along the route:
                        </p>
                        
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden mb-1">
                          <div 
                            className={cn(
                              "h-full",
                              selectedRoute.geminiAnalysis.averageRiskScore <= 30 ? "bg-green-500" :
                              selectedRoute.geminiAnalysis.averageRiskScore <= 60 ? "bg-yellow-500" :
                              "bg-red-500"
                            )}
                            style={{ width: `${selectedRoute.geminiAnalysis.averageRiskScore}%` }}
                          ></div>
                        </div>
                        
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Low Risk</span>
                          <span>Medium Risk</span>
                          <span>High Risk</span>
                        </div>
                        
                        {/* Key Insights from Analysis */}
                        {selectedRoute.geminiAnalysis.explanations?.length > 0 && (
                          <div className="mt-3 border-t pt-3">
                            <h4 className="text-sm font-medium mb-2">Key Insights:</h4>
                            <ul className="text-sm space-y-1.5">
                              {selectedRoute.geminiAnalysis.explanations.slice(0, 3).map((explanation, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                                  <span>{explanation}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        
                        {/* Precautions from Analysis */}
                        {selectedRoute.geminiAnalysis.precautions?.length > 0 && (
                          <div className="mt-3 border-t pt-3">
                            <h4 className="text-sm font-medium mb-2">Safety Precautions:</h4>
                            <ul className="text-sm space-y-1.5">
                              {selectedRoute.geminiAnalysis.precautions.slice(0, 3).map((precaution, index) => (
                                <li key={index} className="flex items-start gap-2">
                                  <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                  <span className="text-muted-foreground">{precaution}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Street View Gallery */}
                {bottomSheetState === 'full' && (
                  <Tabs defaultValue="streetview" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="streetview" className="flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" />
                        <span>Street View</span>
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="streetview">
                      <StreetViewGallery
                        images={selectedRoute.streetViewImages || []}
                        className="mb-4"
                        geminiAnalysis={selectedRoute.geminiAnalysis}
                        onAnalysisComplete={(riskScores, averageRiskScore, explanations, precautions) => 
                          handleAnalysisComplete(selectedRoute.id, riskScores, averageRiskScore, explanations, precautions)
                        }
                        locations={selectedRoute.streetViewLocations}
                        onImageClick={handleStreetViewImageClick}
                        currentlyViewedLocationIndex={viewedLocationIndex}
                      />
                    </TabsContent>
                  </Tabs>
                )}
              </div>
            )}
          </div>
          
          {/* Fixed bottom action button */}
      {selectedRoute && (
            <div className="p-4 border-t bg-background sticky bottom-0 left-0 right-0">
          <div className="flex gap-2 mt-4">
            {isStartingTrip ? (
              <Button disabled className="flex-1">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Starting Navigation...
              </Button>
            ) : (
              <Button 
                className="w-full" 
                onClick={() => handleStartTrip(selectedRoute)}
              >
                Start Navigation
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            )}
          </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Index;
