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

/**
 * Analyzes a street view image and returns a risk score
 */
export const analyzeStreetViewImage = async (imageUrl: string): Promise<number> => {
  try {
    const model = genAI.getGenerativeModel({ model: modelName });
    
    // Convert image URL to Blob for Gemini API
    const response = await fetch(imageUrl);
    if (!response.ok) {
      console.error(`Failed to fetch image: ${response.statusText}`);
      return 0;
    }
    
    const imageBlob = await response.blob();
    
    // Convert Blob to base64 data URL
    const base64String = await blobToBase64(imageBlob);
    
    // Set up prompt for image analysis
    const prompt = `
      Please analyze this street view image for driving safety and road conditions.
      Rate the overall risk level on a scale of 0-100, where:
      0 = Completely safe with no visible risks
      50 = Moderate risk with some potential hazards
      100 = Extremely dangerous with multiple severe hazards
      
      Consider factors like:
      - Road conditions
      - Visibility
      - Traffic density
      - Pedestrian activity
      - Construction
      - Narrow roads or sharp curves
      - Environmental factors (weather, lighting)
      
      Return only a single number between 0-100 representing the risk score.
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
    
    // Extract the risk score from the response
    const responseText = result.response.text().trim();
    const riskScore = parseInt(responseText);
    
    // Validate the response
    if (isNaN(riskScore) || riskScore < 0 || riskScore > 100) {
      console.error(`Invalid risk score from Gemini: ${responseText}`);
      return 50; // Default to medium risk if response is invalid
    }
    
    return riskScore;
  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    return 50; // Default to medium risk on error
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
 * Analyzes multiple street view images and returns their risk scores
 */
export const analyzeStreetViewImages = async (imageUrls: string[]): Promise<number[]> => {
  if (!imageUrls.length) return [];
  
  // Process images in parallel with a limit of 3 concurrent requests
  const riskScores: number[] = [];
  const concurrencyLimit = 3;
  
  for (let i = 0; i < imageUrls.length; i += concurrencyLimit) {
    const batch = imageUrls.slice(i, i + concurrencyLimit);
    const batchResults = await Promise.all(
      batch.map(url => analyzeStreetViewImage(url))
    );
    riskScores.push(...batchResults);
  }
  
  return riskScores;
};

/**
 * Calculates the average risk score from an array of risk scores
 */
export const calculateAverageRiskScore = (riskScores: number[]): number => {
  if (!riskScores.length) return 0;
  const sum = riskScores.reduce((acc, score) => acc + score, 0);
  return Math.round(sum / riskScores.length);
}; 