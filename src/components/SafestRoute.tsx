import React from 'react';
import { Route } from "@/types";
import { TravelMode } from "@/services/mapsService";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Cloud, Sun, CloudRain, Thermometer, Navigation, Loader2, ShieldCheck } from "lucide-react";

interface SafestRouteProps {
  routes: Route[];
  onRouteSelect: (routeId: string) => void;
  onStartTrip?: (route: Route) => void;
  isStartingTrip?: boolean;
  isLoading?: boolean;
  travelMode: TravelMode;
}

const SafestRoute = ({
  routes,
  onRouteSelect,
  onStartTrip,
  isStartingTrip = false,
  isLoading = false,
  travelMode
}: SafestRouteProps) => {
  // If no routes or analysis is still in progress, show a loading state
  if (isLoading || !routes || routes.length === 0 || routes.some(r => r.geminiAnalysis?.isAnalyzing)) {
    return (
      <div className="rounded-lg border bg-card p-4 shadow-sm mb-6">
        <div className="flex items-center gap-2 mb-3">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-medium">Safest Route</h2>
        </div>
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-6 w-6 text-primary animate-spin mr-2" />
          <span className="text-sm text-muted-foreground">Calculating safest route...</span>
        </div>
      </div>
    );
  }

  // Filter out routes that don't have safety scores yet
  const routesWithSafetyScores = routes.filter(r => 
    r.geminiAnalysis && 
    typeof r.geminiAnalysis.averageRiskScore === 'number'
  );

  // If no routes have safety scores yet, return null
  if (routesWithSafetyScores.length === 0) {
    return null;
  }

  // Find the route with the lowest safety score (safest)
  const safestRoute = [...routesWithSafetyScores].sort((a, b) => 
    a.geminiAnalysis!.averageRiskScore - b.geminiAnalysis!.averageRiskScore
  )[0];

  // Get icon for travel mode
  const getTravelModeIcon = (mode: TravelMode) => {
    switch (mode) {
      case TravelMode.DRIVE: return '🚗';
      case TravelMode.TRANSIT: return '🚌';
      case TravelMode.WALK: return '🚶';
      case TravelMode.BICYCLE: return '🚲';
      case TravelMode.TWO_WHEELER: return '🏍️';
      default: return '🚗';
    }
  };

  // Weather icon component based on weather condition
  const WeatherIcon = ({ condition }: { condition: string }) => {
    const lowerCondition = condition.toLowerCase();
    
    if (lowerCondition.includes('clear') || lowerCondition.includes('sunny')) {
      return <Sun className="h-4 w-4 text-yellow-500" />;
    } else if (lowerCondition.includes('rain') || lowerCondition.includes('drizzle')) {
      return <CloudRain className="h-4 w-4 text-blue-500" />;
    } else if (lowerCondition.includes('cloud')) {
      return <Cloud className="h-4 w-4 text-gray-500" />;
    } else {
      return <Cloud className="h-4 w-4 text-gray-500" />;
    }
  };

  // Function to get color class based on safety score
  const getSafetyColorClass = (score: number): string => {
    // Safety score is on a scale of 0-100
    if (score <= 30) return "bg-green-500 text-green-500";
    if (score <= 60) return "bg-yellow-500 text-yellow-500";
    return "bg-red-500 text-red-500";
  };

  const safetyColorClass = getSafetyColorClass(safestRoute.geminiAnalysis!.averageRiskScore);
  const colorName = safetyColorClass.includes('green') ? 'green' : safetyColorClass.includes('yellow') ? 'yellow' : 'red';

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm mb-6 border-green-200 bg-green-50">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="h-5 w-5 text-green-600" />
        <h2 className="text-lg font-medium text-green-800">Safest Route</h2>
        <div className="ml-auto text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
          Lowest Safety Score
        </div>
      </div>
      
      <div 
        className="rounded-lg border bg-white p-4 shadow-sm cursor-pointer transition-all hover:border-primary/50"
        onClick={() => onRouteSelect(safestRoute.id)}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xl mr-1">{getTravelModeIcon(travelMode)}</span>
          <div className="flex-1">
            <div className="font-medium text-lg">{safestRoute.duration}</div>
            <div className="text-sm text-muted-foreground">{safestRoute.distance}</div>
          </div>
          
          <div className="flex flex-col gap-1 items-end">
            <div className="flex items-center gap-2">
              <div className="px-2 py-1 rounded-full text-xs font-medium flex items-center bg-green-100">
                <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5 bg-green-500")}></span>
                Safety Score: {safestRoute.geminiAnalysis!.averageRiskScore}/100
              </div>
            </div>
            
            {safestRoute.weather && (
              <div className="flex items-center gap-1 text-sm">
                <WeatherIcon condition={safestRoute.weather.condition} />
                <span>{safestRoute.weather.temperature.toFixed(1)}°C, {safestRoute.weather.condition}</span>
              </div>
            )}
          </div>
        </div>
        
        {/* Safety explanation */}
        {safestRoute.geminiAnalysis?.explanations && safestRoute.geminiAnalysis.explanations.length > 0 && (
          <div className="mb-3 text-sm text-muted-foreground">
            <p className="line-clamp-2">{safestRoute.geminiAnalysis.explanations[0]}</p>
          </div>
        )}
        
        {onStartTrip && (
          <Button 
            variant="default" 
            size="sm" 
            onClick={(e) => {
              e.stopPropagation();
              onStartTrip(safestRoute);
            }}
            className="w-full bg-green-600 hover:bg-green-700"
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
        )}
      </div>
    </div>
  );
};

export default SafestRoute; 