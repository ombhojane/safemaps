import { useState } from "react";
import Map from "@/components/Map";
import RouteForm from "@/components/RouteForm";
import RouteList from "@/components/RouteList";
import StreetViewGallery from "@/components/StreetViewGallery";
import { Location, Route } from "@/types";
import { computeRoutes, generateNavigationUrl } from "@/services/mapsService";
import { Shield, AlertTriangle, MapPin, Image as ImageIcon, BarChart, Navigation, AlertCircle, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

const Index = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRouteId, setSelectedRouteId] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStartingTrip, setIsStartingTrip] = useState(false);

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
  const handleAnalysisComplete = (routeId: string, riskScores: number[], averageRiskScore: number, explanations: string[], precautions: string[]) => {
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="w-full py-4 px-6 border-b bg-background/95 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-semibold tracking-tight">Route Risk Radar</h1>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm flex items-center px-3 py-1.5 rounded-full bg-primary/10 text-primary">
              <AlertTriangle className="h-4 w-4 mr-1.5" />
              <span>Risk Detection Active</span>
            </div>

            <Button variant="outline" className="hidden md:flex">
              New Maps
            </Button>
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col">
        {/* Route input form */}
        <div className="mb-6">
          <RouteForm onSubmit={handleRouteSubmit} isLoading={isLoading} />
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-destructive/15 text-destructive rounded-lg">
            <p>{error}</p>
          </div>
        )}
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Analyzing Routes</h3>
              <p className="text-muted-foreground max-w-md">
                We're scanning all possible routes and analyzing risk factors to recommend the safest option.
              </p>
            </div>
          </div>
        ) : routes.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Route list */}
            <div className="lg:col-span-4">
              <RouteList 
                routes={routes} 
                selectedRouteId={selectedRouteId} 
                onRouteSelect={handleRouteSelect}
                onStartTrip={handleStartTrip}
                isStartingTrip={isStartingTrip}
              />
            </div>
            
            {/* Map section */}
            <div className="lg:col-span-8 space-y-6">
              {selectedRoute && (
                <div className="bg-card rounded-lg border p-4 shadow-sm">
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
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
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
                      <h3 className="text-sm font-medium text-muted-foreground mb-1">
                        AI Safety Score
                      </h3>
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
                        <p className="text-sm text-muted-foreground">Not analyzed</p>
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
                  
                  <Tabs defaultValue="map" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="map" className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        <span>Map</span>
                      </TabsTrigger>
                      <TabsTrigger value="streetview" className="flex items-center gap-1">
                        <ImageIcon className="h-4 w-4" />
                        <span>Street View</span>
                      </TabsTrigger>
                    </TabsList>
                    <TabsContent value="map">
                      <Map 
                        routes={routes} 
                        selectedRouteId={selectedRouteId}
                        onRouteSelect={handleRouteSelect}
                        className="h-[500px]"
                      />
                    </TabsContent>
                    <TabsContent value="streetview">
                      <StreetViewGallery
                        images={selectedRoute.streetViewImages || []}
                        className="mb-4"
                        geminiAnalysis={selectedRoute.geminiAnalysis}
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
        ) : (
          <div className="flex-1 flex items-center justify-center py-12">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Shield className="h-10 w-10 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-2">Route Risk Radar</h2>
              <p className="text-muted-foreground mb-6">
                Enter your source and destination to find the safest route with real-time risk detection and analysis.
              </p>
            </div>
          </div>
        )}
      </main>
      
      {/* Footer */}
      <footer className="w-full py-6 px-6 border-t bg-card/50">
        <div className="max-w-7xl mx-auto text-center text-sm text-muted-foreground">
          <p>Route Risk Radar • Safety-First Navigation</p>
        </div>
      </footer>
      
      {/* Mobile Fixed Navigation Button */}
      {selectedRoute && (
        <div className="fixed bottom-4 left-0 right-0 flex justify-center lg:hidden z-10 px-4">
          <Button 
            onClick={() => handleStartTrip(selectedRoute)}
            className="w-full max-w-md shadow-lg"
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
  );
};

export default Index;
