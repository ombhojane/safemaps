import { useState, useEffect, useRef } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { toast } from "sonner";
import { Search, Navigation, ArrowRight, MapPin, Shield, Locate } from "lucide-react";
import { Location } from "@/types";
import { cn } from "@/lib/utils";
import { PlaceAutocomplete } from "@/components/ui/PlaceAutocomplete";
import { getPlaceDetails, convertToLocation } from "@/services/placesService";

const formSchema = z.object({
  source: z.string().min(2, {
    message: "Source must be at least 2 characters.",
  }),
  destination: z.string().min(2, {
    message: "Destination must be at least 2 characters.",
  }),
});

interface RouteFormProps {
  onSubmit: (source: Location, destination: Location) => void;
  isLoading?: boolean;
  onSourceLocationChange?: (location: Location | null) => void;
}

const RouteForm = ({ onSubmit, isLoading, onSourceLocationChange }: RouteFormProps) => {
  const [sourcePlaceId, setSourcePlaceId] = useState<string | undefined>();
  const [destinationPlaceId, setDestinationPlaceId] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSourceInput, setShowSourceInput] = useState(false);
  const [currentLocationLoading, setCurrentLocationLoading] = useState(false);
  const destinationInputRef = useRef<HTMLDivElement>(null);
  const sourceInputRef = useRef<HTMLDivElement>(null);
  const [currentLocation, setCurrentLocation] = useState<Location | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      destination: "",
    },
  });

  // Auto-focus destination input on mobile
  useEffect(() => {
    // Use a small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      if (destinationInputRef.current) {
        const input = destinationInputRef.current.querySelector('input');
        if (input && window.innerWidth < 768) {
          input.focus();
        }
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, []);

  // Notify parent component when current location changes
  useEffect(() => {
    if (onSourceLocationChange && currentLocation) {
      onSourceLocationChange(currentLocation);
    }
  }, [currentLocation, onSourceLocationChange]);

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsProcessing(true);
      
      let sourceLocation: Location | null = currentLocation;
      let destinationLocation: Location | null = null;
      
      // If we have placeIds and no current location, get detailed information from Google Places API
      if (sourcePlaceId && !currentLocation) {
        const sourceDetails = await getPlaceDetails(sourcePlaceId);
        if (sourceDetails) {
          sourceLocation = convertToLocation(sourceDetails);
        }
      }
      
      if (destinationPlaceId) {
        const destinationDetails = await getPlaceDetails(destinationPlaceId);
        if (destinationDetails) {
          destinationLocation = convertToLocation(destinationDetails);
        }
      }
      
      // If we couldn't get detailed location info, use fallback coordinates
      if (!sourceLocation) {
        sourceLocation = {
          name: values.source,
          coordinates: { lat: 37.7749, lng: -122.4194 } // San Francisco coordinates as fallback
        };
      }
      
      if (!destinationLocation) {
        destinationLocation = {
          name: values.destination,
          coordinates: { lat: 37.7833, lng: -122.4167 } // Slightly north of SF as fallback
        };
      }
      
      toast.success("Finding safe routes");
      onSubmit(sourceLocation, destinationLocation);
    } catch (error) {
      console.error("Error processing route request:", error);
      toast.error("Failed to process route request. Please try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle place selection from autocomplete
  const handleSourceSelect = (value: string, placeId?: string) => {
    form.setValue("source", value);
    setSourcePlaceId(placeId);
    
    // Reset current location when user selects a different source
    if (currentLocation) {
      setCurrentLocation(null);
    }
    
    // Auto-submit when both inputs are filled
    if (form.getValues("destination") && placeId) {
      setTimeout(() => form.handleSubmit(handleSubmit)(), 300);
    }
  };
  
  const handleDestinationSelect = (value: string, placeId?: string) => {
    form.setValue("destination", value);
    setDestinationPlaceId(placeId);
    
    // Show source input when destination is selected
    if (value && !showSourceInput) {
      setShowSourceInput(true);
      
      // Focus the source input after a short delay
      setTimeout(() => {
        if (sourceInputRef.current) {
          const input = sourceInputRef.current.querySelector('input');
          if (input) {
            input.focus();
          }
        }
      }, 100);
    }
  };
  
  const useCurrentLocation = async () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }
    
    setCurrentLocationLoading(true);
    
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          // Reverse geocode to get address from coordinates
          const response = await fetch(
            `https://maps.googleapis.com/maps/api/geocode/json?latlng=${position.coords.latitude},${position.coords.longitude}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
          );
          
          if (!response.ok) {
            throw new Error('Failed to get address from coordinates');
          }
          
          const data = await response.json();
          
          if (data.results && data.results.length > 0) {
            const address = data.results[0].formatted_address;
            form.setValue("source", address);
            
            // Store current location
            const newLocation: Location = {
              name: address,
              coordinates: {
                lat: position.coords.latitude,
                lng: position.coords.longitude
              }
            };
            
            setCurrentLocation(newLocation);
            
            toast.success("Current location detected");
            
            // Auto-submit if destination is also set
            if (form.getValues("destination") && destinationPlaceId) {
              setTimeout(() => form.handleSubmit(handleSubmit)(), 300);
            }
          }
        } catch (error) {
          console.error("Error getting current location:", error);
          toast.error("Failed to get your current location");
        } finally {
          setCurrentLocationLoading(false);
        }
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast.error("Failed to get your location. Please check your location permissions.");
        setCurrentLocationLoading(false);
      }
    );
  };

  return (
    <div className="bg-background/95 backdrop-blur-md rounded-md shadow-md overflow-hidden">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-3 p-3">
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-center">
              <MapPin className="h-5 w-5 text-primary mt-2" />
              <div ref={sourceInputRef}>
                <PlaceAutocomplete
                  value={form.watch("source")}
                  onChange={(value, placeId) => {
                    form.setValue("source", value);
                    setSourcePlaceId(placeId);
                    // Reset current location when typing
                    if (currentLocation) {
                      setCurrentLocation(null);
                    }
                  }}
                  placeholder="Starting point"
                  disabled={isLoading || isProcessing || currentLocationLoading}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 rounded-full"
                onClick={useCurrentLocation}
                disabled={isLoading || isProcessing || currentLocationLoading}
              >
                {currentLocationLoading ? (
                  <div className="h-4 w-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Locate className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-[auto_1fr] gap-2 items-center">
            <MapPin className="h-5 w-5 text-destructive mt-2" />
            <div ref={destinationInputRef}>
              <PlaceAutocomplete
                value={form.watch("destination")}
                onChange={(value, placeId) => {
                  form.setValue("destination", value);
                  setDestinationPlaceId(placeId);
                }}
                placeholder="Destination"
                disabled={isLoading || isProcessing}
              />
            </div>
          </div>
          
          <Button 
            type="submit" 
            className="w-full"
            size="lg"
            disabled={isLoading || isProcessing || !(form.watch("source") && form.watch("destination"))}
          >
            {isLoading || isProcessing ? (
              <>
                <span className="h-5 w-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2"></span>
                Finding Safe Routes...
              </>
            ) : (
              <>
                <Shield className="h-5 w-5 mr-2" />
                Find Safe Routes
              </>
            )}
          </Button>
        </form>
      </Form>
    </div>
  );
};

export default RouteForm;
