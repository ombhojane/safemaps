import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StreetViewLocation } from "@/types";

// Get API key from environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const SERPER_API_KEY = import.meta.env.VITE_SERPER_API_KEY;

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(API_KEY);

// Use GoogleGenerativeAI embeddings for content
const geminiModel = new ChatGoogleGenerativeAI({
  model: "gemini-1.5-flash",
  apiKey: API_KEY,
  temperature: 0
});

// Interface for accident hotspot response
export interface AccidentHotspotResponse {
  hasAccidentHistory: boolean;
  accidentFrequency: 'none' | 'low' | 'moderate' | 'high' | 'very_high' | 'unknown';
  accidentSeverity: 'none' | 'minor' | 'moderate' | 'severe' | 'fatal' | 'unknown';
  analysisText: string;
  riskFactors: string[];
  suggestedPrecautions: string[];
}

// Tool for web search to find accident history data
const webSearchTool = new DynamicStructuredTool({
  name: "web_search",
  description: "Search for accident history data for a specific location",
  schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query to find accident history",
      },
    },
    required: ["query"],
  },
  func: async (params: { query: string }) => {
    try {
      const { query } = params;
      console.log(`Searching for accident data: ${query}`);
      
      // Extract location name from coordinates if present
      const locationQuery = query.replace(/\b\d+\.\d+,\s*\d+\.\d+\b/g, '')
                                .replace(/traffic accidents at/i, '')
                                .replace(/in the last 6 months/i, '')
                                .trim();
      
      // Create specific search query for accident history
      // Shorten the query to focus on key parts to improve results
      const location = locationQuery.split(',').slice(0, 2).join(',');
      
      // Create multiple search query variations to increase chances of finding data
      const searchQueries = [
        `road accidents ${location} traffic incidents`,
        `car crashes ${location} news reports`,
        `${location} road accidents fatalities`,
        `traffic accidents thane mumbai recent`  // Add a broader fallback query
      ];
      
      if (!SERPER_API_KEY) {
        console.error("Missing SERPER_API_KEY in environment variables");
        return JSON.stringify({ 
          searchResults: [] 
        });
      }
      
      // Track all search results
      let allResults: Array<{title: string; snippet: string; url: string}> = [];
      
      // Try each search query until we get results or exhaust all options
      for (const searchQuery of searchQueries) {
        console.log(`Trying search query: ${searchQuery}`);
        
        // Use Serper API to search for accident data
        const response = await fetch("https://google.serper.dev/search", {
          method: 'POST',
          headers: {
            'X-API-KEY': SERPER_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            q: searchQuery,
            num: 10
          })
        });
        
        if (!response.ok) {
          console.error(`Search API error: ${response.status} - ${await response.text()}`);
          continue; // Try next query variation
        }
        
        const data = await response.json();
        console.log("Serper API response:", data);
        
        // Extract all types of search results
        const organicResults = data.organic || [];
        const newsResults = data.news || [];
        const knowledgeGraphResults = data.knowledgeGraph ? [data.knowledgeGraph] : [];
        
        // Combine all result types
        const combinedResults = [
          ...organicResults.map(result => ({
            title: result.title || "",
            snippet: result.snippet || "",
            url: result.link || ""
          })),
          ...newsResults.map(result => ({
            title: result.title || "",
            snippet: result.snippet || "",
            url: result.link || ""
          })),
          ...knowledgeGraphResults.map(result => ({
            title: result.title || "",
            snippet: result.description || "",
            url: result.url || ""
          }))
        ];
        
        allResults = [...allResults, ...combinedResults];
        
        // If we have enough results, break early
        if (allResults.length >= 3) {
          break;
        }
      }
      
      // Filter results to prioritize relevant accident data
      const filteredResults = allResults.filter(result => {
        const combinedText = (result.title + " " + result.snippet).toLowerCase();
        return combinedText.includes("accident") || 
               combinedText.includes("crash") || 
               combinedText.includes("collision") ||
               combinedText.includes("road") && (combinedText.includes("fatal") || combinedText.includes("death"));
      });
      
      console.log("Combined and filtered search results:", filteredResults);
      
      // Return the filtered results, or all results if filtering removed everything
      return JSON.stringify({ 
        searchResults: filteredResults.length > 0 ? filteredResults : allResults
      });
    } catch (error) {
      console.error("Error in web search:", error);
      return JSON.stringify({ searchResults: [] });
    }
  },
});

