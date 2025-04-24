import { Route } from "@/types";
import { Button } from "./ui/button";
import { Navigation, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationPreviewProps {
  route: Route;
  onStartNavigation: () => void;
  className?: string;
}

/**
 * NavigationPreview component 
 * Shows a preview of the navigation with route information
 * and a button to start turn-by-turn navigation
 */
const NavigationPreview = ({ route, onStartNavigation, className }: NavigationPreviewProps) => {
  // Format estimated time of arrival
  const calculateETA = (): string => {
    // Extract duration in minutes from route
    let minutes = 0;
    const durationMatch = route.duration.match(/(\d+) min/);
    if (durationMatch && durationMatch[1]) {
      minutes = parseInt(durationMatch[1]);
    }
    
    // Calculate ETA
    const now = new Date();
    const eta = new Date(now.getTime() + minutes * 60 * 1000);
    
    return eta.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  return (
    <div className={cn("p-4 bg-card border rounded-lg shadow-sm", className)}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Start Navigation</h3>
          <p className="text-sm text-muted-foreground">
            Turn-by-turn directions to your destination
          </p>
        </div>
        <div className="bg-primary/10 p-2 rounded-full">
          <Navigation className="h-6 w-6 text-primary" />
        </div>
      </div>
      
      <div className="space-y-3 mb-4">
        <div className="flex justify-between">
          <span className="text-sm">Distance:</span>
          <span className="font-medium">{route.distance}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm">Duration:</span>
          <span className="font-medium">{route.duration}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm">ETA:</span>
          <span className="font-medium">{calculateETA()}</span>
        </div>
        {route.riskScore !== undefined && (
          <div className="flex justify-between">
            <span className="text-sm">Safety Score:</span>
            <span className="font-medium">
              {route.riskScore <= 3.3 ? "Safe" : route.riskScore <= 6.6 ? "Moderate" : "Caution"}
            </span>
          </div>
        )}
      </div>
      
      <Button 
        className="w-full" 
        onClick={onStartNavigation}
      >
        Start Navigation
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
};

export default NavigationPreview; 