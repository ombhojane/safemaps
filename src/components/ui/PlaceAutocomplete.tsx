import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPlaceSuggestions } from "@/services/placesService";
import { Loader2, MapPin } from "lucide-react";
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
}

export function PlaceAutocomplete({
  value,
  onChange,
  placeholder = "Search for a location...",
  className,
  disabled = false,
}: PlaceAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || "");
  const [suggestions, setSuggestions] = useState<AutocompleteResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | undefined>(undefined);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(true);

  // Track mounting state to prevent state updates after unmount
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Sync input value with external value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Debounced fetch suggestions function
  const debounceFetchSuggestions = useCallback(async (searchText: string) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (searchText.length < 2) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    
    debounceTimerRef.current = setTimeout(async () => {
      try {
        const results = await getPlaceSuggestions(searchText);
        
        if (isMounted.current) {
          setSuggestions(results);
          
          // Open the popover automatically if we have results
          if (results.length > 0 && inputRef.current === document.activeElement) {
            setOpen(true);
          } else if (results.length === 0) {
            setOpen(false);
          }
        }
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    }, 250); // Reduced debounce time for more responsiveness
  }, []);

  // Fetch suggestions when input changes
  useEffect(() => {
    debounceFetchSuggestions(inputValue);
  }, [inputValue, debounceFetchSuggestions]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    
    // Clear the place ID when the user modifies the input
    if (selectedPlaceId) {
      setSelectedPlaceId(undefined);
      onChange(newValue);
    } else {
      onChange(newValue);
    }
  };

  const handleSelectPlace = (suggestion: AutocompleteResult) => {
    setInputValue(suggestion.fullText);
    setSelectedPlaceId(suggestion.placeId);
    onChange(suggestion.fullText, suggestion.placeId);
    setOpen(false);
    
    // Give focus back to the input after selection
    setTimeout(() => {
      inputRef.current?.focus();
    }, 0);
  };

  const handleInputFocus = () => {
    // Only show suggestions if we have them and the input has a value
    if (inputValue.length >= 2) {
      // If we don't have suggestions yet but have an input value, try to fetch them
      if (suggestions.length === 0 && !loading) {
        debounceFetchSuggestions(inputValue);
      } else if (suggestions.length > 0) {
        setOpen(true);
      }
    }
  };

  const handleInputBlur = () => {
    // Use a small delay before closing to allow for selection clicks
    setTimeout(() => {
      if (document.activeElement !== inputRef.current) {
        setOpen(false);
      }
    }, 150);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Handle Escape key to close the popover
    if (e.key === "Escape") {
      setOpen(false);
      e.preventDefault();
    }
    
    // If down arrow is pressed and suggestions are available, open the popover
    if (e.key === "ArrowDown" && suggestions.length > 0) {
      setOpen(true);
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
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={cn("w-full pr-8", className)}
            disabled={disabled}
            autoComplete="off"
          />
          {loading ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : inputValue ? (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
            </div>
          ) : null}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="p-0 w-[var(--radix-popover-trigger-width)]" 
        align="start"
        sideOffset={4}
      >
        <Command>
          <CommandList>
            <CommandEmpty>No results found</CommandEmpty>
            <CommandGroup>
              {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.placeId}
                  onSelect={() => handleSelectPlace(suggestion)}
                  className="flex flex-col items-start py-2"
                >
                  <div className="font-medium">{suggestion.mainText}</div>
                  <div className="text-sm text-muted-foreground">{suggestion.secondaryText}</div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
} 