import { useState, useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { toast } from "sonner";
import { Search, MapPin, ArrowRight } from "lucide-react";
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
  const [expanded, setExpanded] = useState(false);
  const [sourcePlaceId, setSourcePlaceId] = useState<string | undefined>();
  const [destinationPlaceId, setDestinationPlaceId] = useState<string | undefined>();
  const [isProcessing, setIsProcessing] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      destination: "",
    },
  });

  const handleSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      setIsProcessing(true);
      
      let sourceLocation: Location | null = null;
      let destinationLocation: Location | null = null;
      
      // If we have placeIds, get detailed information from Google Places API
      if (sourcePlaceId) {
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
      
      toast.success("Route request submitted");
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
  };
  
  const handleDestinationSelect = (value: string, placeId?: string) => {
    form.setValue("destination", value);
    setDestinationPlaceId(placeId);
  };

  return (
    <div 
      className={cn(
        "bg-card rounded-2xl p-4 sm:p-6 transition-all duration-300 ease-in-out",
        expanded ? "shadow-md" : ""
      )}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
          <div 
            className="flex items-center cursor-pointer"
            onClick={() => !expanded && setExpanded(true)}
          >
            <Search className="h-5 w-5 text-muted-foreground mr-2" />
            <h2 className="text-lg font-medium">Find Safe Routes</h2>
          </div>
          
          {expanded && (
            <div className="space-y-4 animate-once animate-fade-in">
              <div className="relative">
                <div className="absolute left-7 top-0 bottom-0 w-0.5 bg-muted z-10"></div>
                
                <FormField
                  control={form.control}
                  name="source"
                  render={({ field }) => (
                    <FormItem className="relative mb-5">
                      <div className="flex items-center">
                        <div className="absolute left-0 z-20">
                          <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                            <MapPin className="h-6 w-6 text-primary" />
                          </div>
                        </div>
                        <div className="ml-16 flex-1">
                          <FormLabel>Starting point</FormLabel>
                          <FormControl>
                            <PlaceAutocomplete 
                              value={field.value}
                              onChange={handleSourceSelect}
                              placeholder="Enter your starting location" 
                              disabled={isLoading || isProcessing}
                            />
                          </FormControl>
                        </div>
                      </div>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="destination"
                  render={({ field }) => (
                    <FormItem className="relative">
                      <div className="flex items-center">
                        <div className="absolute left-0 z-20">
                          <div className="w-14 h-14 rounded-full bg-accent flex items-center justify-center">
                            <ArrowRight className="h-6 w-6 text-accent-foreground" />
                          </div>
                        </div>
                        <div className="ml-16 flex-1">
                          <FormLabel>Destination</FormLabel>
                          <FormControl>
                            <PlaceAutocomplete 
                              value={field.value}
                              onChange={handleDestinationSelect}
                              placeholder="Enter your destination" 
                              disabled={isLoading || isProcessing}
                            />
                          </FormControl>
                        </div>
                      </div>
                    </FormItem>
                  )}
                />
              </div>
              
              <div className="flex justify-end">
                <Button 
                  type="submit" 
                  className="px-8"
                  disabled={isLoading || isProcessing}
                >
                  {isLoading || isProcessing ? (
                    <>
                      <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                      Analyzing Routes...
                    </>
                  ) : "Find Safe Routes"}
                </Button>
              </div>
            </div>
          )}
        </form>
      </Form>
    </div>
  );
};

export default RouteForm;
