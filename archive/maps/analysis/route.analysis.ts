import { Route } from "../types";
import { analyzeStreetViewImages, calculateAverageRiskScore } from "@/services/geminiService";
import { dispatchRouteAnalysisComplete } from "./events";

/**
 * Analyze all routes with AI
 */
export const analyzeAllRoutes = async (routes: Route[]) => {
  try {
    // Process routes in parallel with Promise.all
    await Promise.all(routes.map(async (route) => {
      if (!route.streetViewImages || route.streetViewImages.length === 0) return;
      
      // Update route to show it's being analyzed
      route.geminiAnalysis = {
        riskScores: [],
        averageRiskScore: 0,
        isAnalyzing: true
      };
      
      // Dispatch an event to notify that analysis has started
      dispatchRouteAnalysisComplete(route);
      
      try {
        // Use all street view images since they're now already optimally sampled
        const imagesToAnalyze = route.streetViewImages;
        
        // Include weather information in the Gemini analysis prompt if available
        let weatherInfo = "";
        if (route.weather) {
          weatherInfo = `Current weather conditions: ${route.weather.condition}, ${route.weather.temperature}°C, ${route.weather.description}. Wind speed: ${route.weather.windSpeed} m/s. Humidity: ${route.weather.humidity}%.`;
        }
        
        // Get analysis results including explanations and precautions, passing weather info
        const analysisResults = await analyzeStreetViewImages(imagesToAnalyze, weatherInfo);
        const averageRiskScore = calculateAverageRiskScore(analysisResults.riskScores);
        
        // Update route with analysis results
        route.geminiAnalysis = {
          riskScores: analysisResults.riskScores,
          explanations: analysisResults.explanations,
          precautions: analysisResults.precautions,
          averageRiskScore,
          isAnalyzing: false
        };
        
        // Dispatch an event to notify UI components about the completed analysis
        dispatchRouteAnalysisComplete(route);
      } catch (analysisError) {
        // Handle errors for individual route analysis
        console.error(`Error analyzing route ${route.id}:`, analysisError);
        
        // Update route to show analysis failed
        route.geminiAnalysis = {
          riskScores: [],
          averageRiskScore: 0,
          isAnalyzing: false,
          error: 'Analysis failed'
        };
        
        // Dispatch event with failure state
        dispatchRouteAnalysisComplete(route);
      }
    }));
  } catch (error) {
    console.error('Error analyzing routes with Gemini:', error);
  }
}; 