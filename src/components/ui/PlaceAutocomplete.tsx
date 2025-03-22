import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPlaceSuggestions } from "@/services/placesService";
import { Loader2, MapPin, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface AutocompleteResult {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

interface PlaceAutocompleteProps {
  value: string;
  onChange: (value: string, placeId?: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  onSearch?: () => void; // Optional callback when search is triggered
}

export function PlaceAutocomplete({
  value,
  onChange,
  placeholder = "Search for a location...",
  className,
  disabled = false,
  onSearch,
}: PlaceAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const minCharsForSearch = 3;

  // Sync input value with external value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Fetch suggestions function
  const fetchSuggestions = async (searchText: string) => {
    if (searchText.length < minCharsForSearch) {
      setSuggestions([]);
      return;
    }

    setLoading(true);
    
    try {
      const results = await getPlaceSuggestions(searchText);
      console.log("Search results for:", searchText, results);
      
      setSuggestions(results);
      
      // Only open dropdown if we have results
      if (results.length > 0) {
        setOpen(true);
      } else {
        setOpen(false);
      }
    } catch (error) {
      console.error("Error fetching suggestions:", error);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Clear the place ID when user types
    if (selectedPlaceId) {
      setSelectedPlaceId(undefined);
    }
    
    // Update parent component
    onChange(newValue);
    
    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Close popover if input is less than min chars
    if (newValue.length < minCharsForSearch) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    
    // Set up debounced search for better UX
    debounceTimerRef.current = setTimeout(() => {
      if (newValue.length >= minCharsForSearch) {
        fetchSuggestions(newValue);
      }
    }, 500);
  };

  const handleSelectPlace = (suggestion: AutocompleteResult) => {
    setInputValue(suggestion.fullText);
    setSelectedPlaceId(suggestion.placeId);
    onChange(suggestion.fullText, suggestion.placeId);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Enter key to trigger search
    if (e.key === "Enter" && inputValue.length >= minCharsForSearch) {
      e.preventDefault(); // Prevent form submission
      
      // If we have suggestions open, select the first one
      if (open && suggestions.length > 0) {
        handleSelectPlace(suggestions[0]);
      } else {
        fetchSuggestions(inputValue);
      }
    }
    
    // Handle Escape key to close the popover
    if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("w-full", className)}
            disabled={disabled}
            autoComplete="off"
          />
          {loading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : inputValue.length > 0 ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : null}
        </div>
      </PopoverTrigger>
      
      <PopoverContent 
        className="p-0 w-[var(--radix-popover-trigger-width)] max-h-[300px] overflow-y-auto" 
        align="start"
        sideOffset={5}
      >
        <div className="overflow-hidden">
          {suggestions.map((suggestion, index) => (
            <div
              key={suggestion.placeId}
              className={cn(
                "flex items-center p-3 cursor-pointer hover:bg-slate-50",
                index < suggestions.length - 1 && "border-b border-slate-100"
              )}
              onClick={() => handleSelectPlace(suggestion)}
            >
              {index === 0 ? (
                <div className="flex-shrink-0 mr-4">
                  <ArrowRight size={20} className="text-gray-500" />
                </div>
              ) : (
                <div className="flex-shrink-0 mr-4">
                  <MapPin size={20} className="text-gray-500" />
                </div>
              )}
              
              <div className="flex flex-col min-w-0">
                <div className="text-[15px] font-medium text-gray-900 leading-tight">
                  {suggestion.mainText}
                </div>
                <div className="text-[13px] text-gray-500 mt-0.5 leading-tight">
                  {suggestion.secondaryText}
                </div>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
} 