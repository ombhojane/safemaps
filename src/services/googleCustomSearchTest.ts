/**
 * Test script for Google Custom Search API integration
 * Run this file to verify your Custom Search Engine configuration
 */

// Get API keys from environment variables
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const CUSTOM_SEARCH_ENGINE_ID = import.meta.env.VITE_CUSTOM_SEARCH_ENGINE_ID;

/**
 * Test function for Google Custom Search API
 * @param query Search query
 * @returns Promise with search results
 */
export async function GoogleCustomSearch(query: string = "road accidents Mumbai") {
  try {
    console.log(`Testing Google Custom Search API with query: ${query}`);
    
    // Check for required API keys
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("Missing GOOGLE_MAPS_API_KEY in environment variables");
      return { error: "Missing API key" };
    }
    
    if (!CUSTOM_SEARCH_ENGINE_ID) {
      console.error("Missing CUSTOM_SEARCH_ENGINE_ID in environment variables");
      return { error: "Missing search engine ID" };
    }
    
    // Create the API URL with query parameters
    const url = new URL('https://www.googleapis.com/customsearch/v1');
    url.searchParams.append('key', GOOGLE_MAPS_API_KEY);
    url.searchParams.append('cx', CUSTOM_SEARCH_ENGINE_ID);
    url.searchParams.append('q', query);
    url.searchParams.append('num', '3'); // Just return 3 results for testing
    
    console.log(`Requesting: ${url.toString().replace(GOOGLE_MAPS_API_KEY, 'API_KEY_HIDDEN')}`);
    
    // Make the API request
    const response = await fetch(url.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API error: ${response.status} - ${errorText}`);
      return { 
        error: `API error (${response.status})`, 
        details: errorText 
      };
    }
    
    // Parse the response
    const data = await response.json();
    console.log("API response:", data);
    
    // Check if we have search results
    if (!data.items || !Array.isArray(data.items)) {
      console.warn("No search results found");
      return { 
        success: true, 
        message: "API call successful but no results found", 
        data 
      };
    }
    
    // Process and return the search results
    const searchResults = data.items.map(item => ({
      title: item.title || "",
      snippet: item.snippet || "",
      url: item.link || ""
    }));
    
    return { 
      success: true, 
      results: searchResults, 
      totalResults: data.searchInformation?.totalResults || 0,
      searchTime: data.searchInformation?.searchTime || 0
    };
  } catch (error) {
    console.error("Error in Google Custom Search test:", error);
    return { error: String(error) };
  }
}

// Automatically run the test if this file is executed directly
// if (import.meta.url.endsWith('googleCustomSearchTest.ts')) {
//   GoogleCustomSearch()
//     .then(result => {
//       console.log("Test Result:", result);
//       if (result.success) {
//         console.log("✅ Google Custom Search API integration working correctly!");
//       } else {
//         console.log("❌ Google Custom Search API test failed.");
//       }
//     });
// }

export default GoogleCustomSearch; 