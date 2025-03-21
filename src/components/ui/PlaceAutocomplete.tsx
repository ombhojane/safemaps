import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getPlaceSuggestions } from "@/services/placesService";
import { Loader2 } from "lucide-react";
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

  // Sync input value with external value
  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value);
    }
  }, [value]);

  // Fetch suggestions when input changes
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (inputValue.length >= 2) {
      setLoading(true);
      
      debounceTimerRef.current = setTimeout(async () => {
        const results = await getPlaceSuggestions(inputValue);
        setSuggestions(results);
        setLoading(false);
      }, 300);
    } else {
      setSuggestions([]);
    }

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [inputValue]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    setSelectedPlaceId(undefined);
    onChange(newValue);
  };

  const handleSelectPlace = (suggestion: AutocompleteResult) => {
    setInputValue(suggestion.fullText);
    setSelectedPlaceId(suggestion.placeId);
    onChange(suggestion.fullText, suggestion.placeId);
    setOpen(false);
  };

  return (
    <Popover open={open && suggestions.length > 0} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative w-full">
          <Input
            value={inputValue}
            onChange={handleInputChange}
            placeholder={placeholder}
            className={cn("w-full", className)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            disabled={disabled}
          />
          {loading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)]" align="start">
        <Command>
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {suggestions.map((suggestion) => (
                <CommandItem
                  key={suggestion.placeId}
                  onSelect={() => handleSelectPlace(suggestion)}
                  className="flex flex-col items-start"
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