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

// Cache for storing previous API results to reduce redundant requests
interface Cache {
  suggestions: Record<string, { results: AutocompleteResult[], timestamp: number }>;
  details: Record<string, { result: PlaceDetails, timestamp: number }>;
}

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

// Initialize cache
const cache: Cache = {
  suggestions: {},
  details: {}
};

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

// Check if a cache entry is still valid
const isCacheValid = (timestamp: number): boolean => {
  return Date.now() - timestamp < CACHE_EXPIRATION;
};

export const getPlaceSuggestions = async (input: string): Promise<AutocompleteResult[]> => {
  try {
    // Ensure we have at least 3 characters before searching
    if (!input || input.length < 3) return [];
    
    // Normalize the input for caching (trim whitespace, lowercase)
    const normalizedInput = input.trim().toLowerCase();
    
    // Check cache for this input
    if (cache.suggestions[normalizedInput] && isCacheValid(cache.suggestions[normalizedInput].timestamp)) {
      console.log("[PlacesService] Returning cached results for:", normalizedInput, cache.suggestions[normalizedInput].results);
      return cache.suggestions[normalizedInput].results;
    }
    
    console.log("[PlacesService] Fetching suggestions for:", normalizedInput);
    
    // Add a small artificial delay to prevent flickering UI and improve user experience
    await new Promise(resolve => setTimeout(resolve, 300));
    
    const response = await fetch(`https://places.googleapis.com/v1/places:autocomplete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': API_KEY,
      },
      body: JSON.stringify({
        input,
        locationBias: DEFAULT_LOCATION_BIAS
      })
    });

    if (!response.ok) {
      console.error("[PlacesService] API error:", response.status, response.statusText);
      throw new Error(`Places API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[PlacesService] Raw API response:", data);
    
    if (!data.suggestions || !Array.isArray(data.suggestions)) {
      console.warn("[PlacesService] No suggestions found in API response");
      return [];
    }
    
    console.log("[PlacesService] Received suggestions count:", data.suggestions.length);
    
    // Process the results safely with error handling for each suggestion
    const results = data.suggestions
      .filter((suggestion: any) => {
        try {
          // Verify the suggestion has the required fields
          const isValid = suggestion?.placePrediction?.placeId && 
                 suggestion?.placePrediction?.structuredFormat?.mainText?.text &&
                 suggestion?.placePrediction?.structuredFormat?.secondaryText?.text;
          
          if (!isValid) {
            console.warn("[PlacesService] Filtered out invalid suggestion:", suggestion);
          }
          
          return isValid;
        } catch (e) {
          console.error("[PlacesService] Error processing suggestion:", e);
          return false;
        }
      })
      .map((suggestion: any) => {
        const result = {
          placeId: suggestion.placePrediction.placeId,
          mainText: suggestion.placePrediction.structuredFormat.mainText.text,
          secondaryText: suggestion.placePrediction.structuredFormat.secondaryText.text,
          fullText: suggestion.placePrediction.text.text || `${suggestion.placePrediction.structuredFormat.mainText.text}, ${suggestion.placePrediction.structuredFormat.secondaryText.text}`
        };
        
        return result;
      });
    
    console.log("[PlacesService] Processed results:", results);
    
    // Cache the results
    cache.suggestions[normalizedInput] = {
      results,
      timestamp: Date.now()
    };
    
    return results;
  } catch (error) {
    console.error("[PlacesService] Error fetching place suggestions:", error);
    return [];
  }
};

export const getPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
  try {
    // Check cache for this place ID
    if (cache.details[placeId] && isCacheValid(cache.details[placeId].timestamp)) {
      return cache.details[placeId].result;
    }
    
    const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}`, {
      method: 'GET',
      headers: {
        'X-Goog-Api-Key': API_KEY,
        'X-Goog-FieldMask': 'displayName,formattedAddress,location',
      },
    });

    if (!response.ok) {
      throw new Error(`Places API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Make sure we have the necessary data
    if (!data.displayName || !data.location) {
      throw new Error('Incomplete place details data');
    }
    
    const result = {
      name: data.displayName.text,
      coordinates: {
        lat: data.location.latitude,
        lng: data.location.longitude
      },
      placeId: placeId,
      formattedAddress: data.formattedAddress
    };
    
    // Cache the result
    cache.details[placeId] = {
      result,
      timestamp: Date.now()
    };
    
    return result;
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