import { GoogleGenerativeAI } from "@google/generative-ai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { ToolParams } from "@langchain/core/tools";
import { AgentExecutor, createOpenAIToolsAgent } from "langchain/agents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { GoogleCustomSearch } from "./googleCustomSearchTest";
import { HumanMessage, AIMessage, SystemMessage } from "@langchain/core/messages";
import { StructuredOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { z } from "zod";

// Get API keys from environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const CUSTOM_SEARCH_ENGINE_ID = import.meta.env.VITE_CUSTOM_SEARCH_ENGINE_ID || '';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(API_KEY);

// Use GoogleGenerativeAI model for the agent
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

// Tool for web search to find accident history data using Google Custom Search JSON API
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
      
      // Extract location name from query
      const locationQuery = query.replace(/\b\d+\.\d+,\s*\d+\.\d+\b/g, '')
                                .replace(/traffic accidents at/i, '')
                                .replace(/in the last 6 months/i, '')
                                .trim();
      
      // Create search query variations to increase chances of finding relevant data
      const location = locationQuery.split(',').slice(0, 2).join(',');
      const searchQueries = [
        `road accidents ${location} traffic incidents`,
        `car crashes ${location} news reports`,
        `${location} road accidents fatalities`,
        `traffic accidents ${location} recent`
      ];
      
      if (!GOOGLE_MAPS_API_KEY) {
        console.error("Missing GOOGLE_MAPS_API_KEY in environment variables");
        return JSON.stringify({ searchResults: [] });
      }

      if (!CUSTOM_SEARCH_ENGINE_ID) {
        console.error("Missing CUSTOM_SEARCH_ENGINE_ID in environment variables");
        return JSON.stringify({ searchResults: [] });
      }
      
      // Track all search results
      let allResults: Array<{title: string; snippet: string; url: string}> = [];
      
      // Try each search query until we get results or exhaust all options
      for (const searchQuery of searchQueries) {
        console.log(`Trying search query: ${searchQuery}`);
        
        // Use Google Custom Search API
        const searchResult = await GoogleCustomSearch(searchQuery);
        
        if (searchResult.error) {
          console.error(`Search API error: ${searchResult.error}`);
          continue; // Try next query variation
        }
        
        if (!searchResult.results || !Array.isArray(searchResult.results)) {
          console.warn("No search results found for query:", searchQuery);
          continue;
        }
        
        // Add results to our collection
        allResults = [...allResults, ...searchResult.results];
        
        // If we have enough results, break early
        if (allResults.length >= 3) {
          break;
        }
      }
      
      return JSON.stringify({ searchResults: allResults });
    } catch (error) {
      console.error("Error in web search:", error);
      return JSON.stringify({ searchResults: [] });
    }
  }
});

// Define the search result interface
interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

