
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Search, MapPin, ArrowRight } from "lucide-react";
import { Location } from "@/types";

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

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      source: "",
      destination: "",
    },
  });

  const handleSubmit = (values: z.infer<typeof formSchema>) => {
    // In a real app, we would geocode these addresses to get coordinates
    // For this demo, we'll use dummy coordinates
    const source: Location = {
      name: values.source,
      coordinates: { lat: 37.7749, lng: -122.4194 } // San Francisco coordinates
    };
    
    const destination: Location = {
      name: values.destination,
      coordinates: { lat: 37.7833, lng: -122.4167 } // Slightly north of SF
    };
    
    toast.success("Route request submitted");
    onSubmit(source, destination);
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
                            <Input placeholder="Enter your starting location" {...field} />
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
                            <Input placeholder="Enter your destination" {...field} />
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
                  disabled={isLoading}
                >
                  {isLoading ? (
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

import { cn } from "@/lib/utils";

export default RouteForm;
