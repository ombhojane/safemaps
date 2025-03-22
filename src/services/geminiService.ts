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
export const analyzeStreetViewImage = async (imageUrl: string): Promise<ImageAnalysisResponse> => {
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
    
    // Set up prompt for image analysis
    const prompt = `
      Analyze this street view image for driving safety and road conditions.
      
      1. Rate the overall risk level on a scale of 0-100, where:
         0 = Completely safe with no visible risks
         50 = Moderate risk with some potential hazards
         100 = Extremely dangerous with multiple severe hazards
      
      2. Provide a single, concise sentence explaining the main safety concern or feature visible in this image.
      
      3. Give one short, practical precaution drivers should take when driving through this area.
      
      Format your response exactly like this with one line for each:
      Risk Score: [number 0-100]
      Explanation: [one concise sentence about main safety feature or concern]
      Precaution: [one brief, actionable driving tip]
    `;
    
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
export const analyzeStreetViewImages = async (imageUrls: string[]): Promise<{
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
      batch.map(url => analyzeStreetViewImage(url))
    );
    
    batchResults.forEach(result => {
      riskScores.push(result.riskScore);
      explanations.push(result.explanation);
      precautions.push(result.precaution);
    });
  }
  
  return { riskScores, explanations, precautions };
};

/**
 * Calculates the average risk score from an array of risk scores
 */
export const calculateAverageRiskScore = (riskScores: number[]): number => {
  if (!riskScores.length) return 0;
  const sum = riskScores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / riskScores.length);
}; 