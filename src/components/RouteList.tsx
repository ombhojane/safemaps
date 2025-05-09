import React from 'react';
import { Route } from "@/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Route as RouteIcon, Gauge, BarChart, CheckCircle2, Loader2, Navigation, Cloud, Sun, CloudRain, Thermometer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { generateNavigationUrl, TravelMode } from "@/services/mapsService";
import { getWeatherIconUrl } from "@/services/weatherService";
import { useEffect, useState } from "react";
import TransitDetails from './TransitDetails';

interface RouteListProps {
  routes: Route[];
  selectedRouteId?: string;
  onRouteSelect: (routeId: string) => void;
  onStartTrip?: (route: Route) => void;
  isStartingTrip?: boolean;
  className?: string;
  compact?: boolean;
  travelMode: TravelMode;
}

const RouteList = ({ 
  routes, 
  selectedRouteId, 
  onRouteSelect,
  onStartTrip,
  isStartingTrip = false,
  className,
  compact = false,
  travelMode
}: RouteListProps) => {
  // Add a key to force re-render when routes change
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

  // Function to get risk color class
  const getRiskColorClass = (score: number): string => {
    // MapRiskScore is on a scale of 0-10
    if (score <= 3.3) return "bg-green-500";
    if (score <= 6.6) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Function to get Gemini risk color class (0-100 scale)
  const getGeminiRiskColorClass = (score: number): string => {
    // Gemini risk score is on a scale of 0-100
    if (score <= 30) return "bg-green-500";
    if (score <= 60) return "bg-yellow-500";
    return "bg-red-500";
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

  // Function to get via info text
  const getViaText = (route: Route): string => {
    if (travelMode === TravelMode.TRANSIT && route.transitDetails && route.transitDetails.length > 0) {
      // For transit, show the transportation method
      const transitTypes = route.transitDetails
        .filter(step => step.type === 'TRANSIT')
        .map(step => step.line)
        .filter(Boolean);
      
      if (transitTypes.length > 0) {
        return `via ${transitTypes.join(', ')}`;
      }
    }
    
    // For driving/walking, we could include major road names if available
    return `via ${route.id.includes('alt') ? 'alternative route' : 'fastest route'}`;
  };

  return (
    <div key={routesKey} className={cn("space-y-4", className)}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-medium">Routes ({routes.length})</h2>
      </div>
      
      <div className={cn("space-y-4", compact ? "flex overflow-x-auto pb-2 space-x-4 space-y-0" : "")}>
        {routes.map((route) => {
          const isSelected = route.id === selectedRouteId;
          let riskColor = "bg-green-500";
          let riskText = "Low Risk";
          
          if (route.riskScore > 6.6) {
            riskColor = "bg-red-500";
            riskText = "High Risk";
          } else if (route.riskScore > 3.3) {
            riskColor = "bg-yellow-500";
            riskText = "Medium Risk";
          }

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
                  : "hover:border-primary/50",
                compact ? "min-w-[200px] flex-shrink-0 p-3" : "",
                isSelected && compact ? "border-primary/80 bg-primary/5" : ""
              )}
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn("px-2 py-1 rounded-full text-xs font-medium flex items-center", 
                  compact ? "py-0.5" : "")}>
                  <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", riskColor)}></span>
                  Risk: {route.riskScore.toFixed(1)}/10
                </div>
                
                {route.geminiAnalysis?.riskScores?.length > 0 && (
                  <div className={cn("px-2 py-1 rounded-full text-xs font-medium flex items-center",
                    compact ? "py-0.5" : "")}>
                    <span className={cn("inline-block w-2 h-2 rounded-full mr-1.5", aiScoreColor)}></span>
                    AI: {route.geminiAnalysis.averageRiskScore}/100
                  </div>
                )}

                {route.weather && (
                  <div className={cn("px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1",
                    compact ? "py-0.5" : "")}>
                    <WeatherIcon condition={route.weather.condition} />
                    <span>{route.weather.condition}</span>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-3 mb-2">
                <div className="flex items-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-1.5 text-muted-foreground">
                    <circle cx="12" cy="12" r="10" className="fill-none stroke-current stroke-[1.5]"></circle>
                    <polyline points="12,6 12,12 16,14" className="fill-none stroke-current stroke-[1.5]"></polyline>
                  </svg>
                  <span className="text-sm">{route.duration}</span>
                </div>
                
                <div className="flex items-center">
                  <svg viewBox="0 0 24 24" className="h-4 w-4 mr-1.5 text-muted-foreground">
                    <path d="M12 22s-8-4.5-8-11.8a8 8 0 0 1 16 0c0 7.3-8 11.8-8 11.8z" className="fill-none stroke-current stroke-[1.5]"></path>
                    <circle cx="12" cy="10" r="3" className="fill-none stroke-current stroke-[1.5]"></circle>
                  </svg>
                  <span className="text-sm">{route.distance}</span>
                </div>
                
                {route.weather && (
                  <div className="flex items-center">
                    <Thermometer className="h-4 w-4 mr-1.5 text-muted-foreground" />
                    <span className="text-sm">{route.weather.temperature.toFixed(1)}°C</span>
                  </div>
                )}
              </div>

              <div className={cn("w-full h-1.5 bg-muted rounded-full overflow-hidden mb-3", 
                compact ? "mb-2" : "")}>
                <div className={cn("h-full", riskColor)} style={{ width: `100%` }}></div>
              </div>
              
              {!compact && route.geminiAnalysis?.explanations && route.geminiAnalysis.explanations.length > 0 && (
                <div className="mb-3 text-sm text-muted-foreground">
                  <p className="line-clamp-2">{route.geminiAnalysis.explanations[0]}</p>
                </div>
              )}
              
              {!compact && onStartTrip && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={(e) => {
                    e.stopPropagation();
                    onStartTrip(route);
                  }}
                  className="w-full"
                  disabled={isStartingTrip}
                >
                  {(isStartingTrip && isSelected) ? (
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
          );
        })}
      </div>
    </div>
  );
};

export default RouteList; 