import { useState, useRef, useEffect } from "react";
import Map from "@/components/Map";
import RouteForm from "@/components/RouteForm";
import RouteList from "@/components/RouteList";
import StreetViewGallery from "@/components/StreetViewGallery";
import { Location, Route } from "@/types";
import { computeRoutes, generateNavigationUrl } from "@/services/mapsService";
import { MapPinned, AlertTriangle, MapPin, Image as ImageIcon, BarChart, Navigation, AlertCircle, Lightbulb, Layers, Menu, X, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

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

  const handleRouteSubmit = async (source: Location, destination: Location) => {
    setIsLoading(true);
    setError(null);
    setRoutes([]);
    setSelectedRouteId(undefined);
    
    try {
      // Fetch routes using the Routes API via our mapsService
      const fetchedRoutes = await computeRoutes(source, destination);
      setRoutes(fetchedRoutes);
      
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
    
    // Slight delay to show loading state
    setTimeout(() => {
      window.open(generateNavigationUrl(route), '_blank');
      setIsStartingTrip(false);
    }, 500);
  };

  // Get the selected route object
  const selectedRoute = routes.find(route => route.id === selectedRouteId);

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

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col relative">
      {/* Map Background - Full Size */}
      <div className="absolute inset-0 z-0">
        <Map 
          routes={routes} 
          selectedRouteId={selectedRouteId}
          onRouteSelect={handleRouteSelect}
          className="h-full w-full"
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
            <Button variant="ghost" size="icon" className="bg-background/80 backdrop-blur-sm hover:bg-background/90 rounded-full shadow-md">
              <Layers className="h-5 w-5" />
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
          <RouteForm onSubmit={handleRouteSubmit} isLoading={isLoading} />
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
      
      {/* Sidebar for route info - slides in from left - Desktop Only */}
      {routes.length > 0 && (
        <div className={cn(
          "absolute left-0 top-0 bottom-0 z-20 w-full max-w-md bg-background/95 backdrop-blur-md overflow-auto transition-transform duration-300 border-r shadow-lg hidden lg:block",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="flex flex-col h-full py-16 px-4">
            {/* Routes List */}
            <div className="mb-4">
              <RouteList 
                routes={routes} 
                selectedRouteId={selectedRouteId} 
                onRouteSelect={handleRouteSelect}
                onStartTrip={handleStartTrip}
                isStartingTrip={isStartingTrip}
              />
            </div>
            
            {/* Selected Route Details */}
              {selectedRoute && (
              <div className="bg-card rounded-lg border p-4 shadow-sm mb-4">
                  <div className="flex justify-between items-start mb-3">
                    <h2 className="text-lg font-medium">Route Details</h2>
                    
                    {/* Start Trip Button */}
                    <Button 
                      onClick={() => handleStartTrip(selectedRoute)}
                      className="text-sm"
                      disabled={isStartingTrip}
                    >
                      {isStartingTrip ? (
                        <>
                          <span className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-1.5"></span>
                          Starting...
                        </>
                      ) : (
                        <>
                          <Navigation className="h-4 w-4 mr-1.5" />
                          Start Trip
                        </>
                      )}
                    </Button>
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
                      geminiAnalysis={selectedRoute.geminiAnalysis as any}
                      onAnalysisComplete={(riskScores, averageRiskScore, explanations, precautions) => 
                        handleAnalysisComplete(selectedRoute.id, riskScores, averageRiskScore, explanations, precautions)
                      }
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
          className="fixed left-0 right-0 bottom-0 z-30 lg:hidden bg-background rounded-t-xl shadow-lg overflow-hidden transition-height duration-300 ease-in-out"
          style={{ height: '140px' }}
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
          
          {/* Scrollable content */}
          <div className="overflow-auto pb-safe max-h-[calc(90vh-6rem)] px-4">
            {/* Route list */}
            <div className="mb-4">
              <RouteList 
                routes={routes} 
                selectedRouteId={selectedRouteId} 
                onRouteSelect={handleRouteSelect}
                onStartTrip={handleStartTrip}
                isStartingTrip={isStartingTrip}
                compact={bottomSheetState === 'peek'}
              />
            </div>
            
            {/* Route details (shown when expanded) */}
            {selectedRoute && bottomSheetState !== 'peek' && (
              <div className="bg-card rounded-lg border p-4 shadow-sm mb-4">
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
                        geminiAnalysis={selectedRoute.geminiAnalysis as any}
                        onAnalysisComplete={(riskScores, averageRiskScore, explanations, precautions) => 
                          handleAnalysisComplete(selectedRoute.id, riskScores, averageRiskScore, explanations, precautions)
                        }
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
          <Button 
            onClick={() => handleStartTrip(selectedRoute)}
                className="w-full"
            size="lg"
            disabled={isStartingTrip}
          >
            {isStartingTrip ? (
              <>
                <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
                Starting Trip...
              </>
            ) : (
              <>
                <Navigation className="h-5 w-5 mr-2" />
                Start Trip
              </>
            )}
          </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Index;
