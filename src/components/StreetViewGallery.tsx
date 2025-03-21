import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, MapPin, BarChart, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { analyzeStreetViewImages, calculateAverageRiskScore } from "@/services/geminiService";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface StreetViewGalleryProps {
  images: string[];
  className?: string;
  onAnalysisComplete?: (riskScores: number[], averageRiskScore: number) => void;
  geminiAnalysis?: {
    riskScores: number[];
    averageRiskScore: number;
    isAnalyzing: boolean;
  };
}

const StreetViewGallery = ({ 
  images, 
  className, 
  onAnalysisComplete,
  geminiAnalysis 
}: StreetViewGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);

  // No images to display
  if (!images || images.length === 0) {
    return (
      <div className={cn("rounded-lg bg-muted p-4 text-center", className)}>
        <div className="flex flex-col items-center justify-center p-6">
          <MapPin className="h-8 w-8 text-muted-foreground mb-2" />
          <h3 className="text-base font-medium mb-1">No Street View Available</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Street view imagery is not available for this route.
          </p>
        </div>
      </div>
    );
  }

  const goToPrevious = () => {
    setCurrentIndex((prevIndex) => (prevIndex > 0 ? prevIndex - 1 : prevIndex));
  };

  const goToNext = () => {
    setCurrentIndex((prevIndex) => (prevIndex < images.length - 1 ? prevIndex + 1 : prevIndex));
  };

  const handleAnalyzeImages = async () => {
    if (!onAnalysisComplete) return;
    
    setIsAnalyzing(true);
    try {
      // First send empty scores to indicate analysis has started
      onAnalysisComplete([], 0);
      
      // Then perform the actual analysis
      const riskScores = await analyzeStreetViewImages(images);
      const averageRiskScore = calculateAverageRiskScore(riskScores);
      onAnalysisComplete(riskScores, averageRiskScore);
    } catch (error) {
      console.error("Error analyzing images:", error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Helper to get risk color
  const getRiskColor = (score: number) => {
    if (score <= 30) return "bg-green-500";
    if (score <= 60) return "bg-yellow-500";
    return "bg-red-500";
  };

  // Helper to get risk level text
  const getRiskLevelText = (score: number) => {
    if (score <= 30) return "Low Risk";
    if (score <= 60) return "Medium Risk";
    return "High Risk";
  };

  // Update progress periodically during analysis
  useEffect(() => {
    if (!isAnalyzing && !geminiAnalysis?.isAnalyzing) {
      setProgress(0);
      return;
    }

    // Simulate progress for visual feedback
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 10;
      });
    }, 800);

    return () => clearInterval(interval);
  }, [isAnalyzing, geminiAnalysis?.isAnalyzing]);

  return (
    <div className={cn("w-full flex flex-col gap-2", className)}>
      {/* Risk Analysis Action and Results */}
      <div className="w-full mb-2 flex flex-col gap-2">
        {!isAnalyzing && !geminiAnalysis?.isAnalyzing && !geminiAnalysis?.riskScores?.length && (
          <Button 
            onClick={handleAnalyzeImages}
            disabled={isAnalyzing || geminiAnalysis?.isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Route Safety with Gemini AI"}
            <BarChart className="ml-2 h-4 w-4" />
          </Button>
        )}

        {(isAnalyzing || geminiAnalysis?.isAnalyzing) && (
          <div className="p-4 border rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <p className="text-sm font-medium">Analyzing route safety with Gemini AI...</p>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {geminiAnalysis?.riskScores && geminiAnalysis.riskScores.length > 0 && (
          <div className="p-4 border rounded-lg bg-card">
            <div className="flex flex-col gap-2">
              <h3 className="text-base font-medium">AI Safety Analysis</h3>
              
              {/* Average Risk Score */}
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">Average Risk Score:</span>
                <div className="flex items-center gap-2">
                  <Badge className={cn(
                    "text-white",
                    getRiskColor(geminiAnalysis.averageRiskScore)
                  )}>
                    {getRiskLevelText(geminiAnalysis.averageRiskScore)}
                  </Badge>
                  <span className="font-medium">{geminiAnalysis.averageRiskScore}/100</span>
                </div>
              </div>
              
              {/* Risk Score Progress Bar */}
              <div className="w-full h-4 bg-muted rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full",
                    getRiskColor(geminiAnalysis.averageRiskScore)
                  )}
                  style={{ width: `${geminiAnalysis.averageRiskScore}%` }}
                ></div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="relative rounded-lg overflow-hidden border">
        {/* Main Street View Image */}
        <img
          src={images[currentIndex]}
          alt={`Street view at point ${currentIndex + 1}`}
          className="w-full h-[300px] object-cover"
        />

        {/* Navigation Controls */}
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={goToPrevious}
            disabled={currentIndex === 0}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full bg-background/80 backdrop-blur-sm hover:bg-background/90"
            onClick={goToNext}
            disabled={currentIndex === images.length - 1}
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Location Indicator */}
        <div className="absolute bottom-2 right-2 py-1 px-2 rounded bg-background/80 backdrop-blur-sm text-xs font-medium">
          {currentIndex + 1} / {images.length}
        </div>

        {/* Risk Score Indicator (if available) */}
        {geminiAnalysis?.riskScores && geminiAnalysis.riskScores[currentIndex] !== undefined && (
          <div className="absolute top-2 right-2 py-1 px-3 rounded-full bg-background/90 backdrop-blur-sm flex items-center gap-1.5">
            <span className="text-xs font-medium">Risk:</span>
            <span 
              className={cn(
                "text-sm font-bold",
                geminiAnalysis.riskScores[currentIndex] <= 30 ? "text-green-500" :
                geminiAnalysis.riskScores[currentIndex] <= 60 ? "text-yellow-500" :
                "text-red-500"
              )}
            >
              {geminiAnalysis.riskScores[currentIndex]}/100
            </span>
          </div>
        )}
      </div>

      {/* Thumbnail Navigation */}
      <div className="flex gap-1 overflow-x-auto py-1">
        {images.map((image, index) => (
          <button
            key={index}
            className={cn(
              "flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2 relative",
              index === currentIndex
                ? "border-primary"
                : "border-transparent opacity-70 hover:opacity-100"
            )}
            onClick={() => setCurrentIndex(index)}
          >
            <img
              src={image}
              alt={`Thumbnail ${index + 1}`}
              className="w-full h-full object-cover"
            />
            
            {/* Small Risk Indicator on Thumbnails */}
            {geminiAnalysis?.riskScores && geminiAnalysis.riskScores[index] !== undefined && (
              <div className={cn(
                "absolute bottom-0 inset-x-0 h-1.5",
                getRiskColor(geminiAnalysis.riskScores[index])
              )}></div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default StreetViewGallery; 