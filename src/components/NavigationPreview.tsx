import React from "react";
import { Route } from "@/types";
import { Button } from "@/components/ui/button";
import { Navigation, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavigationPreviewProps {
  route: Route;
  onStartNavigation: () => void;
  onCancel: () => void;
  className?: string;
}

/**
 * NavigationPreview component 
 * Shows a preview of the navigation with route information
 * and a button to start turn-by-turn navigation
 */
const NavigationPreview = ({
  route,
  onStartNavigation,
  onCancel,
  className
}: NavigationPreviewProps) => {
  if (!route) return null;
  
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
    <div className={cn("bg-white rounded-lg border border-green-100 shadow-md p-4", className)}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Navigation Preview</h3>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onCancel}
        >
          Close
        </Button>
      </div>
      
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
            <span className="text-green-600 text-sm font-medium">A</span>
          </div>
          <p className="text-sm font-medium">{route.origin.name}</p>
        </div>
        
        <div className="ml-4 border-l-2 border-dashed border-green-200 h-6"></div>
        
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-medium">B</span>
          </div>
          <p className="text-sm font-medium">{route.destination.name}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-3 gap-2 mb-4 text-center">
        <div className="bg-green-50 p-2 rounded-lg">
          <p className="text-xs text-green-700">Distance</p>
          <p className="font-medium">{route.distance}</p>
        </div>
        <div className="bg-green-50 p-2 rounded-lg">
          <p className="text-xs text-green-700">Duration</p>
          <p className="font-medium">{route.duration}</p>
        </div>
        <div className="bg-green-50 p-2 rounded-lg">
          <p className="text-xs text-green-700">Safety</p>
          <p className={cn(
            "font-medium",
            route.riskScore && route.riskScore <= 3.3 
              ? "text-green-600" 
              : route.riskScore && route.riskScore <= 6.6 
                ? "text-yellow-600"
                : "text-red-600"
          )}>
            {route.riskScore && route.riskScore <= 3.3 
              ? "Safe" 
              : route.riskScore && route.riskScore <= 6.6 
                ? "Moderate"
                : "Caution"}
          </p>
        </div>
      </div>
      
      <Button 
        className="w-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
        onClick={onStartNavigation}
      >
        Start Navigation
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
};

export default NavigationPreview; 