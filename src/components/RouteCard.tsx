
import { Route, RiskLevel } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock, Route as RouteIcon, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteCardProps {
  route: Route;
  isSelected?: boolean;
  onSelect: (route: Route) => void;
}

const RouteCard = ({ route, isSelected, onSelect }: RouteCardProps) => {
  // Map risk score to text and color
  const getRiskInfo = (score: number): { level: RiskLevel; color: string } => {
    if (score < 3) {
      return { level: "low", color: "text-risk-low" };
    } else if (score < 6) {
      return { level: "medium", color: "text-risk-medium" };
    } else {
      return { level: "high", color: "text-risk-high" };
    }
  };

  const { level, color } = getRiskInfo(route.riskScore);

  return (
    <Card 
      className={cn(
        "relative overflow-hidden transition-all duration-300",
        isSelected 
          ? "border-primary shadow-lg" 
          : "hover:border-primary/50 hover:shadow-md cursor-pointer",
      )}
      onClick={() => onSelect(route)}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-primary animate-pulse-slow" />
      )}
      
      <CardContent className="p-5">
        <div className="flex flex-col space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center",
                level === "low" ? "bg-risk-low/20" : 
                level === "medium" ? "bg-risk-medium/20" : 
                "bg-risk-high/20"
              )}>
                <AlertTriangle className={cn("w-5 h-5", color)} />
              </div>
              <div>
                <h3 className="font-medium">Route {route.id.split('-')[1]}</h3>
                <div className="flex items-center">
                  <span className={cn("text-sm font-semibold", color)}>
                    {level.charAt(0).toUpperCase() + level.slice(1)} Risk
                  </span>
                  <span className="mx-2 text-muted-foreground">•</span>
                  <span className="text-sm text-muted-foreground">
                    Score: {route.riskScore.toFixed(1)}/10
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="flex items-center space-x-2 text-muted-foreground">
              <RouteIcon className="w-4 h-4" />
              <span>{route.distance}</span>
            </div>
            <div className="flex items-center space-x-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{route.duration}</span>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <div className="flex">
              {route.riskAreas.slice(0, 3).map((area, i) => (
                <div
                  key={area.id}
                  className={cn(
                    "w-3 h-3 rounded-full border border-background -mr-1",
                    area.riskLevel === "low" ? "bg-risk-low" :
                    area.riskLevel === "medium" ? "bg-risk-medium" : "bg-risk-high"
                  )}
                  style={{ zIndex: 3 - i }}
                ></div>
              ))}
              {route.riskAreas.length > 3 && (
                <div className="ml-2 text-xs text-muted-foreground">
                  +{route.riskAreas.length - 3} more
                </div>
              )}
            </div>
            
            <Button 
              variant={isSelected ? "secondary" : "outline"} 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(route);
              }}
            >
              {isSelected ? "Selected" : "Select"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteCard;