// Few-shot examples for different accident scenarios to improve model responses
const fewShotExamples = [
  // Example 1: High-risk location with multiple accidents
  {
    scenario: "Multiple fatal accidents on NH48 Highway near Gurugram",
    searchResults: [
      {
        title: "Three killed in crash on NH48 Highway near Gurugram",
        snippet: "A collision between a truck and two cars on NH48 near Rajiv Chowk resulted in three fatalities last month. Police cited speeding and poor visibility due to fog as contributing factors.",
        url: "https://example.com/news/accident-nh48-gurugram"
      },
      {
        title: "NH48 accidents rise by 15%, authorities concerned",
        snippet: "The stretch of NH48 near Gurugram has seen a 15% increase in accidents this year. Last week, a motorcyclist was killed when he lost control near Rajiv Chowk, the 5th fatality this month.",
        url: "https://example.com/news/nh48-accident-statistics"
      }
    ],
    response: {
      hasAccidentHistory: true,
      accidentFrequency: "high",
      accidentSeverity: "fatal",
      analysisText: "NH48 near Gurugram shows a concerning pattern of frequent fatal accidents, with multiple incidents reported in the last month including a deadly collision that killed three people.",
      riskFactors: [
        "High-speed corridor with frequent speeding",
        "Poor visibility conditions during fog/rain",
        "Heavy commercial vehicle traffic",
        "Congestion at major intersections"
      ],
      suggestedPrecautions: [
        "Reduce speed significantly below posted limits, especially during night or poor weather",
        "Maintain extra distance from commercial vehicles",
        "Use headlights at all times for improved visibility",
        "Avoid lane changes near intersections"
      ]
    }
  },
  
  // Example 2: Moderate risk location with non-fatal accidents
  {
    scenario: "Minor accidents at Downtown Chicago intersection",
    searchResults: [
      {
        title: "Fender bender at Michigan and Adams intersection causes delays",
        snippet: "A minor collision between two vehicles at Michigan Ave and Adams St in downtown Chicago caused traffic delays during rush hour yesterday. No injuries were reported.",
        url: "https://example.com/news/downtown-accident"
      },
      {
        title: "Chicago traffic report: Another collision at busy Michigan Avenue",
        snippet: "Police responded to a minor accident at Michigan and Adams this morning. This is the third such incident at this intersection this month, though all have been non-injury accidents.",
        url: "https://example.com/news/chicago-traffic"
      }
    ],
    response: {
      hasAccidentHistory: true,
      accidentFrequency: "moderate",
      accidentSeverity: "minor",
      analysisText: "The Michigan and Adams intersection in Chicago has a moderate frequency of minor accidents, with three non-injury collisions reported this month, typically during rush hour periods.",
      riskFactors: [
        "High traffic congestion during rush hours",
        "Complex intersection with multiple turning lanes",
        "Pedestrian crossings creating stopping hazards",
        "Limited visibility at certain approaches"
      ],
      suggestedPrecautions: [
        "Approach the intersection at reduced speed",
        "Maintain extra vigilance for sudden stops ahead",
        "Be cautious of pedestrians crossing against signals",
        "Allow extra space between vehicles when stopping"
      ]
    }
  },
  
  // Example 3: Safe location with no accident history
  {
    scenario: "Residential area with no reported accidents",
    searchResults: [
      {
        title: "Maple Street neighborhood celebrates safety milestone",
        snippet: "The Maple Street residential area in Westville has gone two years without a traffic incident. City officials credit the recently installed traffic calming measures.",
        url: "https://example.com/news/maple-street-safety"
      }
    ],
    response: {
      hasAccidentHistory: false,
      accidentFrequency: "none",
      accidentSeverity: "none",
      analysisText: "No significant accident history found for this location, indicating a relatively safer route with well-implemented traffic calming measures.",
      riskFactors: [
        "Standard residential road conditions",
        "Possible presence of pedestrians and children",
        "Typical blind driveways and parked vehicles"
      ],
      suggestedPrecautions: [
        "Drive at or below the posted residential speed limit",
        "Stay alert for pedestrians and children at play",
        "Be cautious near driveways and parked vehicles"
      ]
    }
  },

  // Example 4: Limited/ambiguous data scenario
  {
    scenario: "New development area with limited accident data",
    searchResults: [
      {
        title: "Transportation study begins for River Front development",
        snippet: "City planners are conducting traffic studies at the new River Front development area. Though no accidents have been reported yet, officials are concerned about the increased traffic flow.",
        url: "https://example.com/news/riverfront-traffic-study"
      }
    ],
    response: {
      hasAccidentHistory: false,
      accidentFrequency: "none",
      accidentSeverity: "none",
      analysisText: "No accident history data found for this newly developed area. The absence of reported accidents suggests it's currently a safe route, though increased traffic may change conditions.",
      riskFactors: [
        "New road layout unfamiliar to drivers",
        "Ongoing construction activity possible",
        "Increasing traffic volume as development grows"
      ],
      suggestedPrecautions: [
        "Drive with extra caution in this unfamiliar area",
        "Be alert for construction vehicles and temporary road changes",
        "Follow posted speed limits which may be adjusted for developing conditions"
      ]
    }
  }
];

/**
 * Analyze search results and generate accident hotspot assessment
 * This is a direct function for analyzing results (fallback if agent fails)
 */
