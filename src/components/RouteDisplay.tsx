import React, { useState, useEffect } from 'react';
import { Route, Location } from "@/types";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TravelMode } from "@/services/mapsService";
import { Cloud, Sun, CloudRain, Thermometer, Navigation, Loader2, AlertCircle } from "lucide-react";
import TransitDetails from './TransitDetails';
import TravelModeSelector from './TravelModeSelector';

interface RouteDisplayProps {
  routes: Route[];
  selectedRouteId?: string;
  onRouteSelect: (routeId: string) => void;
  onStartTrip?: (route: Route) => void;
  isStartingTrip?: boolean;
  className?: string;
  travelMode: TravelMode;
  onTravelModeChange?: (mode: TravelMode) => void;
  isLoading?: boolean;
}

const RouteDisplay = ({
  routes,
  selectedRouteId,
  onRouteSelect,
  onStartTrip,
  isStartingTrip = false,
  className,
  travelMode,
  onTravelModeChange,
  isLoading = false
}: RouteDisplayProps) => {
  const [routesKey, setRoutesKey] = useState(0);
  
  // Update key when routes change to ensure re-render
  useEffect(() => {
    setRoutesKey(prev => prev + 1);
  }, [routes.map(r => r.geminiAnalysis?.isAnalyzing).join(','), 
      routes.map(r => r.geminiAnalysis?.averageRiskScore).join(',')]);
  
  if (!routes || routes.length === 0) {
    return null;
  }

  const selectedRoute = routes.find(route => route.id === selectedRouteId);

  // Get source and destination from the first route
  const source = routes[0]?.source;
  const destination = routes[0]?.destination;

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

  // Function to get risk color class
  const getRiskColorClass = (score: number): string => {
    // MapRiskScore is on a scale of 0-10
    if (score <= 3.3) return "bg-green-500";
    if (score <= 6.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  return (
    <div className={cn("space-y-4", className)} key={routesKey}>
      {/* Travel Mode Selector */}
      {onTravelModeChange && (
        <TravelModeSelector
          selectedMode={travelMode}
          onModeChange={onTravelModeChange}
          isLoading={isLoading}
          source={source}
          destination={destination}
        />
      )}

      {/* Routes List */}
      <div className="space-y-2">
        {routes.map((route) => {
          const isSelected = route.id === selectedRouteId;
          const riskColor = getRiskColorClass(route.riskScore);
          
          let aiScoreColor = "bg-green-500";
          if (route.geminiAnalysis?.averageRiskScore > 60) {
            aiScoreColor = "bg-red-500";
          } else if (route.geminiAnalysis?.averageRiskScore > 30) {
            aiScoreColor = "bg-yellow-500";
          }
          
          return (
            <div 
              key={route.id}
              onClick={() => onRouteSelect(route.id)}
              className={cn(
                "rounded-lg border bg-card p-4 shadow-sm transition-all cursor-pointer relative",
                isSelected 
                  ? "border-primary shadow-md ring-1 ring-primary" 
                  : "hover:border-primary/50"
              )}
            >
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl mr-1">{getTravelModeIcon(travelMode)}</span>
                <div className="flex-1">
                  <div className="font-medium text-lg">{route.duration}</div>
                  <div className="text-sm text-muted-foreground">{route.distance}</div>
                </div>
                
                <div className="flex flex-col gap-1 items-end">
                  <div className="flex items-center gap-2">
                    {/* <div className="px-2 py-1 rounded-full text-xs font-medium flex items-center">
                      <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", riskColor)}></span>
                      Risk: {route.riskScore.toFixed(1)}/10
                    </div> */}
                    
                    {route.geminiAnalysis?.riskScores?.length > 0 && (
                      <div className="px-2 py-1 rounded-full text-xs font-medium flex items-center">
                        <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", aiScoreColor)}></span>
                        Safety Score: {route.geminiAnalysis.averageRiskScore}/100
                      </div>
                    )}
                  </div>
                  
                  {route.weather && (
                    <div className="flex items-center gap-1 text-sm">
                      <WeatherIcon condition={route.weather.condition} />
                      <span>{route.weather.temperature.toFixed(1)}°C, {route.weather.condition}</span>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                <div className={cn("h-full", riskColor)} style={{ width: `100%` }}></div>
              </div>
              
              {/* Route explanations */}
              {route.geminiAnalysis?.explanations && route.geminiAnalysis.explanations.length > 0 && (
                <div className="mb-3 text-sm text-muted-foreground">
                  <p className="line-clamp-2">{route.geminiAnalysis.explanations[0]}</p>
                </div>
              )}
              
              {/* Transit details for public transport */}
              {travelMode === TravelMode.TRANSIT && route.transitDetails && (
                <div className="mt-3 mb-3 border-t pt-3">
                  <h4 className="text-sm font-medium mb-2">Transit Details:</h4>
                  
                  {/* Transit summary info */}
                  <div className="mb-2 text-sm">
                    {(() => {
                      const walkSteps = route.transitDetails.filter(s => s.type === 'WALK');
                      const transitSteps = route.transitDetails.filter(s => s.type === 'TRANSIT');
                      
                      // Calculate total walking distance and time
                      let totalWalkingDistance = 0;
                      let totalWalkingTime = 0;
                      
                      walkSteps.forEach(step => {
                        if (step.distance) {
                          // Extract numeric part from distance string (e.g., "0.5 mi" -> 0.5)
                          const match = step.distance.match(/[\d.]+/);
                          if (match) {
                            totalWalkingDistance += parseFloat(match[0]);
                          }
                        }
                        
                        if (step.duration) {
                          totalWalkingTime += parseInt(step.duration.replace('s', '') || '0');
                        }
                      });
                      
                      return (
                        <div className="flex flex-col gap-1 mb-2">
                          <div className="flex items-center">
                            <span className="text-lg mr-2">🚶</span>
                            <span>
                              {walkSteps.length > 0 && 
                                `${Math.round(totalWalkingTime / 60)} min walking (${totalWalkingDistance.toFixed(1)} mi)`}
                            </span>
                          </div>
                          {transitSteps.map((transit, i) => (
                            <div key={i} className="flex items-center">
                              <div 
                                className="w-6 h-6 flex items-center justify-center rounded-full mr-2 text-sm flex-shrink-0"
                                style={{ backgroundColor: transit.color || '#1A73E8', color: transit.textColor || 'white' }}
                              >
                                {transit.line}
                              </div>
                              <span>
                                {transit.durationText}, {transit.departureStop} → {transit.arrivalStop}
                              </span>
                            </div>
                          ))}
                          <div className="text-muted-foreground text-xs mt-1">
                            {transitSteps.length > 0 && `${transitSteps.length} ${transitSteps.length === 1 ? 'transfer' : 'transfers'}`}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                  
                  {/* Detailed transit steps */}
                  <TransitDetails steps={route.transitDetails} />
                </div>
              )}
              
              {/* Action buttons */}
              <div className="flex justify-end gap-2 mt-3">
                {onStartTrip && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartTrip(route);
                    }}
                    disabled={isStartingTrip}
                  >
                    {(isStartingTrip && isSelected) ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
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
        })}
      </div>
    </div>
  );
};

export default RouteDisplay; 