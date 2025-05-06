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
          ? "border-primary shadow-md" 
          : "hover:border-primary/50 hover:shadow-sm cursor-pointer",
      )}
      onClick={() => onSelect(route)}
    >
      {isSelected && (
        <div className="absolute top-0 left-0 w-full h-1 bg-primary" />
      )}
      
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          {/* Time and Distance */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium">{route.duration}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <RouteIcon className="w-4 h-4" />
              <span>{route.distance}</span>
            </div>
          </div>

          {/* Risk Score */}
          <div className="flex items-center space-x-2">
            <div className={cn(
              "px-2 py-1 rounded-full text-xs font-medium flex items-center space-x-1",
              level === "low" ? "bg-risk-low/10 text-risk-low" : 
              level === "medium" ? "bg-risk-medium/10 text-risk-medium" : 
              "bg-risk-high/10 text-risk-high"
            )}>
              <AlertTriangle className="w-3 h-3" />
              <span>Risk: {route.riskScore.toFixed(1)}</span>
            </div>
            <Button 
              variant={isSelected ? "secondary" : "ghost"} 
              size="sm"
              className="ml-2"
              onClick={(e) => {
                e.stopPropagation();
                onSelect(route);
              }}
            >
              {isSelected ? "Selected" : "Select"}
            </Button>
          </div>
        </div>

        {/* Weather Info */}
        {route.weather && (
          <div className="mt-3 flex items-center space-x-2 text-xs text-muted-foreground">
            <img 
              src={`https://openweathermap.org/img/w/${route.weather.icon}.png`} 
              alt={route.weather.condition}
              className="w-4 h-4"
            />
            <span>{route.weather.temperature}°C</span>
            <span>•</span>
            <span>{route.weather.condition}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RouteCard;
