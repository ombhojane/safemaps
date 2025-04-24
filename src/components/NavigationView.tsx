import { useEffect, useState, useRef } from "react";
import { 
  ArrowUp, 
  ArrowRight, 
  ArrowLeft,
  X, 
  Volume2, 
  VolumeX, 
  Layers,
  Settings, 
  ChevronUp, 
  ChevronDown, 
  Clock,
  Timer
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Route } from "@/types";
import Map from "@/components/Map";
import { cn } from "@/lib/utils";
import { 
  NavigationStatus, 
  NavigationState, 
  NavigationManeuver,
  startNavigation, 
  stopNavigation,
  subscribeToNavigation,
  toggleVoiceGuidance
} from "@/services/navigationService";

interface NavigationViewProps {
  route: Route;
  onClose: () => void;
}

const NavigationView = ({ route, onClose }: NavigationViewProps) => {
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  
  // Start navigation when component mounts
  useEffect(() => {
    const initialState = startNavigation(route);
    setNavigationState(initialState);
    
    // Subscribe to navigation state updates
    const unsubscribe = subscribeToNavigation((newState) => {
      setNavigationState(newState);
    });
    
    // Clean up on unmount
    return () => {
      unsubscribe();
      stopNavigation();
    };
  }, [route]);
  
  // Handle voice mute toggle
  const handleVoiceToggle = () => {
    const newMutedState = !voiceMuted;
    setVoiceMuted(newMutedState);
    toggleVoiceGuidance();
  };
  
  // Format distance for display
  const formatDistance = (meters: number): string => {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    } else {
      return `${(meters / 1000).toFixed(1)} km`;
    }
  };
  
  // Format time remaining
  const formatTimeRemaining = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds} sec`;
    } else if (seconds < 3600) {
      return `${Math.floor(seconds / 60)} min`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} hr ${minutes} min`;
    }
  };
  
  // Get ETA as a formatted time string (e.g., "12:45 PM")
  const getFormattedETA = (): string => {
    if (!navigationState?.estimatedArrivalTime) return "--:--";
    
    return navigationState.estimatedArrivalTime.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  // Get maneuver icon and rotation
  const getManeuverIcon = (maneuver: NavigationManeuver) => {
    switch (maneuver) {
      case NavigationManeuver.TURN_RIGHT:
        return <ArrowRight className="text-primary transform rotate-90" />;
      case NavigationManeuver.TURN_LEFT:
        return <ArrowLeft className="text-primary transform -rotate-90" />;
      case NavigationManeuver.SLIGHT_RIGHT:
        return <ArrowRight className="text-primary transform rotate-45" />;
      case NavigationManeuver.SLIGHT_LEFT:
        return <ArrowLeft className="text-primary transform -rotate-45" />;
      case NavigationManeuver.SHARP_RIGHT:
        return <ArrowRight className="text-primary transform rotate-135" />;
      case NavigationManeuver.SHARP_LEFT:
        return <ArrowLeft className="text-primary transform -rotate-135" />;
      case NavigationManeuver.U_TURN:
        return <ArrowUp className="text-primary transform rotate-180" />;
      case NavigationManeuver.CONTINUE:
      case NavigationManeuver.STRAIGHT:
      default:
        return <ArrowUp className="text-primary" />;
    }
  };
  
  // Toggle bottom sheet expansion
  const toggleBottomSheet = () => {
    setIsBottomSheetExpanded(!isBottomSheetExpanded);
  };
  
  return (
    <div className="fixed inset-0 w-full h-full bg-background flex flex-col z-50">
      {/* Fullscreen Map */}
      <div className="absolute inset-0">
        <Map 
          ref={mapRef} 
          routes={[route]} 
          selectedRouteId={route.id}
          currentLocation={navigationState?.currentPosition ? {
            name: "Current Location",
            coordinates: {
              lat: navigationState.currentPosition.coords.latitude,
              lng: navigationState.currentPosition.coords.longitude
            }
          } : null}
          className="w-full h-full"
          isNavigationMode={true}
        />
      </div>
      
      {/* Top UI Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/90 backdrop-blur-sm shadow-md"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
          
          <div className="bg-background/90 backdrop-blur-sm py-1 px-3 rounded-full shadow-md">
            <p className="text-sm font-medium">
              ETA: {getFormattedETA()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/90 backdrop-blur-sm shadow-md"
            onClick={handleVoiceToggle}
          >
            {voiceMuted ? (
              <VolumeX className="h-5 w-5" />
            ) : (
              <Volume2 className="h-5 w-5" />
            )}
          </Button>
          
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full bg-background/90 backdrop-blur-sm shadow-md"
          >
            <Layers className="h-5 w-5" />
          </Button>
        </div>
      </div>
      
      {/* Bottom Sheet for Instructions */}
      <div 
        className={cn(
          "absolute left-0 right-0 bg-background/95 backdrop-blur-sm rounded-t-3xl shadow-lg z-10 transition-all duration-300 ease-in-out",
          isBottomSheetExpanded 
            ? "bottom-0 max-h-[70%] overflow-y-auto" 
            : "bottom-0 max-h-[220px]"
        )}
      >
        {/* Drag handle */}
        <div 
          className="flex justify-center py-2 cursor-pointer" 
          onClick={toggleBottomSheet}
        >
          <div className="w-12 h-1 bg-muted-foreground/30 rounded-full"></div>
        </div>
        
        {/* Navigation Instructions */}
        <div className="px-4 pb-safe">
          {/* Status and Progress */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 w-8 h-8 rounded-full flex items-center justify-center">
                <Clock className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">
                  {formatTimeRemaining(navigationState?.remainingDuration || 0)}
                </p>
                <p className="text-sm font-medium">
                  {formatDistance(navigationState?.distanceToDestination || 0)}
                </p>
              </div>
            </div>
            
            <div className="w-24">
              <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${navigationState?.navigationProgress || 0}%` }}
                ></div>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-primary flex items-center gap-1 p-0"
              onClick={toggleBottomSheet}
            >
              {isBottomSheetExpanded ? (
                <>Less <ChevronDown className="h-4 w-4" /></>
              ) : (
                <>More <ChevronUp className="h-4 w-4" /></>
              )}
            </Button>
          </div>
          
          {/* Main Instruction Card */}
          {navigationState?.currentStep && (
            <div className="bg-card rounded-xl p-4 shadow-sm mb-4">
              {/* Direction with distance */}
              <div className="flex items-center mb-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mr-4">
                  <div className="h-10 w-10">
                    {getManeuverIcon(navigationState.currentStep.maneuver)}
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">
                    {formatDistance(navigationState.distanceToNextTurn)}
                  </h3>
                  <p className="text-base">
                    {navigationState.currentStep.instruction}
                  </p>
                </div>
              </div>
              
              {/* Street name */}
              <div className="bg-muted/50 rounded-lg py-2 px-3">
                <p className="text-sm font-medium">
                  {navigationState.currentStep.streetName || "Unknown Road"}
                </p>
              </div>
            </div>
          )}
          
          {/* Next Instruction (only visible in expanded mode) */}
          {isBottomSheetExpanded && navigationState?.nextStep && (
            <div className="bg-muted/30 rounded-xl p-3 mb-4 flex items-center">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                <div className="h-6 w-6">
                  {getManeuverIcon(navigationState.nextStep.maneuver)}
                </div>
              </div>
              
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Then</p>
                <p className="text-sm font-medium">
                  {navigationState.nextStep.instruction}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-medium">
                  {formatDistance(navigationState.distanceToNextTurn)}
                </p>
              </div>
            </div>
          )}
          
          {/* Route Overview (only visible in expanded mode) */}
          {isBottomSheetExpanded && (
            <div className="space-y-3 mb-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">Total Distance</p>
                <p className="text-sm">{route.distance}</p>
              </div>
              
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">Estimated Time</p>
                <p className="text-sm">{route.duration}</p>
              </div>
              
              <div className="flex justify-between items-center">
                <p className="text-sm font-medium">Arrival Time</p>
                <p className="text-sm">{getFormattedETA()}</p>
              </div>
              
              {route.riskScore !== undefined && (
                <div className="flex justify-between items-center">
                  <p className="text-sm font-medium">Safety Score</p>
                  <div className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    route.riskScore <= 3.3 
                      ? "bg-green-100 text-green-800"
                      : route.riskScore <= 6.6
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-red-100 text-red-800"
                  )}>
                    {route.riskScore <= 3.3 ? "Safe" : route.riskScore <= 6.6 ? "Moderate" : "Caution"}
                  </div>
                </div>
              )}
            </div>
          )}
          
          {/* End Navigation Button (only visible in expanded mode) */}
          {isBottomSheetExpanded && (
            <Button 
              variant="destructive" 
              className="w-full mb-4"
              onClick={onClose}
            >
              End Navigation
            </Button>
          )}
          
          {/* Arrived State */}
          {navigationState?.status === NavigationStatus.ARRIVED && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <div className="w-10 h-10 text-green-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm3.97 6.97a.75.75 0 011.06 1.06l-5.25 5.25a.75.75 0 01-1.06 0l-2.25-2.25a.75.75 0 011.06-1.06l1.72 1.72 4.72-4.72z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-1">You have arrived</h2>
              <p className="text-muted-foreground mb-6">
                {route.destination.name}
              </p>
              <Button
                className="w-full"
                onClick={onClose}
              >
                End Navigation
              </Button>
            </div>
          )}
          
          {/* Error State */}
          {navigationState?.status === NavigationStatus.ERROR && (
            <div className="flex flex-col items-center justify-center py-10">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <div className="w-10 h-10 text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Navigation Error</h2>
              <p className="text-muted-foreground text-center max-w-xs mb-6">
                We couldn't determine your current location. Please check your GPS settings and try again.
              </p>
              <Button
                className="w-full"
                onClick={onClose}
              >
                End Navigation
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NavigationView; 