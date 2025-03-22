import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem } from "@/components/ui/form";
import { toast } from "sonner";
import { Search, Navigation, ArrowRight, MapPin } from "lucide-react";
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
}

const RouteForm = ({ onSubmit, isLoading }: RouteFormProps) => {
  const [sourcePlaceId, setSourcePlaceId] = useState<string | undefined>();
  const [destinationPlaceId, setDestinationPlaceId] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeInput, setActiveInput] = useState<'source' | 'destination' | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      destination: "",
    },
  });

  // Check if we can enable the find routes button
  const canSubmit = Boolean(
    form.watch("source") && 
    form.watch("destination") && 
    !isLoading && 
    !isProcessing
  );

  // For mobile devices, always show both inputs for better UX
  const showSourceInput = true;

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      // Don't proceed if already processing or loading
      if (isProcessing || isLoading) return;
      
      setIsProcessing(true);
      
      let sourceLocation: Location | null = null;
      let destinationLocation: Location | null = null;
      
      // Get detailed information from selected places - run in parallel
      const [sourceDetails, destinationDetails] = await Promise.all([
        sourcePlaceId ? getPlaceDetails(sourcePlaceId) : null,
        destinationPlaceId ? getPlaceDetails(destinationPlaceId) : null
      ]);
      
      if (sourceDetails) {
        sourceLocation = convertToLocation(sourceDetails);
      }
      
      if (destinationDetails) {
        destinationLocation = convertToLocation(destinationDetails);
      }
      
      // If we couldn't get detailed location info, use fallback coordinates
      if (!sourceLocation) {
        // Use a reasonable fallback
        sourceLocation = {
          name: values.source,
          coordinates: { lat: 37.7749, lng: -122.4194 } 
        };
      }
      
      if (!destinationLocation) {
        // Slightly different fallback coordinates
        destinationLocation = {
          name: values.destination,
          coordinates: { lat: 37.7833, lng: -122.4167 } 
        };
      }
      
      toast.success("Finding the safest routes for you");
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
    form.setValue("source", value, { shouldValidate: true });
    setSourcePlaceId(placeId);
    // If we have a destination, focus away from the input to avoid keyboard issues on mobile
    if (form.watch("destination")) {
      setActiveInput(null);
    }
  };
  
  const handleDestinationSelect = (value: string, placeId?: string) => {
    form.setValue("destination", value, { shouldValidate: true });
    setDestinationPlaceId(placeId);
    // If we have a source, focus away from the input to avoid keyboard issues on mobile
    if (form.watch("source")) {
      setActiveInput(null);
    }
  };

  const handleFocus = (inputName: 'source' | 'destination') => {
    setActiveInput(inputName);
  };

  return (
    <div className="bg-background/95 backdrop-blur-md rounded-md shadow-md overflow-hidden">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)}>
          <div className="flex flex-col">
            {/* Destination Input (Always shown) */}
            <FormField
              control={form.control}
              name="destination"
              render={({ field }) => (
                <FormItem className="mb-0">
                  <div className="flex items-center px-3 py-2">
                    <MapPin className="h-4 w-4 text-muted-foreground mr-2" />
                    <FormControl>
                      <PlaceAutocomplete 
                        value={field.value}
                        onChange={handleDestinationSelect}
                        placeholder="Where to?" 
                        disabled={isLoading || isProcessing}
                        className="h-9 w-full border-none shadow-none focus-visible:ring-0 focus-visible:ring-transparent"
                      />
                    </FormControl>
                  </div>
                </FormItem>
              )}
            />
            
            {/* Source Input */}
            {showSourceInput && (
              <div className="border-t">
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem className="mb-0">
                      <div className="flex items-center px-3 py-2">
                        <ArrowRight className="h-4 w-4 text-muted-foreground mr-2" />
                        <FormControl>
                          <PlaceAutocomplete 
                            value={field.value}
                            onChange={handleSourceSelect}
                            placeholder="Current location or starting point" 
                            disabled={isLoading || isProcessing}
                            className="h-9 w-full border-none shadow-none focus-visible:ring-0 focus-visible:ring-transparent"
                          />
                        </FormControl>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
            )}
            
            {/* Directions Button - Only show when both fields have values */}
            {canSubmit && (
              <div className="p-3 border-t">
                <Button 
                  type="submit" 
                  className="w-full flex items-center justify-center"
                  disabled={isLoading || isProcessing}
                >
                  {isLoading || isProcessing ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                      Finding routes...
                    </>
                  ) : (
                    <>
                      <Navigation className="h-4 w-4 mr-2" />
                      Find Safe Routes
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
};

export default RouteForm;
