import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleCustomSearch } from "./googleCustomSearchTest";

// Get API keys from environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const CUSTOM_SEARCH_ENGINE_ID = import.meta.env.VITE_CUSTOM_SEARCH_ENGINE_ID || '';

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(API_KEY);

// Interface for criminal hotspot response
export interface CriminalHotspotResponse {
  hasCrimeHistory: boolean;
  crimeFrequency: 'none' | 'low' | 'moderate' | 'high' | 'very_high' | 'unknown';
  crimeSeverity: 'none' | 'minor' | 'moderate' | 'severe' | 'violent' | 'unknown';
  crimeTypes: string[];
  analysisText: string;
  riskFactors: string[];
  suggestedPrecautions: string[];
}

// Few-shot examples for different crime scenarios to improve model responses
const fewShotExamples = [
  // Example 1: High-risk location with violent crimes
  {
    scenario: "Multiple robberies and assaults in downtown area",
    searchResults: [
      {
        title: "Police report increase in street robberies in downtown area",
        snippet: "Police have reported a 25% increase in street robberies in the downtown area over the past three months. Most incidents occurred after dark and involved smartphones and wallets.",
        url: "https://example.com/news/downtown-robbery-increase"
      },
      {
        title: "Two assaults reported near Main Street last weekend",
        snippet: "Two separate assault incidents were reported near Main Street last weekend. Both victims were walking alone after midnight. Police have increased patrols in the area.",
        url: "https://example.com/news/main-street-assaults"
      }
    ],
    response: {
      hasCrimeHistory: true,
      crimeFrequency: "high",
      crimeSeverity: "violent",
      crimeTypes: ["robbery", "assault"],
      analysisText: "The downtown area shows a concerning pattern of frequent violent crimes, with multiple robberies and assaults reported in the past three months, particularly after dark.",
      riskFactors: [
        "High crime area, especially at night",
        "Targeting of pedestrians walking alone",
        "Focus on valuable items like smartphones",
        "Limited police presence despite recent increases"
      ],
      suggestedPrecautions: [
        "Avoid walking alone after dark in this area",
        "Keep smartphones and valuables concealed",
        "Stay in well-lit, populated areas",
        "Consider using ride-sharing instead of walking at night",
        "Be alert and aware of surroundings at all times"
      ]
    }
  },
  
  // Example 2: Moderate risk location with property crimes
  {
    scenario: "Car break-ins at shopping district",
    searchResults: [
      {
        title: "Series of car break-ins reported at Westfield Mall parking lot",
        snippet: "Police are investigating a series of car break-ins at the Westfield Mall parking lot. Over a dozen vehicles had windows smashed and items stolen in the past month.",
        url: "https://example.com/news/mall-break-ins"
      },
      {
        title: "Mall increases security after vehicle thefts",
        snippet: "Westfield Mall has increased security patrols following multiple reports of theft from vehicles. Most incidents occurred in the evening hours in poorly lit sections.",
        url: "https://example.com/news/mall-security"
      }
    ],
    response: {
      hasCrimeHistory: true,
      crimeFrequency: "moderate",
      crimeSeverity: "moderate",
      crimeTypes: ["vehicle break-in", "theft"],
      analysisText: "The Westfield Mall area has experienced a moderate frequency of property crimes, mainly car break-ins and thefts from vehicles, occurring primarily in the evening hours.",
      riskFactors: [
        "Poorly lit parking areas",
        "High-value items visible in vehicles",
        "Evening hours showing increased risk",
        "Large parking areas with limited surveillance"
      ],
      suggestedPrecautions: [
        "Park in well-lit areas near security cameras",
        "Never leave valuables visible in your vehicle",
        "Visit during daylight hours when possible",
        "Report suspicious activity to mall security",
        "Consider using valet parking if available"
      ]
    }
  },
  
  // Example 3: Safe location with no significant crime history
  {
    scenario: "Residential suburb with minimal crime",
    searchResults: [
      {
        title: "Oakwood Heights named one of city's safest neighborhoods",
        snippet: "Oakwood Heights has been recognized as one of the city's safest residential areas, with crime rates 40% below the city average according to annual police statistics.",
        url: "https://example.com/news/oakwood-safety"
      }
    ],
    response: {
      hasCrimeHistory: false,
      crimeFrequency: "none",
      crimeSeverity: "none",
      crimeTypes: [],
      analysisText: "No significant crime history found for this location, which has been recognized as one of the city's safest areas with crime rates well below average.",
      riskFactors: [
        "Standard residential security considerations",
        "Possible property crimes of opportunity",
        "Minimal street lighting in some sections"
      ],
      suggestedPrecautions: [
        "Maintain normal personal safety awareness",
        "Secure your belongings as you would anywhere",
        "Report any suspicious activity to local authorities"
      ]
    }
  },

  // Example 4: Limited/ambiguous data scenario
  {
    scenario: "New tourism area with limited crime data",
    searchResults: [
      {
        title: "City planning increased security for new waterfront district",
        snippet: "The newly developed waterfront tourism district will see increased security measures including cameras and police patrols, though no specific crime issues have been reported.",
        url: "https://example.com/news/waterfront-security"
      }
    ],
    response: {
      hasCrimeHistory: false,
      crimeFrequency: "unknown",
      crimeSeverity: "unknown",
      crimeTypes: [],
      analysisText: "No crime history data found for this newly developed area. The absence of reported crimes suggests it's currently a safe area, though being a tourism district may attract opportunistic crimes.",
      riskFactors: [
        "New area with limited historical data",
        "Tourist areas can attract pickpocketing",
        "Nightlife venues may increase risk after hours"
      ],
      suggestedPrecautions: [
        "Maintain normal awareness in this developing area",
        "Keep valuables secure, especially in crowded areas",
        "Be more cautious during evening hours until more safety data is available"
      ]
    }
  }
];

