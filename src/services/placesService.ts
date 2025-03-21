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

export const getPlaceSuggestions = async (input: string): Promise<AutocompleteResult[]> => {
  try {
    if (!input || input.length < 2) return [];
    
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
      throw new Error(`Places API error: ${response.status}`);
    }

    const data = await response.json();
    
    return data.suggestions.map((suggestion: any) => ({
      placeId: suggestion.placePrediction.placeId,
      mainText: suggestion.placePrediction.structuredFormat.mainText.text,
      secondaryText: suggestion.placePrediction.structuredFormat.secondaryText.text,
      fullText: suggestion.placePrediction.text.text
    }));
  } catch (error) {
    console.error("Error fetching place suggestions:", error);
    return [];
  }
};

export const getPlaceDetails = async (placeId: string): Promise<PlaceDetails | null> => {
  try {
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
    
    return {
      name: data.displayName.text,
      coordinates: {
        lat: data.location.latitude,
        lng: data.location.longitude
      },
      placeId: placeId,
      formattedAddress: data.formattedAddress
    };
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