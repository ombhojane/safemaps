import { Route } from "@/types";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock, Route as RouteIcon, Gauge, BarChart, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface RouteListProps {
  routes: Route[];
  selectedRouteId?: string;
  onRouteSelect: (routeId: string) => void;
}

const RouteList = ({ routes, selectedRouteId, onRouteSelect }: RouteListProps) => {
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

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-medium">Available Routes ({routes.length})</h2>
      <div className="space-y-3">
        {routes.map((route) => (
          <Card 
            key={route.id}
            className={cn(
              "overflow-hidden cursor-pointer transition-all hover:border-primary/50 group",
              selectedRouteId === route.id && "border-primary ring-1 ring-primary"
            )}
            onClick={() => onRouteSelect(route.id)}
          >
            <CardHeader className="p-3 pb-0">
              <div className="flex items-center justify-between">
                <Badge 
                  variant="outline" 
                  className={cn(
                    "px-2 py-0.5 text-white",
                    getRiskColorClass(route.riskScore)
                  )}
                >
                  <Gauge className="h-3 w-3 mr-1" />
                  Risk: {route.riskScore.toFixed(1)}/10
                </Badge>
                
                {/* AI Analysis Status or Badge */}
                {route.geminiAnalysis?.isAnalyzing ? (
                  <Badge variant="outline" className="flex items-center gap-1">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Analyzing...</span>
                  </Badge>
                ) : route.geminiAnalysis?.riskScores?.length > 0 ? (
                  <Badge 
                    variant="outline" 
                    className={cn(
                      "px-2 py-0.5 text-white flex items-center gap-1",
                      getGeminiRiskColorClass(route.geminiAnalysis.averageRiskScore)
                    )}
                  >
                    <BarChart className="h-3 w-3" />
                    AI: {route.geminiAnalysis.averageRiskScore}/100
                  </Badge>
                ) : null}
              </div>
            </CardHeader>
            
            <CardContent className="p-3">
              <div className="space-y-2">
                <div className="flex items-center space-x-1 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>{route.duration}</span>
                  <div className="h-4 border-r mx-1"></div>
                  <RouteIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{route.distance}</span>
                </div>
                
                {/* Risk Areas Summary */}
                {route.riskAreas && route.riskAreas.length > 0 && (
                  <div className="flex items-center space-x-1 text-sm">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    <span>
                      {route.riskAreas.length} risk {route.riskAreas.length === 1 ? 'area' : 'areas'} detected
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
            
            <CardFooter className="p-3 pt-0">
              <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                <div 
                  className={cn("h-full rounded-full", getRiskColorClass(route.riskScore))}
                  style={{ width: `${route.riskScore * 10}%` }}
                ></div>
              </div>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default RouteList; 