/**
 * Get criminal hotspot data for a specific location
 * @param address The address to analyze for criminal activity
 */
export async function getCriminalHotspotData(address: string): Promise<CriminalHotspotResponse> {
  try {
    // If no address is provided, return minimal response
    if (!address) {
      return createDefaultResponse("No location data available for crime history analysis.");
    }

    console.log(`Analyzing criminal hotspot data for: ${address}`);
    
    // Create search queries for crime history at this location
    const searchQueries = [
      `crime rates at ${address}`,
      `criminal activity near ${address}`,
      `robberies assaults ${address}`,
      `is ${address} safe crime statistics`
    ];
    
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
    
    // Analyze the search results
    return await analyzeSearchResults(address, allResults);
    
  } catch (error) {
    console.error("Error analyzing criminal hotspot data:", error);
    return createDefaultResponse(
      "Error retrieving crime data, but location appears to have no recorded criminal activity."
    );
  }
}

/**
 * Analyze search results and generate criminal hotspot assessment
 */
async function analyzeSearchResults(address: string, searchResults: Array<{title: string; snippet: string; url: string}>): Promise<CriminalHotspotResponse> {
  try {
    // If no search results found, return default safe response
    if (!searchResults || searchResults.length === 0) {
      return createDefaultResponse(
        `No crime history data found for ${address.split(',')[0]}, suggesting a relatively safer area.`,
        false
      );
    }
    
    // Use Gemini API for analyzing the search results
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `You are an expert in criminal activity analysis and public safety.
    Analyze the provided search results about crime history at ${address} and provide a structured assessment.
    Focus on identifying patterns, risk factors, and providing a concise analysis.
    
    Search Results: ${JSON.stringify(searchResults)}
    
    IMPORTANT ANALYSIS GUIDELINES:
    1. PROXIMITY INTERPRETATION:
       - If no crimes are reported at the exact location, this is a POSITIVE safety indicator
       - The absence of crime reports should be interpreted as a safer location, not as "unknown"
       - For nearby locations mentioned, apply a proximity factor based on distance from the target location
    
    2. LOCATION MATCHING:
       - Break down the address into components (street, area, city)
       - Look for partial matches in the search results that may indicate nearby criminal activity
       - Clearly distinguish between crimes at the exact location vs. general area statistics
    
    3. DATA INTERPRETATION:
       - An empty or limited result set likely means NO significant crime history (a positive sign)
       - Do not interpret lack of data as "unknown" - interpret it as "likely safe"
       - Focus on violent and property crimes that would affect travelers
       - Recent crimes (within past 6 months) should be weighted more heavily
       - Consider time of day patterns (day vs night safety differences)
    
    4. CRIME CATEGORIZATION:
       - Categorize crime types (robbery, assault, theft, etc.)
       - Differentiate violent crimes (affecting personal safety) from property crimes
       - Consider frequency (how often crimes occur) and severity (how dangerous they are)
    
    Follow these analysis steps:
    1. Identify specific crimes mentioned in the search results at or near the location
    2. Analyze their frequency, severity, and recency
    3. Consider if multiple sources report the same incidents (higher confidence)
    4. Look for mentions of this location being a "high-crime area"
    5. Extract common risk factors and times/situations when crimes occur
    6. Determine appropriate precautions based directly on the crime types
    7. If NO crimes are reported, explicitly state this is a POSITIVE safety indicator
    
    EXAMPLE SCENARIOS AND EXPECTED RESPONSES:
    ${fewShotExamples.map(example => `
    SCENARIO: ${example.scenario}
    SEARCH RESULTS: ${JSON.stringify(example.searchResults)}
    EXPECTED RESPONSE: ${JSON.stringify(example.response, null, 2)}
    `).join('\n\n')}
    
    Now, provide a JSON response for the current search results with these fields:
    - hasCrimeHistory (boolean): Whether there's evidence of past crimes at or near this location
    - crimeFrequency (string): "none", "low", "moderate", "high", "very_high", or "unknown"
    - crimeSeverity (string): "none", "minor", "moderate", "severe", "violent", or "unknown"
    - crimeTypes (array): List of identified crime types at this location (empty array if none)
    - analysisText (string): A concise 1-2 sentence analysis of crime history and safety implications
    - riskFactors (array): List of identified risk factors (at least 2-3) for this or similar areas
    - suggestedPrecautions (array): List of precautions travelers should take at this location (at least 2-3)
    
    IMPORTANT: If search results show NO crimes at the target location, respond with:
    - hasCrimeHistory: false
    - crimeFrequency: "none"
    - crimeSeverity: "none"
    - crimeTypes: []
    - analysisText: "No significant crime history found for this location, indicating a relatively safer area."
    
    For general safety advice, still provide context-appropriate risk factors and precautions even when no crimes are reported.`;
    
    // Generate response from Gemini
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    console.log("Gemini response:", responseText);
    
    return parseGeminiResponse(responseText, address);
  } catch (error) {
    console.error("Error analyzing crime data:", error);
    return createDefaultResponse(
      "Error analyzing crime data, but location appears to have no recorded criminal activity."
    );
  }
}