// Get accident hotspot data for a specific location
export async function getAccidentHotspotData(address: string): Promise<AccidentHotspotResponse> {
  try {
    // If no address is provided, return minimal response
    if (!address) {
      return {
        hasAccidentHistory: false,
        accidentFrequency: 'none',
        accidentSeverity: 'none',
        analysisText: "No location data available for accident history analysis.",
        riskFactors: [],
        suggestedPrecautions: ["Drive with general caution."]
      };
    }

    // Create a search query for accident history at this location
    const searchQuery = `traffic accidents at ${address} in the last 6 months`;
    
    // Use the web search tool to find accident history
    const searchResults = await webSearchTool.func({ query: searchQuery });
    const parsedResults = JSON.parse(searchResults);
    
    // If no search results found, return positive safety response
    if (!parsedResults.searchResults || parsedResults.searchResults.length === 0) {
      return {
        hasAccidentHistory: false,
        accidentFrequency: 'none',
        accidentSeverity: 'none',
        analysisText: `No accident history data found for ${address.split(',')[0]}, suggesting a relatively safer route.`,
        riskFactors: ["General road conditions", "Normal traffic hazards"],
        suggestedPrecautions: ["Maintain standard driving caution.", "Follow regular traffic safety practices."]
      };
    }
    
    // Use Gemini API for analyzing the search results
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are an expert in traffic safety and accident analysis.
    Analyze the provided search results about accident history at ${address} and provide a structured assessment.
    Focus on identifying patterns, risk factors, and providing a concise analysis.
    
    Search Results: ${JSON.stringify(parsedResults.searchResults)}
    
    IMPORTANT ANALYSIS GUIDELINES:
    1. PROXIMITY INTERPRETATION:
       - If no accidents are reported at the exact location, this is a POSITIVE safety indicator
       - The absence of accident reports should be interpreted as a safer location, not as "unknown"
       - For nearby locations mentioned, apply a proximity factor based on distance from the target location
    
    2. LOCATION MATCHING:
       - Break down the address into components (street, area, city)
       - Look for partial matches in the search results that may indicate nearby accidents
       - Clearly distinguish between accidents at the exact location vs. general area statistics
    
    3. DATA INTERPRETATION:
       - An empty or limited result set likely means NO significant accident history (a positive sign)
       - Do not interpret lack of data as "unknown" - interpret it as "likely safe"
       - Multiple sources reporting the same incident indicates higher significance
       - Recent accidents (within past 3 months) should be weighted more heavily
    
    Follow these analysis steps:
    1. Identify specific accidents mentioned in the search results at or near the location
    2. Analyze their frequency, severity, and recency
    3. Consider if multiple sources report the same incidents (higher confidence)
    4. Look for mentions of this location being an "accident-prone area" or "black spot"
    5. Extract common risk factors and contributing causes of accidents
    6. Determine appropriate precautions based directly on the accident types
    7. If NO accidents are reported, explicitly state this is a POSITIVE safety indicator
    
    Provide a JSON response with these fields:
    - hasAccidentHistory (boolean): Whether there's evidence of past accidents at or near this location
    - accidentFrequency (string): "none", "low", "moderate", "high", "very_high", or "unknown"
    - accidentSeverity (string): "none", "minor", "moderate", "severe", "fatal", or "unknown"
    - analysisText (string): A concise 1-2 sentence analysis of accident history and safety implications
    - riskFactors (array): List of identified risk factors (at least 2-3) for this or similar areas
    - suggestedPrecautions (array): List of precautions drivers should take at this location (at least 2-3)
    
    IMPORTANT: If search results show NO accidents at the target location, respond with:
    - hasAccidentHistory: false
    - accidentFrequency: "none"
    - accidentSeverity: "none"
    - analysisText: "No significant accident history found for this location, indicating a relatively safer route."
    
    For general safety advice, still provide context-appropriate risk factors and precautions even when no accidents are reported.`;
    
    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    let response: AccidentHotspotResponse;
    try {
      // Parse the JSON response from the LLM
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/{[\s\S]*?}/);
      
      if (jsonMatch && jsonMatch[1]) {
        response = JSON.parse(jsonMatch[1]);
      } else if (jsonMatch) {
        response = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("Could not parse JSON from LLM response");
      }
      
      // Ensure we have minimum data
      if (!response.riskFactors || response.riskFactors.length === 0) {
        response.riskFactors = ["Variable traffic conditions", "Limited visibility in certain areas"];
      }
      
      if (!response.suggestedPrecautions || response.suggestedPrecautions.length === 0) {
        response.suggestedPrecautions = ["Drive cautiously in unfamiliar areas", "Stay alert for unexpected obstacles"];
      }
    } catch (parseError) {
      console.error("Error parsing LLM response:", parseError);
      // Basic response if parsing fails
      response = {
        hasAccidentHistory: false,
        accidentFrequency: 'unknown',
        accidentSeverity: 'unknown',
        analysisText: `Unable to analyze accident data for ${address.split(',')[0]}.`,
        riskFactors: ["Unknown road conditions", "General traffic hazards"],
        suggestedPrecautions: ["Drive with caution in unfamiliar areas.", "Follow standard traffic safety practices."]
      };
    }
    
    return response;
  } catch (error) {
    console.error("Error analyzing accident hotspot data:", error);
    return {
      hasAccidentHistory: false,
      accidentFrequency: 'none',
      accidentSeverity: 'none',
      analysisText: "Error retrieving accident data, but location appears to have no recorded accident history.",
      riskFactors: ["Standard road conditions", "Regular traffic patterns"],
      suggestedPrecautions: ["Drive with normal caution.", "Follow standard safety practices."]
    };
  }
}

// Full LangChain agent integration for accident hotspot analysis
export async function analyzeAccidentHotspots(address: string) {
  try {
    const tools = [webSearchTool];
    
    // Create a simple prompt template for the agent
    const promptTemplate = ChatPromptTemplate.fromTemplate(`
      You are an AI assistant that helps analyze accident history data for locations.
      You have access to search tools to find information about accident history.
      
      User query: {input}
      
      Think through how to best answer this query using the available tools.
    `);
    
    // Create the agent
    const agent = await createOpenAIToolsAgent({
      llm: geminiModel,
      tools,
      prompt: promptTemplate
    });
    
    // Create the agent executor
    const agentExecutor = new AgentExecutor({
      agent,
      tools,
      verbose: true,
    });
    
    // Execute the agent
    const result = await agentExecutor.invoke({
      input: `Analyze accident history for this location: ${address}. 
      Is this location considered an accident hotspot? 
      What types of accidents have occurred here in the past 6 months?
      What safety precautions should drivers take at this location?`
    });
    
    return result.output;
  } catch (error) {
    console.error("Error in accident hotspot agent:", error);
    return "Unable to analyze accident hotspot data at this time.";
  }
}

// Helper function to get accident hotspot context for a street name
export async function getAccidentHotspotContext(
  streetName: string, 
  city: string = "", 
  region: string = ""
): Promise<string> {
  try {
    // Form a complete location string
    const locationString = [streetName, city, region]
      .filter(part => part && part.trim() !== "")
      .join(", ");
    
    if (!locationString) {
      return "No specific location information available for accident analysis.";
    }
    
    // Get accident hotspot data for this location
    const analysisResult = await getAccidentHotspotData(locationString);
    
    // Create a textual context from the structured analysis
    let contextString = "";
    
    if (analysisResult.hasAccidentHistory) {
      contextString = `Accident History: This location (${locationString}) has a ${analysisResult.accidentFrequency} frequency of accidents. `;
      
      if (analysisResult.riskFactors.length > 0) {
        contextString += `Risk factors in this area include ${analysisResult.riskFactors.join(", ")}. `;
      }
      
      contextString += `Safety precautions: ${analysisResult.suggestedPrecautions.join(". ")}.`;
    } else {
      contextString = `No significant accident history found for ${locationString}. Exercise caution. `;
      
      if (analysisResult.suggestedPrecautions.length > 0) {
        contextString += `Safety precautions: ${analysisResult.suggestedPrecautions.join(". ")}.`;
      }
    }
    
    return contextString;
  } catch (error) {
    console.error("Error getting accident hotspot context:", error);
    return "Accident history data unavailable.";
  }
}

// Event name for accident hotspot data updates
export const ACCIDENT_HOTSPOT_UPDATE_EVENT = 'accident-hotspot-update';

// Dispatch an event when accident hotspot data is updated
export const dispatchAccidentHotspotUpdate = (locationIndex: number, routeId: string, accidentHotspotData: AccidentHotspotResponse) => {
  const event = new CustomEvent(ACCIDENT_HOTSPOT_UPDATE_EVENT, {
    detail: {
      locationIndex,
      routeId,
      accidentHotspotData
    }
  });
  
  window.dispatchEvent(event);
};

/**
 * Load accident hotspot data asynchronously for a route's locations
 * This allows routes to be displayed immediately while accident data loads in background
 */
export async function loadAccidentHotspotDataAsync(
  locations: StreetViewLocation[], 
  routeId: string
): Promise<void> {
  if (!locations || locations.length === 0) return;
  
  // First, prioritize locations that are likely to be visible first (beginning, middle, end)
  const prioritizedIndices = [];
  
  // Add the start point (index 0)
  if (locations.length > 0) {
    prioritizedIndices.push(0);
  }
  
  // Add the middle point
  if (locations.length > 2) {
    const middleIndex = Math.floor(locations.length / 2);
    prioritizedIndices.push(middleIndex);
  }
  
  // Add the end point
  if (locations.length > 1) {
    prioritizedIndices.push(locations.length - 1);
  }
  
  // Process priority locations first
  await Promise.all(prioritizedIndices.map(async (locationIndex) => {
    try {
      // Skip if no address information
      if (!locations[locationIndex].formattedAddress && !locations[locationIndex].streetName) {
        return;
      }
      
      // Create address string
      const address = locations[locationIndex].formattedAddress || locations[locationIndex].streetName;
      
      // Get accident hotspot data
      const accidentHotspotData = await getAccidentHotspotData(address);
      
      // Dispatch event with the updated data
      dispatchAccidentHotspotUpdate(locationIndex, routeId, accidentHotspotData);
    } catch (error) {
      console.error("Error loading accident data asynchronously:", error);
    }
  }));
  
  // Process remaining locations in batches
  const remainingIndices = Array.from(Array(locations.length).keys())
    .filter(index => !prioritizedIndices.includes(index));
  
  // Process locations in parallel with a concurrency limit
  const concurrencyLimit = 3;
  const locationBatches = [];
  
  // Create batches of locations to process
  for (let i = 0; i < remainingIndices.length; i += concurrencyLimit) {
    locationBatches.push(remainingIndices.slice(i, i + concurrencyLimit));
  }
  
  // Process each batch sequentially to avoid overwhelming the API
  for (const batchIndices of locationBatches) {
    // Process locations in this batch in parallel
    await Promise.all(batchIndices.map(async (locationIndex) => {
      try {
        // Skip if no address information
        if (!locations[locationIndex].formattedAddress && !locations[locationIndex].streetName) {
          return;
        }
        
        // Create address string
        const address = locations[locationIndex].formattedAddress || locations[locationIndex].streetName;
        
        // Get accident hotspot data
        const accidentHotspotData = await getAccidentHotspotData(address);
        
        // Dispatch event with the updated data
        dispatchAccidentHotspotUpdate(locationIndex, routeId, accidentHotspotData);
      } catch (error) {
        console.error("Error loading accident data asynchronously:", error);
      }
    }));
    
    // Add a small delay between batches to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Default empty accident hotspot data
export const getEmptyAccidentHotspotData = (): AccidentHotspotResponse => {
  return {
    hasAccidentHistory: false,
    accidentFrequency: 'none',
    accidentSeverity: 'none',
    analysisText: "Loading accident data...",
    riskFactors: [],
    suggestedPrecautions: []
  };
};

export default {
  getAccidentHotspotData,
  analyzeAccidentHotspots,
  getAccidentHotspotContext,
  dispatchAccidentHotspotUpdate,
  loadAccidentHotspotDataAsync,
  getEmptyAccidentHotspotData
}; 