import { GoogleGenerativeAI } from "@google/generative-ai";

// Get API key from environment variables
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(API_KEY);

// Model configuration
const modelName = "gemini-1.5-flash";
const generationConfig = {
  temperature: 0,
  topP: 0.95,
  topK: 64,
  maxOutputTokens: 1024,
};

// Response type for image analysis
interface ImageAnalysisResponse {
  riskScore: number;
  explanation: string;
  precaution: string;
}

/**
 * Analyzes a street view image and returns a risk score with explanation
 */
export const analyzeStreetViewImage = async (
  imageUrl: string, 
  contextInfo: string = ""
): Promise<ImageAnalysisResponse> => {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Convert image URL to Blob for Gemini API
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.statusText}`);
      return { 
        riskScore: 50, 
        explanation: "Could not analyze image.",
        precaution: "Drive with caution."
      };
    }
    
    const imageBlob = await response.blob();
    
    // Convert Blob to base64 data URL
    const base64String = await blobToBase64(imageBlob);
    
    const systemInstructions = `
    You are analyzing street view images for driving safety in India. Follow these precise calibration guidelines:

    1. SCORING CALIBRATION:
    - Good, normal roads with minimal hazards should score in the 15-25 range
    - Well-maintained highways with proper infrastructure: 15-20
    - Decent urban/rural roads with minor imperfections: 20-30
    - Roads with moderate safety concerns: 30-45
    - Roads with significant hazards: 45-60
    - Reserve scores above 60 for dangerous conditions requiring exceptional caution
    - Scores below 15 indicate exceptionally safe, well-maintained roads with superior infrastructure

    2. CRITICAL SAFETY FACTORS (must increase score significantly):
    - Blind curves or severely limited visibility: +10-15 points
    - Dangerous intersections without proper controls: +10-15 points
    - Very narrow roads with two-way traffic: +10-15 points
    - Heavy traffic with significant congestion: +8-12 points
    - Presence of heavy vehicles in constrained spaces: +8-12 points
    - Significant road damage or obstructions: +8-12 points
    - Poor lighting in night conditions: +8-12 points
    - Areas with mixed, unpredictable traffic flows: +5-10 points
    - Construction zones with inadequate marking: +5-10 points

    3. REGIONAL CONTEXT ADJUSTMENTS:
    - Standard narrow roads common in India should receive modest scores (5-10)
    - Consider typical Indian road widths as baseline (5-8 points)
    - Absence of median barriers is common in India (add only 2-5 points unless on high-speed roads)
    - Normal Indian traffic density should receive modest scores (5-8)
    - Mixed vehicle types are standard in India (add points only for extreme diversity)
    - The presence of occasional pedestrians is common in India (add points only for heavy pedestrian activity)
    - Common minor road imperfections should receive minimal scores (1-3)
    - Judge road surface quality relative to local norms, not international standards

    4. ACCIDENT HOTSPOT CONSIDERATION:
    - When accident history data is provided, prioritize it in your safety assessment (weight 25% of final score)
    - For locations with confirmed accident history, add points based on frequency:
      * Low frequency: +5-10 points
      * Moderate frequency: +10-15 points
      * High frequency: +15-20 points
      * Very high frequency: +20-25 points
    - Add additional points based on severity:
      * Minor accidents: +0-5 points
      * Moderate accidents: +5-10 points
      * Severe accidents: +10-15 points
      * Fatal accidents: +15-20 points
    - Pay special attention to specific risk factors mentioned in accident data
    - When specific precautions are suggested in accident data, incorporate them in your recommendations
    - If accident data exists but visual assessment shows good conditions, still maintain at least a moderate risk score (30+)
    - If multiple accidents with fatalities are reported, the risk score should be at least 50
    - Consider recency - accidents in the past 3 months add an additional +5 points compared to older accidents
    - When multiple news sources report the same accident, treat this as confirmation of a significant incident
    - For locations that are explicitly mentioned as "accident-prone" or "black spots", add +15-20 points
    - Include specific precautions directly related to the accident types identified (e.g., "reduce speed on curves" if accidents involved vehicles losing control on curves)
    - For nearby locations (not exact match), apply a proximity factor: adjacent streets (80% of points), same neighborhood (60% of points), same district (40% of points)
    - If search results mention no accidents, this is a POSITIVE safety indicator - reduce the final risk score by 5-10 points from what visual analysis alone would suggest

    5. AVOIDING UNDER-SCORING OF HAZARDS:
    - Do not minimize real safety hazards present in the image
    - If multiple safety concerns are present, they should have a cumulative effect
    - Carefully evaluate visibility, road geometry, and traffic patterns
    - Properly account for situations requiring heightened driver attention
    - Never rate a road with significant hazards below 30

    6. FACTOR WEIGHTAGES (out of 100):
    - Road Infrastructure: 30% (geometry, lanes, barriers, shoulders, intersections)
    - Traffic Conditions: 25% (congestion, merging, vehicle mix, flow patterns)
    - Accident History: 25% (apply only when data is available, redistribute to other factors if none)
    - Environmental Factors: 10% (weather, lighting, visibility, surface conditions)
    - Human Factors: 10% (pedestrians, construction, attention demands, unpredictable elements)

    7. OUTPUT FORMAT:
    - Provide only the Risk Score, Explanation, and Precaution in your response
    - Do not include scoring criteria or calibration guidelines in your output
    `;

    const userPrompt = `
    Analyze this street view image for driving safety and road conditions, focusing on evidence-based risk factors.
    ${contextInfo ? `Additional context: ${contextInfo}` : ''}

    Evaluate the following key safety parameters:

    ROAD INFRASTRUCTURE (0-30 points):
    - Road type and design: Evaluate road geometry, curves, grades, and design hazards
    - Lane width and count: Assess adequate space for vehicle operation
    - Dividers/barriers: Note presence or absence of median barriers and guardrails
    - Shoulder conditions: Evaluate space available for emergency stops
    - Intersection complexity: Consider junction design and control measures
    - Special structures: Note bridges, tunnels, or other specialized road features

    TRAFFIC CONDITIONS (0-25 points):
    - Congestion: Assess vehicle density and flow constraints
    - Merging zones: Identify areas requiring lane changes or merging
    - Vehicle mix: Note diversity of vehicle types (trucks, cars, two-wheelers)
    - Traffic patterns: Evaluate predictability and consistency of traffic flow

    ENVIRONMENTAL FACTORS (0-20 points):
    - Weather conditions: Assess precipitation, fog, or other weather impacts
    - Lighting conditions: Evaluate natural and artificial lighting adequacy
    - Visibility: Note sight distance limitations from curves, hills, or obstructions
    - Road surface: Identify wet, icy, or degraded surface conditions

    HUMAN FACTORS (0-15 points):
    - Pedestrian zones: Note areas with pedestrian presence or crossings
    - Construction: Identify work zones or temporary road configurations
    - Attention demands: Assess navigation complexity and decision points
    - Unpredictable elements: Note potential for sudden changes (shops, bus stops)

    INFRASTRUCTURE QUALITY (0-10 points):
    - Road surface quality: Assess pavement condition and maintenance
    - Street lighting: Evaluate presence and adequacy of illumination
    - Traffic signals/signs: Note presence and condition of traffic controls

    ACCIDENT HISTORY FACTOR (0-25 points):
    - If accident history context is provided, use this information to adjust the risk score
    - Consider both the frequency and severity of past accidents
    - Add appropriate points based on accident history severity

    Calculate a TOTAL RISK SCORE by adding points across all categories, where higher points indicate higher risk.

    Format your response exactly like this with one line for each:
    Risk Score: [number 0-100]
    Explanation: [one concise sentence about main safety feature or concern]
    Precaution: [one brief, actionable driving tip]
    `;

    const prompt = systemInstructions + "\n\n" + userPrompt;

    // Send the image and prompt to Gemini
    const result = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { inlineData: { 
                mimeType: imageBlob.type,
                data: base64String.split(',')[1] // Remove the data URL prefix
              } 
            }
          ]
        }
      ],
      generationConfig
    });
    
    // Extract the response text
    const responseText = result.response.text().trim();
    
    // Parse the structured response
    const riskScoreMatch = responseText.match(/Risk Score: (\d+)/i);
    const explanationMatch = responseText.match(/Explanation: (.+?)(?:\n|$)/i);
    const precautionMatch = responseText.match(/Precaution: (.+?)(?:\n|$)/i);
    
    const riskScore = riskScoreMatch ? parseInt(riskScoreMatch[1]) : 50;
    const explanation = explanationMatch ? explanationMatch[1].trim() : "No explanation provided.";
    const precaution = precautionMatch ? precautionMatch[1].trim() : "Drive with caution.";
    
    // Validate the risk score
    const validatedRiskScore = (isNaN(riskScore) || riskScore < 0 || riskScore > 100) ? 50 : riskScore;
    
    return {
      riskScore: validatedRiskScore,
      explanation,
      precaution
    };
  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    return { 
      riskScore: 50, 
      explanation: "Analysis error.",
      precaution: "Drive with caution."
    };
  }
};

/**
 * Convert a Blob to a base64-encoded data URL
 */
const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Analyzes multiple street view images and returns their risk scores with explanations
 */
export const analyzeStreetViewImages = async (
  imageUrls: string[],
  contextInfo: string = ""
): Promise<{
  riskScores: number[];
  explanations: string[];
  precautions: string[];
}> => {
  if (!imageUrls.length) return { riskScores: [], explanations: [], precautions: [] };
  
  // Process images in parallel with a limit of 3 concurrent requests
  const riskScores: number[] = [];
  const explanations: string[] = [];
  const precautions: string[] = [];
  const concurrencyLimit = 3;
  
  for (let i = 0; i < imageUrls.length; i += concurrencyLimit) {
    const batch = imageUrls.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(
      batch.map(url => analyzeStreetViewImage(url, contextInfo))
    );
    
    batchResults.forEach(result => {
      riskScores.push(result.riskScore);
      explanations.push(result.explanation);
      precautions.push(result.precaution);
    });
  }
  
  return {
    riskScores,
    explanations,
    precautions
  };
};

/**
 * Calculates the average risk score from an array of risk scores
 */
export const calculateAverageRiskScore = (riskScores: number[]): number => {
  if (!riskScores.length) return 0;
  const sum = riskScores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / riskScores.length);
}; 