/**
 * Parse Gemini's response text and extract structured data
 */
function parseGeminiResponse(responseText: string, address: string): CriminalHotspotResponse {
  try {
    // Parse the JSON response from the LLM
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                      responseText.match(/{[\s\S]*?}/);
    
    if (jsonMatch) {
      const jsonText = jsonMatch[1] || jsonMatch[0];
      const response = JSON.parse(jsonText);
      
      // Ensure we have minimum data
      if (!response.riskFactors || response.riskFactors.length === 0) {
        response.riskFactors = ["Standard urban safety considerations", "Limited visibility in certain areas at night"];
      }
      
      if (!response.suggestedPrecautions || response.suggestedPrecautions.length === 0) {
        response.suggestedPrecautions = ["Maintain normal awareness", "Keep valuables secure while traveling"];
      }

      // Ensure crimeTypes exists
      if (!response.crimeTypes) {
        response.crimeTypes = [];
      }
      
      return response;
    } else {
      throw new Error("Could not parse JSON from LLM response");
    }
  } catch (parseError) {
    console.error("Error parsing LLM response:", parseError);
    // Basic response if parsing fails
    return {
      hasCrimeHistory: false,
      crimeFrequency: 'unknown',
      crimeSeverity: 'unknown',
      crimeTypes: [],
      analysisText: `Unable to analyze crime data for ${address.split(',')[0]}.`,
      riskFactors: ["Unknown safety conditions", "General urban safety considerations"],
      suggestedPrecautions: ["Maintain standard safety awareness.", "Follow common safety practices in unfamiliar areas."]
    };
  }
}

/**
 * Create a default response object for cases with no data or errors
 */
function createDefaultResponse(analysisText: string, hasCrimeHistory = false): CriminalHotspotResponse {
  return {
    hasCrimeHistory,
    crimeFrequency: 'none',
    crimeSeverity: 'none',
    crimeTypes: [],
    analysisText,
    riskFactors: ["Standard safety considerations", "Normal urban awareness"],
    suggestedPrecautions: ["Maintain normal awareness.", "Keep valuables secure."]
  };
}

/**
 * Get crime context for a street name - useful for providing safety context
 */