async function analyzeSearchResults(address: string, searchResults: SearchResult[]): Promise<AccidentHotspotResponse> {
  try {
    // If no search results found, return default safe response
    if (!searchResults || searchResults.length === 0) {
      return createDefaultResponse(
        `No accident history data found for ${address.split(',')[0]}, suggesting a relatively safer route.`,
        false
      );
    }
    
    // Use Gemini API for analyzing the search results
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are an expert in traffic safety and accident analysis.
    Analyze the provided search results about accident history at ${address} and provide a structured assessment.
    Focus on identifying patterns, risk factors, and providing a concise analysis.
    
    Search Results: ${JSON.stringify(searchResults)}
    
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
    
    EXAMPLE SCENARIOS AND EXPECTED RESPONSES:
    ${fewShotExamples.map(example => `
    SCENARIO: ${example.scenario}
    SEARCH RESULTS: ${JSON.stringify(example.searchResults)}
    EXPECTED RESPONSE: ${JSON.stringify(example.response, null, 2)}
    `).join('\n\n')}
    
    Now, provide a JSON response for the current search results with these fields:
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

    console.log("Gemini response:", responseText);
    
    return parseGeminiResponse(responseText, address);
  } catch (error) {
    console.error("Error analyzing accident data:", error);
    return createDefaultResponse(
      "Error analyzing accident data, but location appears to have no recorded accident history."
    );
  }
}

/**
 * Parse Gemini's response text and extract structured data
 */
function parseGeminiResponse(responseText: string, address: string): AccidentHotspotResponse {
  try {
    // Parse the JSON response from the LLM
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                      responseText.match(/{[\s\S]*?}/);
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      const response = JSON.parse(jsonText);
      
      // Ensure we have minimum data
      if (!response.riskFactors || response.riskFactors.length === 0) {
        response.riskFactors = ["Variable traffic conditions", "Limited visibility in certain areas"];
      }
      
      if (!response.suggestedPrecautions || response.suggestedPrecautions.length === 0) {
        response.suggestedPrecautions = ["Drive cautiously in unfamiliar areas", "Stay alert for unexpected obstacles"];
      }
      
      return response;
    } else {
      throw new Error("Could not parse JSON from LLM response");
    }
  } catch (parseError) {
    console.error("Error parsing LLM response:", parseError);
    // Basic response if parsing fails
    return {
      hasAccidentHistory: false,
      accidentFrequency: 'unknown',
      accidentSeverity: 'unknown',
      analysisText: `Unable to analyze accident data for ${address.split(',')[0]}.`,
      riskFactors: ["Unknown road conditions", "General traffic hazards"],
      suggestedPrecautions: ["Drive with caution in unfamiliar areas.", "Follow standard traffic safety practices."]
    };
  }
}

/**
 * Create a default response object for cases with no data or errors
 */
function createDefaultResponse(analysisText: string, hasAccidentHistory = false): AccidentHotspotResponse {
  return {
    hasAccidentHistory,
    accidentFrequency: 'none',
    accidentSeverity: 'none',
    analysisText,
    riskFactors: ["Standard road conditions", "Regular traffic patterns"],
    suggestedPrecautions: ["Drive with normal caution.", "Follow standard safety practices."]
  };
}

/**
 * Get accident hotspot data for a specific location using direct function calls
 * @param address The address to analyze for accident history
 */
export async function getAccidentHotspotData(address: string): Promise<AccidentHotspotResponse> {
  try {
    // If no address is provided, return minimal response
    if (!address) {
      return createDefaultResponse("No location data available for accident history analysis.");
    }

    console.log(`Analyzing accident hotspot data for: ${address}`);
    
    // Create a search query for accident history at this location
    const searchQuery = `traffic accidents at ${address} in the last 6 months`;
    
    // Use the web search tool directly to find accident history
    const searchResults = await webSearchTool.invoke({ query: searchQuery });
    const parsedResults = JSON.parse(searchResults);
    console.log("Data context: ", parsedResults);
    
    // Analyze the search results
    return await analyzeSearchResults(address, parsedResults.searchResults || []);
    
  } catch (error) {
    console.error("Error analyzing accident hotspot data:", error);
    return createDefaultResponse(
      "Error retrieving accident data, but location appears to have no recorded accident history."
    );
  }
}

