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
  Timer,
  MapPin,
  Search,
  Share2,
  Plus,
  Menu,
  AlertTriangle
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
  toggleVoiceGuidance,
  requestLocationPermission
} from "@/services/navigationService";
import { toast } from "sonner";

interface NavigationViewProps {
  route: Route;
  onClose: () => void;
}

const NavigationView = ({ route, onClose }: NavigationViewProps) => {
  const [navigationState, setNavigationState] = useState<NavigationState | null>(null);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isBottomSheetExpanded, setIsBottomSheetExpanded] = useState(false);
  const [isBottomMenuOpen, setIsBottomMenuOpen] = useState(false);
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  
  // Request location permission and start navigation
  useEffect(() => {
    const initializeNavigation = async () => {
      setIsRequestingLocation(true);
      
      // Request location permission first
      const hasPermission = await requestLocationPermission();
      
      if (hasPermission) {
        // Start navigation if permission granted
        const initialState = startNavigation(route);
        setNavigationState(initialState);
        
        // Show success toast
        toast.success("Navigation started");
      } else {
        // Show error if permission denied
        toast.error("Location access denied. Please enable location services to navigate.");
        setNavigationState({
          status: NavigationStatus.ERROR,
          currentRoute: route,
          currentPosition: null,
          currentStep: null,
          nextStep: null,
          distanceToNextTurn: 0,
          distanceToDestination: 0,
          estimatedArrivalTime: null,
          remainingDuration: 0,
          isOffRoute: false,
          navigationProgress: 0,
          lastReroute: null
        });
      }
      
      setIsRequestingLocation(false);
    };
    
    initializeNavigation();
    
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
  
  // Handle manually requesting location if initial attempt failed
  const handleRequestLocation = async () => {
    setIsRequestingLocation(true);
    
    const hasPermission = await requestLocationPermission();
    
    if (hasPermission) {
      const initialState = startNavigation(route);
      setNavigationState(initialState);
      toast.success("Location access granted");
    } else {
      toast.error("Location access denied. Please enable location in your browser settings.");
    }
    
    setIsRequestingLocation(false);
  };
  
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

  // Toggle bottom menu
  const toggleBottomMenu = () => {
    setIsBottomMenuOpen(!isBottomMenuOpen);
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
          
          <div className="bg-green-600 text-white py-1 px-3 rounded-full shadow-md">
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
            onClick={toggleBottomMenu}
          >
            <Menu className="h-5 w-5" />
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
              <div className="relative">
                <div className="h-10 w-10 rounded-full flex items-center justify-center">
                  <svg className="w-10 h-10" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="16" fill="none" className="stroke-green-100" strokeWidth="2"></circle>
                    <circle 
                      cx="18" 
                      cy="18" 
                      r="16" 
                      fill="none" 
                      className="stroke-green-500" 
                      strokeWidth="2" 
                      strokeDasharray="100" 
                      strokeDashoffset={100 - (navigationState?.navigationProgress || 0)}
                      transform="rotate(-90 18 18)"
                    ></circle>
                  </svg>
                  <Clock className="h-4 w-4 text-green-600 absolute" />
                </div>
              </div>
              <div>
                <p className="text-xs text-green-800">
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
                  className="h-full bg-green-500 transition-all duration-500 ease-out"
                  style={{ width: `${navigationState?.navigationProgress || 0}%` }}
                ></div>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              className="text-green-600 flex items-center gap-1 p-0"
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
            <div className="bg-white rounded-xl p-4 shadow-sm mb-4 border border-green-100">
              {/* Direction with distance */}
              <div className="flex items-center mb-3">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mr-4 border-2 border-green-100">
                  <div className="h-10 w-10 text-green-600">
                    {getManeuverIcon(navigationState.currentStep.maneuver)}
                  </div>
                </div>
                
                <div className="flex-1">
                  <h3 className="text-2xl font-bold text-green-800">
                    {formatDistance(navigationState.distanceToNextTurn)}
                  </h3>
                  <p className="text-base">
                    {navigationState.currentStep.instruction}
                  </p>
                </div>
              </div>
              
              {/* Street name */}
              <div className="bg-green-50 rounded-lg py-2 px-3">
                <p className="text-sm font-medium text-green-800">
                  {navigationState.currentStep.streetName !== "Unknown Road" 
                    ? navigationState.currentStep.streetName 
                    : navigationState.currentRoute?.destination?.name 
                      ? `Heading toward ${navigationState.currentRoute.destination.name}`
                      : "Navigating..."}
                </p>
              </div>
            </div>
          )}
          
          {/* Next Instruction (only visible in expanded mode) */}
          {isBottomSheetExpanded && navigationState?.nextStep && (
            <div className="bg-green-50/50 rounded-xl p-3 mb-4 flex items-center border border-green-100">
              <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                <div className="h-6 w-6 text-green-600">
                  {getManeuverIcon(navigationState.nextStep.maneuver)}
                </div>
              </div>
              
              <div className="flex-1">
                <p className="text-sm text-green-700">Then</p>
                <p className="text-sm font-medium">
                  {navigationState.nextStep.instruction}
                </p>
                <p className="text-xs text-green-700">
                  {navigationState.nextStep.streetName !== "Unknown Road" 
                    ? navigationState.nextStep.streetName 
                    : "Continue on route"}
                </p>
              </div>
              
              <div className="text-right">
                <p className="text-sm font-medium text-green-700">
                  {formatDistance(navigationState.nextStep.distance)}
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
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={onClose}
              >
                End Navigation
              </Button>
            </div>
          )}
          
          {/* Error State with Location Request Button */}
          {navigationState?.status === NavigationStatus.ERROR && (
            <div className="flex flex-col items-center justify-center py-10 absolute inset-0 bg-background/80 backdrop-blur-sm z-30">
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mb-4">
                <div className="w-10 h-10 text-red-600">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                    <path fillRule="evenodd" d="M9.401 3.003c1.155-2 4.043-2 5.197 0l7.355 12.748c1.154 2-.29 4.5-2.599 4.5H4.645c-2.309 0-3.752-2.5-2.598-4.5L9.4 3.003zM12 8.25a.75.75 0 01.75.75v3.75a.75.75 0 01-1.5 0V9a.75.75 0 01.75-.75zm0 8.25a.75.75 0 100-1.5.75.75 0 000 1.5z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <h2 className="text-2xl font-bold mb-2">Location Required</h2>
              <p className="text-muted-foreground text-center max-w-xs mb-6">
                We couldn't determine your current location. Navigation requires access to your location.
              </p>
              <div className="space-y-3 w-full max-w-xs">
                <Button
                  className="w-full bg-green-600 hover:bg-green-700"
                  onClick={handleRequestLocation}
                  disabled={isRequestingLocation}
                >
                  {isRequestingLocation ? (
                    <>
                      <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></div>
                      Requesting Location...
                    </>
                  ) : (
                    <>
                      <MapPin className="h-4 w-4 mr-2" />
                      Enable Location
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={onClose}
                >
                  Cancel Navigation
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* New Bottom Navigation Menu (Google Maps style) */}
      {isBottomMenuOpen && (
        <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-xl z-20 shadow-lg">
          <div className="p-2 border-b">
            <Button variant="ghost" onClick={toggleBottomMenu} className="w-full flex justify-center py-2">
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
          <div className="grid divide-y">
            <Button variant="ghost" className="flex items-center justify-start gap-3 px-6 py-5 h-auto">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <span>Report incident</span>
              <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 ml-auto">New</span>
            </Button>
            <Button variant="ghost" className="flex items-center justify-start gap-3 px-6 py-5 h-auto">
              <Share2 className="h-5 w-5 text-green-600" />
              <span>Share trip progress</span>
              <span className="px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 ml-auto">New</span>
            </Button>
            <Button variant="ghost" className="flex items-center justify-start gap-3 px-6 py-5 h-auto">
              <Search className="h-5 w-5 text-green-600" />
              <span>Search along route</span>
            </Button>
            <Button variant="ghost" className="flex items-center justify-start gap-3 px-6 py-5 h-auto">
              <Menu className="h-5 w-5 text-green-600" />
              <span>Directions</span>
            </Button>
            <Button variant="ghost" className="flex items-center justify-start gap-3 px-6 py-5 h-auto">
              <Layers className="h-5 w-5 text-green-600" />
              <span>Map layers</span>
              <div className="ml-auto">
                <div className="w-10 h-6 rounded-full bg-gray-200 flex items-center px-1">
                  <div className="w-4 h-4 rounded-full bg-white"></div>
                </div>
              </div>
            </Button>
            <Button variant="ghost" className="flex items-center justify-start gap-3 px-6 py-5 h-auto">
              <Settings className="h-5 w-5 text-green-600" />
              <span>Settings</span>
            </Button>
          </div>
        </div>
      )}
      
      {/* New Floating Bottom Button (for re-centering) */}
      <div className="absolute bottom-32 right-4 z-10">
        <Button 
          className="h-12 w-12 rounded-full bg-white shadow-md flex items-center justify-center border border-gray-200"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z" fill="#1DB954"/>
          </svg>
        </Button>
      </div>
    </div>
  );
};

export default NavigationView; 