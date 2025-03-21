import { Route } from "@/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Check, Clock, MapPin, Route as RouteIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RouteListProps {
  routes: Route[];
  selectedRouteId?: string;
  onRouteSelect: (routeId: string) => void;
  className?: string;
}

const RouteList = ({
  routes,
  selectedRouteId,
  onRouteSelect,
  className,
}: RouteListProps) => {
  // Helper function to get risk level
  const getRiskLevel = (
    score: number
  ): { level: "low" | "medium" | "high"; color: string; icon: React.ReactNode } => {
    if (score <= 3.3) {
      return {
        level: "low",
        color: "text-green-500 bg-green-100 dark:bg-green-950 dark:text-green-400",
        icon: <Check className="h-4 w-4" />,
      };
    } else if (score <= 6.6) {
      return {
        level: "medium",
        color: "text-yellow-500 bg-yellow-100 dark:bg-yellow-950 dark:text-yellow-400",
        icon: <AlertTriangle className="h-4 w-4" />,
      };
    } else {
      return {
        level: "high",
        color: "text-red-500 bg-red-100 dark:bg-red-950 dark:text-red-400",
        icon: <AlertTriangle className="h-4 w-4" />,
      };
    }
  };

  if (!routes || routes.length === 0) {
    return (
      <div className={cn("text-center py-8", className)}>
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted">
          <RouteIcon className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-lg font-medium">No Routes Available</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter a source and destination to view route options.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      <h2 className="text-xl font-semibold">Available Routes</h2>
      <div className="space-y-4">
        {routes.map((route) => {
          const { level, color, icon } = getRiskLevel(route.riskScore);
          const isSelected = route.id === selectedRouteId;

          return (
            <div
              key={route.id}
              className={cn(
                "bg-card rounded-2xl p-4 transition-all duration-300 ease-in-out border",
                isSelected
                  ? "border-primary shadow-md"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="flex items-center">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    isSelected ? "bg-primary/20" : "bg-primary/10"
                  )}
                >
                  <RouteIcon
                    className={cn(
                      "h-6 w-6",
                      isSelected ? "text-primary" : "text-primary/80"
                    )}
                  />
                </div>
                <div className="ml-4 flex-1">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-medium">Route {routes.indexOf(route) + 1}</h3>
                    <div className={cn("px-2 py-1 rounded-md text-xs font-medium flex items-center space-x-1", color)}>
                      {icon}
                      <span className="capitalize">{level} Risk</span>
                      <span className="ml-1">•</span>
                      <span>Score: {route.riskScore.toFixed(1)}/10</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-sm">
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 text-muted-foreground mr-1" />
                      <span>{route.distance}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-muted-foreground mr-1" />
                      <span>{route.duration}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => onRouteSelect(route.id)}
                >
                  {isSelected ? "Selected" : "Select"}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RouteList; 