export async function getCrimeHotspotContext(
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
      return "No specific location information available for crime analysis.";
    }
    
    // Get criminal hotspot data for this location
    const analysisResult = await getCriminalHotspotData(locationString);
    
    // Create a textual context from the structured analysis
    if (analysisResult.hasCrimeHistory) {
      let contextString = `Crime History: This location (${locationString}) has a ${analysisResult.crimeFrequency} frequency of criminal activity. `;
      
      if (analysisResult.crimeTypes && analysisResult.crimeTypes.length > 0) {
        contextString += `Common crime types include ${analysisResult.crimeTypes.join(", ")}. `;
      }
      
      if (analysisResult.riskFactors.length > 0) {
        contextString += `Risk factors in this area include ${analysisResult.riskFactors.join(", ")}. `;
      }
      
      contextString += `Safety precautions: ${analysisResult.suggestedPrecautions.join(". ")}.`;
      return contextString;
    } else {
      let contextString = `No significant crime history found for ${locationString}. Exercise normal caution. `;
      
      if (analysisResult.suggestedPrecautions.length > 0) {
        contextString += `General safety precautions: ${analysisResult.suggestedPrecautions.join(". ")}.`;
      }
      return contextString;
    }
  } catch (error) {
    console.error("Error getting crime hotspot context:", error);
    return "Crime history data unavailable.";
  }
}

/**
 * Analyze crime hotspots across an entire route
 */