/**
 * Get accident hotspot context for a street name
 */
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
    if (analysisResult.hasAccidentHistory) {
      let contextString = `Accident History: This location (${locationString}) has a ${analysisResult.accidentFrequency} frequency of accidents. `;
      
      if (analysisResult.riskFactors.length > 0) {
        contextString += `Risk factors in this area include ${analysisResult.riskFactors.join(", ")}. `;
      }
      
      contextString += `Safety precautions: ${analysisResult.suggestedPrecautions.join(". ")}.`;
      return contextString;
    } else {
      let contextString = `No significant accident history found for ${locationString}. Exercise caution. `;
      
      if (analysisResult.suggestedPrecautions.length > 0) {
        contextString += `Safety precautions: ${analysisResult.suggestedPrecautions.join(". ")}.`;
      }
      return contextString;
    }
  } catch (error) {
    console.error("Error getting accident hotspot context:", error);
    return "Accident history data unavailable.";
  }
}

/**
 * LangChain agent integration for accident hotspot analysis for more complex queries
 */
export async function analyzeAccidentHotspots(address: string): Promise<string> {
  try {
    if (!address) {
      return "No location data available for accident history analysis.";
    }
    
    // First get the regular accident hotspot data
    const hotspotData = await getAccidentHotspotData(address);
    
    // Generate a comprehensive text response from the structured data
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    I'm going to provide you with structured data about accident history for a location.
    Please convert this into a comprehensive but concise natural language analysis for the user.
    
    Location: ${address}
    
    Accident Data:
    ${JSON.stringify(hotspotData, null, 2)}
    
    Please format your response as a clear analysis that answers:
    1. Is this location considered an accident hotspot?
    2. What types of accidents have occurred here recently?
    3. What safety precautions should drivers take at this location?
    
    Keep your response under 200 words, be factual, and don't exaggerate risks.
    If there's no accident history, emphasize this is a positive safety indicator.
    `;
    
    const result = await model.generateContent(prompt);
    return result.response.text();
    
  } catch (error) {
    console.error("Error in accident hotspot analysis:", error);
    return "Unable to analyze accident hotspot data at this time.";
  }
}

// Add a new function to analyze accident hotspots across an entire route
export async function analyzeRouteAccidentHotspots(
  streetViewLocations: Array<{
    streetName?: string;
    accidentHotspot?: AccidentHotspotResponse;
    coordinates?: { lat: number; lng: number };
  }>,
  routeName: string = ""
): Promise<{
  overallSafetyScore: number; 
  highRiskAreas: Array<{locationName: string; reason: string}>;
  safetyAnalysis: string;
  safetySummary: string;
  safetySuggestions: string[];
}> {
  try {
    if (!streetViewLocations || streetViewLocations.length === 0) {
      return {
        overallSafetyScore: 80, // Default to moderately safe
        highRiskAreas: [],
        safetyAnalysis: "No location data available for accident history analysis.",
        safetySummary: "Safety information unavailable for this route.",
        safetySuggestions: ["Drive with normal caution.", "Stay alert at all times."]
      };
    }

    console.log(`Analyzing route accident hotspots across ${streetViewLocations.length} locations`);
    
    // Filter out locations without accident hotspot data
    const locationsWithData = streetViewLocations.filter(loc => 
      loc.accidentHotspot && loc.streetName
    );
    
    if (locationsWithData.length === 0) {
      return {
        overallSafetyScore: 80, // Default to moderately safe
        highRiskAreas: [],
        safetyAnalysis: "No accident history data available for locations along this route.",
        safetySummary: "No specific risk areas identified on this route.",
        safetySuggestions: ["Drive with normal caution.", "Stay alert at all times."]
      };
    }
    
    // Aggregate accident hotspot data for all locations
    const aggregatedData = {
      locationCount: locationsWithData.length,
      locationsWithAccidentHistory: locationsWithData.filter(loc => 
        loc.accidentHotspot?.hasAccidentHistory
      ).length,
      frequencyBreakdown: {
        none: locationsWithData.filter(loc => loc.accidentHotspot?.accidentFrequency === 'none').length,
        low: locationsWithData.filter(loc => loc.accidentHotspot?.accidentFrequency === 'low').length,
        moderate: locationsWithData.filter(loc => loc.accidentHotspot?.accidentFrequency === 'moderate').length,
        high: locationsWithData.filter(loc => loc.accidentHotspot?.accidentFrequency === 'high').length,
        very_high: locationsWithData.filter(loc => loc.accidentHotspot?.accidentFrequency === 'very_high').length,
        unknown: locationsWithData.filter(loc => loc.accidentHotspot?.accidentFrequency === 'unknown').length
      },
      severityBreakdown: {
        none: locationsWithData.filter(loc => loc.accidentHotspot?.accidentSeverity === 'none').length,
        minor: locationsWithData.filter(loc => loc.accidentHotspot?.accidentSeverity === 'minor').length,
        moderate: locationsWithData.filter(loc => loc.accidentHotspot?.accidentSeverity === 'moderate').length,
        severe: locationsWithData.filter(loc => loc.accidentHotspot?.accidentSeverity === 'severe').length,
        fatal: locationsWithData.filter(loc => loc.accidentHotspot?.accidentSeverity === 'fatal').length,
        unknown: locationsWithData.filter(loc => loc.accidentHotspot?.accidentSeverity === 'unknown').length
      },
      // Collect all risk factors and count occurrences
      riskFactors: collectAndCountItems(locationsWithData.map(loc => loc.accidentHotspot?.riskFactors || [])),
      // Collect all safety precautions and count occurrences
      suggestedPrecautions: collectAndCountItems(locationsWithData.map(loc => loc.accidentHotspot?.suggestedPrecautions || [])),
      // Detailed locations data
      locationDetails: locationsWithData.map(loc => ({
        streetName: loc.streetName || "Unnamed Street",
        hasAccidentHistory: loc.accidentHotspot?.hasAccidentHistory || false,
        accidentFrequency: loc.accidentHotspot?.accidentFrequency || 'unknown',
        accidentSeverity: loc.accidentHotspot?.accidentSeverity || 'unknown',
        analysisText: loc.accidentHotspot?.analysisText || "",
        coordinates: loc.coordinates || { lat: 0, lng: 0 }
      }))
    };
    
    // Calculate a basic safety score based on frequency and severity
    const calculateRawSafetyScore = (): number => {
      const totalLocations = aggregatedData.locationCount;
      if (totalLocations === 0) return 80; // Default
      
      // Calculate score based on accident frequency (higher is better)
      const frequencyScore = (
        (aggregatedData.frequencyBreakdown.none * 100) +
        (aggregatedData.frequencyBreakdown.low * 70) +
        (aggregatedData.frequencyBreakdown.moderate * 50) +
        (aggregatedData.frequencyBreakdown.high * 20) +
        (aggregatedData.frequencyBreakdown.very_high * 0) +
        (aggregatedData.frequencyBreakdown.unknown * 60)
      ) / totalLocations;
      
      // Calculate score based on accident severity (higher is better)
      const severityScore = (
        (aggregatedData.severityBreakdown.none * 100) +
        (aggregatedData.severityBreakdown.minor * 80) +
        (aggregatedData.severityBreakdown.moderate * 60) +
        (aggregatedData.severityBreakdown.severe * 20) +
        (aggregatedData.severityBreakdown.fatal * 0) +
        (aggregatedData.severityBreakdown.unknown * 60)
      ) / totalLocations;
      
      // Combine scores with a heavier weight on severity
      return Math.round((frequencyScore * 0.4) + (severityScore * 0.6));
    };
    
    const rawSafetyScore = calculateRawSafetyScore();
    
    // Identify high risk areas (streets with high or very high accident frequency)
    const highRiskAreas = aggregatedData.locationDetails
      .filter(loc => 
        loc.accidentFrequency === 'high' || 
        loc.accidentFrequency === 'very_high' ||
        loc.accidentSeverity === 'severe' ||
        loc.accidentSeverity === 'fatal'
      )
      .map(loc => ({
        locationName: loc.streetName,
        reason: loc.analysisText || `${loc.accidentFrequency} accident frequency with ${loc.accidentSeverity} severity`
      }));
    
    // Use Gemini to generate the final analysis
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    You are a road safety expert providing an analysis of a route based on accident hotspot data.
    
    Route name: ${routeName || "Selected route"}
    
    I'll provide you with aggregated accident hotspot data from multiple points along the route.
    Please analyze this data to provide comprehensive safety insights.
    
    AGGREGATED ACCIDENT DATA:
    ${JSON.stringify(aggregatedData, null, 2)}
    
    Raw Safety Score (0-100, higher is safer): ${rawSafetyScore}
    
    Based on the data above, provide the following:
    
    1. SAFETY SCORE ADJUSTMENT: Review the raw safety score (${rawSafetyScore}) and adjust it if needed based on your expert analysis. The final score should be between a scale of 0-100, where higher is safer.
    
    2. SAFETY ANALYSIS: A detailed 4-6 sentence analysis of the overall route safety, focusing on accident patterns, risk factors, and severity. Analyze how the different segments of the route compare in terms of safety. 
    
    3. SAFETY SUMMARY: A concise one-sentence summary of the route's safety profile that could be shown to users as a quick overview.
    
    4. SAFETY SUGGESTIONS: 3-5 specific, actionable safety recommendations for travelers on this route. Prioritize the most important precautions based on the identified risk factors. Make sure these are specific to the actual risks identified in the data, not generic advice.
    
    5. HIGH RISK AREAS VERIFICATION: Analyze if the automatically identified high-risk areas (${highRiskAreas.length > 0 ? highRiskAreas.map(area => area.locationName).join(', ') : 'none'}) are correct based on the data. Add or remove areas as appropriate.
    
    Format your response as a JSON object with these keys:
    {
      "adjustedSafetyScore": number,
      "safetyAnalysis": "detailed analysis here",
      "safetySummary": "concise summary here", 
      "safetySuggestions": ["suggestion1", "suggestion2", ...],
      "verifiedHighRiskAreas": [{"locationName": "Street Name", "reason": "Specific reason this area is high risk"}, ...]
    }
    
    IMPORTANT GUIDELINES:
    - Be honest about risks, but don't exaggerate dangers
    - If data shows the route is mostly safe, emphasize this positive aspect
    - Focus on factual analysis, not speculation
    - Base suggestions on the actual risk factors identified in the data
    - Keep your language clear and concise
    `;
    
    const result = await model.generateContent(prompt);
    const analysisText = result.response.text();
    
    // Parse the Gemini response
    try {
      // Extract JSON from the response
      const jsonMatch = analysisText.match(/```json\n([\s\S]*?)\n```/) || 
                        analysisText.match(/{[\s\S]*?}/);
      
      if (jsonMatch) {
        const jsonText = jsonMatch[1] || jsonMatch[0];
        const analysis = JSON.parse(jsonText);
        
        return {
          overallSafetyScore: analysis.adjustedSafetyScore || rawSafetyScore,
          highRiskAreas: analysis.verifiedHighRiskAreas || highRiskAreas,
          safetyAnalysis: analysis.safetyAnalysis || "No detailed safety analysis available.",
          safetySummary: analysis.safetySummary || "No safety summary available.",
          safetySuggestions: analysis.safetySuggestions || aggregatedData.suggestedPrecautions.slice(0, 5).map(item => item.text)
        };
      }
    } catch (parseError) {
      console.error("Error parsing route analysis response:", parseError);
    }
    
    // Fallback if parsing fails
    return {
      overallSafetyScore: rawSafetyScore,
      highRiskAreas,
      safetyAnalysis: "Analysis of accident hotspots along this route shows varied levels of safety concerns. Exercise appropriate caution especially in areas with higher accident frequency.",
      safetySummary: `Route has ${highRiskAreas.length} high-risk areas out of ${aggregatedData.locationCount} analyzed locations.`,
      safetySuggestions: aggregatedData.suggestedPrecautions.slice(0, 5).map(item => item.text)
    };
    
  } catch (error) {
    console.error("Error analyzing route accident hotspots:", error);
    return {
      overallSafetyScore: 70, // Default to moderately safe
      highRiskAreas: [],
      safetyAnalysis: "Error while analyzing accident data for this route.",
      safetySummary: "Route safety information unavailable.",
      safetySuggestions: ["Drive with appropriate caution.", "Stay alert at all times."]
    };
  }
}

// Helper function to collect and count items from multiple arrays
function collectAndCountItems(arrays: Array<string[]>): Array<{text: string; count: number}> {
  const itemCounts: Record<string, number> = {};
  
  // Count occurrences of each item
  arrays.forEach(array => {
    array.forEach(item => {
      itemCounts[item] = (itemCounts[item] || 0) + 1;
    });
  });
  
  // Convert to array and sort by count (descending)
  return Object.entries(itemCounts)
    .map(([text, count]) => ({ text, count }))
    .sort((a, b) => b.count - a.count);
}

export default {
  getAccidentHotspotData,
  analyzeAccidentHotspots,
  getAccidentHotspotContext,
  analyzeRouteAccidentHotspots
}; 