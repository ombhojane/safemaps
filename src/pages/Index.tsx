
import { useState } from "react";
import Map from "@/components/Map";
import RouteForm from "@/components/RouteForm";
import RouteCard from "@/components/RouteCard";
import RiskAreaDetails from "@/components/RiskAreaDetails";
import RouteRecommendation from "@/components/RouteRecommendation";
import { Location, Route, RouteAnalysis } from "@/types";
import routeService from "@/services/routeService";
import { Shield, AlertTriangle } from "lucide-react";

const Index = () => {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [analysis, setAnalysis] = useState<RouteAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleRouteSubmit = async (source: Location, destination: Location) => {
    setIsLoading(true);
    setSelectedRoute(null);
    setAnalysis(null);
    
    try {
      const fetchedRoutes = await routeService.getRoutes(source, destination);
      setRoutes(fetchedRoutes);
      
      // Auto-select the safest route (lowest risk score)
      const safestRoute = [...fetchedRoutes].sort((a, b) => a.riskScore - b.riskScore)[0];
      setSelectedRoute(safestRoute);
      
      // Get analysis for the selected route
      analyzeRoute(safestRoute.id);
    } catch (error) {
      console.error("Error fetching routes:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeRoute = async (routeId: string) => {
    setIsAnalyzing(true);
    
    try {
      const routeAnalysis = await routeService.analyzeRoute(routeId);
      setAnalysis(routeAnalysis);
    } catch (error) {
      console.error("Error analyzing route:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRouteSelect = (route: Route) => {
    setSelectedRoute(route);
    setAnalysis(null);
    analyzeRoute(route.id);
  };

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
          </div>
        </div>
      </header>
      
      {/* Main content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 flex flex-col">
        {/* Route input form */}
        <div className="mb-6">
          <RouteForm onSubmit={handleRouteSubmit} isLoading={isLoading} />
        </div>
        
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h3 className="text-lg font-medium mb-2">Analyzing Routes</h3>
              <p className="text-muted-foreground max-w-md">
                We're scanning all possible routes and analyzing risk factors to recommend the safest option.
              </p>
            </div>
          </div>
        ) : routes.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Route cards */}
            <div className="lg:col-span-1 space-y-4">
              <h2 className="text-lg font-medium mb-3">Available Routes</h2>
              
              <div className="space-y-4">
                {routes.map((route) => (
                  <RouteCard
                    key={route.id}
                    route={route}
                    isSelected={selectedRoute?.id === route.id}
                    onSelect={handleRouteSelect}
                  />
                ))}
              </div>
            </div>
            
            {/* Map and analysis */}
            <div className="lg:col-span-2 space-y-6">
              {/* Map */}
              <div className="h-[400px] md:h-[500px] bg-muted rounded-lg overflow-hidden">
                <Map 
                  route={selectedRoute} 
                  riskAreas={selectedRoute?.riskAreas}
                  isLoading={isAnalyzing && !analysis} 
                />
              </div>
              
              {/* Analysis section */}
              {selectedRoute && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Route recommendation */}
                  <div>
                    <h2 className="text-lg font-medium mb-3">Route Recommendation</h2>
                    {analysis ? (
                      <RouteRecommendation analysis={analysis} />
                    ) : (
                      <div className="rounded-lg bg-muted flex items-center justify-center p-8">
                        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mr-4"></div>
                        <p>Analyzing route safety...</p>
                      </div>
                    )}
                  </div>
                  
                  {/* Risk areas */}
                  <div>
                    <h2 className="text-lg font-medium mb-3">Risk Areas</h2>
                    <div className="bg-card rounded-lg border shadow-sm max-h-[300px] overflow-y-auto">
                      {analysis ? (
                        <RiskAreaDetails riskAreas={analysis.route.riskAreas} />
                      ) : (
                        <div className="rounded-lg bg-muted flex items-center justify-center p-8">
                          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mr-4"></div>
                          <p>Detecting risk areas...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center">
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
    </div>
  );
};

export default Index;