export async function analyzeRouteCrimeHotspots(
  streetViewLocations: Array<{
    streetName?: string;
    criminalHotspot?: CriminalHotspotResponse;
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
        safetyAnalysis: "No location data available for crime analysis.",
        safetySummary: "Safety information unavailable for this route.",
        safetySuggestions: ["Maintain normal awareness.", "Follow standard safety practices."]
      };
    }

    console.log(`Analyzing route crime hotspots across ${streetViewLocations.length} locations`);
    
    // Filter out locations without crime hotspot data
    const locationsWithData = streetViewLocations.filter(loc => 
      loc.criminalHotspot && loc.streetName
    );
    
    if (locationsWithData.length === 0) {
      return {
        overallSafetyScore: 80, // Default to moderately safe
        highRiskAreas: [],
        safetyAnalysis: "No crime data available for locations along this route.",
        safetySummary: "No specific risk areas identified on this route.",
        safetySuggestions: ["Maintain normal awareness.", "Follow standard safety practices."]
      };
    }
    
    // Aggregate crime hotspot data for all locations
    const aggregatedData = {
      locationCount: locationsWithData.length,
      locationsWithCrimeHistory: locationsWithData.filter(loc => 
        loc.criminalHotspot?.hasCrimeHistory
      ).length,
      frequencyBreakdown: {
        none: locationsWithData.filter(loc => loc.criminalHotspot?.crimeFrequency === 'none').length,
        low: locationsWithData.filter(loc => loc.criminalHotspot?.crimeFrequency === 'low').length,
        moderate: locationsWithData.filter(loc => loc.criminalHotspot?.crimeFrequency === 'moderate').length,
        high: locationsWithData.filter(loc => loc.criminalHotspot?.crimeFrequency === 'high').length,
        very_high: locationsWithData.filter(loc => loc.criminalHotspot?.crimeFrequency === 'very_high').length,
        unknown: locationsWithData.filter(loc => loc.criminalHotspot?.crimeFrequency === 'unknown').length
      },
      severityBreakdown: {
        none: locationsWithData.filter(loc => loc.criminalHotspot?.crimeSeverity === 'none').length,
        minor: locationsWithData.filter(loc => loc.criminalHotspot?.crimeSeverity === 'minor').length,
        moderate: locationsWithData.filter(loc => loc.criminalHotspot?.crimeSeverity === 'moderate').length,
        severe: locationsWithData.filter(loc => loc.criminalHotspot?.crimeSeverity === 'severe').length,
        violent: locationsWithData.filter(loc => loc.criminalHotspot?.crimeSeverity === 'violent').length,
        unknown: locationsWithData.filter(loc => loc.criminalHotspot?.crimeSeverity === 'unknown').length
      },
      // Collect all crime types
      crimeTypes: collectUniqueItems(locationsWithData.map(loc => loc.criminalHotspot?.crimeTypes || [])),
      // Collect all risk factors and count occurrences
      riskFactors: collectAndCountItems(locationsWithData.map(loc => loc.criminalHotspot?.riskFactors || [])),
      // Collect all safety precautions and count occurrences
      suggestedPrecautions: collectAndCountItems(locationsWithData.map(loc => loc.criminalHotspot?.suggestedPrecautions || [])),
      // Detailed locations data
      locationDetails: locationsWithData.map(loc => ({
        streetName: loc.streetName || "Unnamed Street",
        hasCrimeHistory: loc.criminalHotspot?.hasCrimeHistory || false,
        crimeFrequency: loc.criminalHotspot?.crimeFrequency || 'unknown',
        crimeSeverity: loc.criminalHotspot?.crimeSeverity || 'unknown',
        crimeTypes: loc.criminalHotspot?.crimeTypes || [],
        analysisText: loc.criminalHotspot?.analysisText || "",
        coordinates: loc.coordinates || { lat: 0, lng: 0 }
      }))
    };
    
    // Calculate a basic safety score based on frequency and severity
    const calculateRawSafetyScore = (): number => {
      const totalLocations = aggregatedData.locationCount;
      if (totalLocations === 0) return 80; // Default
      
      // Calculate score based on crime frequency (higher is better)
      const frequencyScore = (
        (aggregatedData.frequencyBreakdown.none * 100) +
        (aggregatedData.frequencyBreakdown.low * 70) +
        (aggregatedData.frequencyBreakdown.moderate * 50) +
        (aggregatedData.frequencyBreakdown.high * 20) +
        (aggregatedData.frequencyBreakdown.very_high * 0) +
        (aggregatedData.frequencyBreakdown.unknown * 60)
      ) / totalLocations;
      
      // Calculate score based on crime severity (higher is better)
      const severityScore = (
        (aggregatedData.severityBreakdown.none * 100) +
        (aggregatedData.severityBreakdown.minor * 80) +
        (aggregatedData.severityBreakdown.moderate * 60) +
        (aggregatedData.severityBreakdown.severe * 20) +
        (aggregatedData.severityBreakdown.violent * 0) +
        (aggregatedData.severityBreakdown.unknown * 60)
      ) / totalLocations;
      
      // Combine scores with a heavier weight on severity
      return Math.round((frequencyScore * 0.4) + (severityScore * 0.6));
    };
    
    const rawSafetyScore = calculateRawSafetyScore();
    
    // Identify high risk areas (streets with high or very high crime frequency)
    const highRiskAreas = aggregatedData.locationDetails
      .filter(loc => 
        loc.crimeFrequency === 'high' || 
        loc.crimeFrequency === 'very_high' ||
        loc.crimeSeverity === 'severe' ||
        loc.crimeSeverity === 'violent'
      )
      .map(loc => ({
        locationName: loc.streetName,
        reason: loc.analysisText || `${loc.crimeFrequency} crime frequency with ${loc.crimeSeverity} severity`
      }));
    
    // Use Gemini to generate the final analysis
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `
    You are a crime and public safety expert providing an analysis of a route based on crime data.
    
    Route name: ${routeName || "Selected route"}
    
    I'll provide you with aggregated crime data from multiple points along the route.
    Please analyze this data to provide comprehensive safety insights.
    
    AGGREGATED CRIME DATA:
    ${JSON.stringify(aggregatedData, null, 2)}
    
    Raw Safety Score (0-100, higher is safer): ${rawSafetyScore}
    
    Based on the data above, provide the following:
    
    1. SAFETY SCORE ADJUSTMENT: Review the raw safety score (${rawSafetyScore}) and adjust it if needed based on your expert analysis. The final score should be between a scale of 0-100, where higher is safer.
    
    2. SAFETY ANALYSIS: A detailed 4-6 sentence analysis of the overall route safety, focusing on crime patterns, risk factors, and severity. Analyze how the different segments of the route compare in terms of safety. 
    
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
    - Base suggestions on the actual crime types identified in the data
    - Keep your language clear and concise
    - Address different times of day if relevant (day vs night safety)
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
      safetyAnalysis: "Analysis of crime hotspots along this route shows varied levels of safety concerns. Exercise appropriate caution especially in areas with higher crime frequency.",
      safetySummary: `Route has ${highRiskAreas.length} high-risk areas out of ${aggregatedData.locationCount} analyzed locations.`,
      safetySuggestions: aggregatedData.suggestedPrecautions.slice(0, 5).map(item => item.text)
    };
    
  } catch (error) {
    console.error("Error analyzing route crime hotspots:", error);
    return {
      overallSafetyScore: 70, // Default to moderately safe
      highRiskAreas: [],
      safetyAnalysis: "Error while analyzing crime data for this route.",
      safetySummary: "Route safety information unavailable.",
      safetySuggestions: ["Maintain appropriate awareness.", "Follow standard safety practices."]
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

// Helper function to collect unique items from multiple arrays
function collectUniqueItems(arrays: Array<string[]>): string[] {
  const uniqueItems = new Set<string>();
  
  arrays.forEach(array => {
    array.forEach(item => {
      uniqueItems.add(item);
    });
  });
  
  return Array.from(uniqueItems);
}

export default {
  getCriminalHotspotData,
  getCrimeHotspotContext,
  analyzeRouteCrimeHotspots
}; 