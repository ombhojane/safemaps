import { Location } from "@/types";

interface AutocompleteResult {
  placeId: string;
  mainText: string;
  secondaryText: string;
  fullText: string;
}

interface PlaceDetails {
  name: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  placeId: string;
  formattedAddress: string;
}

// Simple in-memory cache for requests
interface CacheEntry {
  data: any;
  timestamp: number;
}

const cache: Record<string, CacheEntry> = {};
const CACHE_EXPIRY = 5 * 60 * 1000; // 5 minutes

// Set a default location bias for San Francisco
const DEFAULT_LOCATION_BIAS = {
  circle: {
    center: {
      latitude: 37.7749,
      longitude: -122.4194
    },
    radius: 10000 // 10km radius around San Francisco
  }
};

// Get API key from environment variables
const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

// Check cache for a value or fetch it
const getOrFetchData = async (
  cacheKey: string, 
  fetchFn: () => Promise<any>
): Promise<any> => {
  // Check if we have a cached value that's still valid
  const cachedData = cache[cacheKey];
  const now = Date.now();
  
  if (cachedData && now - cachedData.timestamp < CACHE_EXPIRY) {
    return cachedData.data;
  }
  
  // Fetch new data
  try {
    const data = await fetchFn();
    
    // Cache the result
    cache[cacheKey] = {
      data,
      timestamp: now
    };
    
    return data;
  } catch (error) {
    // If the cache has expired but we still have data, use it as fallback
    if (cachedData) {
      console.warn('Error fetching fresh data, using expired cache:', error);
      return cachedData.data;
    }
    
    throw error;
  }
};

export const getPlaceSuggestions = async (input: string): Promise<AutocompleteResult[]> => {
  try {
    if (!input || input.length < 2) return [];
    
    const cacheKey = `autocomplete:${input.toLowerCase()}`;
    
    return getOrFetchData(cacheKey, async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(`https://places.googleapis.com/v1/places:autocomplete`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': API_KEY,
          },
          body: JSON.stringify({
            input,
            locationBias: DEFAULT_LOCATION_BIAS
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Places API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data.suggestions || !Array.isArray(data.suggestions)) {
          return [];
        }
        
        return data.suggestions.map((suggestion: any) => ({
          placeId: suggestion.placePrediction.placeId,
          mainText: suggestion.placePrediction.structuredFormat.mainText.text,
          secondaryText: suggestion.placePrediction.structuredFormat.secondaryText.text,
          fullText: suggestion.placePrediction.text.text
        }));
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === "AbortError") {
          throw new Error("Place suggestions request timed out");
        }
        
        throw error;
      }
    });
  } catch (error) {
    console.error("Error fetching place suggestions:", error);
    return [];
  }
};

export const getPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
  try {
    const cacheKey = `placedetails:${placeId}`;
    
    return getOrFetchData(cacheKey, async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      try {
        const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': API_KEY,
            'X-Goog-FieldMask': 'displayName,formattedAddress,location',
          },
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Places API error: ${response.status} - ${errorText}`);
        }
        
        const data = await response.json();
        
        return {
          name: data.displayName?.text || "",
          coordinates: {
            lat: data.location?.latitude || 0,
            lng: data.location?.longitude || 0
          },
          placeId: placeId,
          formattedAddress: data.formattedAddress || ""
        };
      } catch (error) {
        clearTimeout(timeoutId);
        
        if (error.name === "AbortError") {
          throw new Error("Place details request timed out");
        }
        
        throw error;
      }
    });
  } catch (error) {
    console.error("Error fetching place details:", error);
    return null;
  }
};

export const convertToLocation = (placeDetails: PlaceDetails): Location => {
  return {
    name: placeDetails.formattedAddress || placeDetails.name,
    coordinates: placeDetails.coordinates
  };
}; 