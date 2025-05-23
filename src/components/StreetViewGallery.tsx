import { useState, useEffect } from "react";
import { ArrowLeft, ArrowRight, MapPin, BarChart, AlertCircle, Lightbulb, MapPinIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { analyzeStreetViewImages, calculateAverageRiskScore } from "@/services/geminiService";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { StreetViewLocation } from "@/types";

interface StreetViewGalleryProps {
  images: string[];
  className?: string;
  onAnalysisComplete?: (riskScores: number[], averageRiskScore: number, explanations: string[], precautions: string[]) => void;
  geminiAnalysis?: {
    riskScores: number[];
    averageRiskScore: number;
    isAnalyzing: boolean;
    explanations?: string[];
    precautions?: string[];
  };
  locations?: StreetViewLocation[];
  onImageClick?: (location: StreetViewLocation) => void;
  currentlyViewedLocationIndex?: number;
}

const StreetViewGallery = ({ 
  images, 
  className, 
  onAnalysisComplete,
  geminiAnalysis,
  locations = [],
  onImageClick,
  currentlyViewedLocationIndex
}: StreetViewGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [viewingOnMap, setViewingOnMap] = useState(false);
  const [selectedForViewing, setSelectedForViewing] = useState<StreetViewLocation | null>(null);

  // Set the current index to match the currently viewed location when it changes
  useEffect(() => {
    if (currentlyViewedLocationIndex !== undefined && currentlyViewedLocationIndex >= 0 && currentlyViewedLocationIndex < images.length) {
      setCurrentIndex(currentlyViewedLocationIndex);
      setViewingOnMap(true);
      
      // Reset the viewing state after a short time for visual feedback
      const timer = setTimeout(() => {
        setViewingOnMap(false);
      }, 2000);
      
      return () => clearTimeout(timer);
    }
  }, [currentlyViewedLocationIndex, images?.length]);

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

  // Handle image click to emit location data
  const handleImageClick = (location: StreetViewLocation) => {
    if (onImageClick) {
      console.log("Image clicked, location data:", location);
      
      // Create a copy of the location to avoid any reference issues
      const locationCopy = {
        ...location,
        coordinates: {
          lat: location.coordinates.lat,
          lng: location.coordinates.lng
        }
      };
      
      onImageClick(locationCopy);
      setViewingOnMap(true);
      setSelectedForViewing(locationCopy);
      
      // Reset the viewing state after a short time for visual feedback
      setTimeout(() => {
        setViewingOnMap(false);
      }, 2000);
    } else {
      console.warn("Cannot show location - missing data", { 
        hasClickHandler: Boolean(onImageClick),
        hasLocations: Boolean(locations),
        currentIndex,
        locationsLength: locations?.length
      });
    }
  };

  const handleAnalyzeImages = async () => {
    if (!onAnalysisComplete) return;
    
    setIsAnalyzing(true);
    try {
      // First send empty scores to indicate analysis has started
      onAnalysisComplete([], 0, [], []);
      
      // Then perform the actual analysis
      const analysisResults = await analyzeStreetViewImages(images);
      const averageRiskScore = calculateAverageRiskScore(analysisResults.riskScores);
      onAnalysisComplete(
        analysisResults.riskScores, 
        averageRiskScore,
        analysisResults.explanations,
        analysisResults.precautions
      );
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

  const activeLocationStyle = (locationIndex: number) => {
    if (locationIndex === locations.findIndex((loc) => 
        loc.coordinates.lat === selectedForViewing?.coordinates.lat && 
        loc.coordinates.lng === selectedForViewing?.coordinates.lng)) {
      return "ring-4 ring-purple-600 scale-105 shadow-lg z-10 transition-all duration-200";
    }
    return "";
  };

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
            {isAnalyzing ? "Analyzing..." : "Analyze Route Safety with AI"}
            <BarChart className="ml-2 h-4 w-4" />
          </Button>
        )}

        {(isAnalyzing || geminiAnalysis?.isAnalyzing) && (
          <div className="p-4 border rounded-lg bg-muted">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-blue-500" />
              <p className="text-sm font-medium">Analyzing route safety with AI...</p>
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

      {/* Individual Street View Image Card */}
      <div className="w-full relative">
        <div className="relative group overflow-hidden rounded-lg border">
          {/* Main Street View Image - add onClick handler */}
          <img
            src={images[currentIndex]}
            alt={`Street view at point ${currentIndex + 1}`}
            className={cn(
              "w-full h-[300px] object-cover cursor-pointer",
              viewingOnMap && "ring-4 ring-primary ring-opacity-80"
            )}
            onClick={() => handleImageClick(locations[currentIndex])}
          />

          {/* Street Name Label - simple, without accident data */}
          {locations[currentIndex]?.streetName && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 p-2 text-white text-sm">
              {locations[currentIndex].streetName}
            </div>
          )}

          {/* Image Navigation Controls */}
          <div className="absolute inset-0 flex items-center justify-between p-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="secondary"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                goToPrevious();
              }}
              disabled={currentIndex === 0}
              className="h-8 w-8 rounded-full bg-black/50 text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              onClick={(e) => {
                e.stopPropagation();
                goToNext();
              }}
              disabled={currentIndex === images.length - 1}
              className="h-8 w-8 rounded-full bg-black/50 text-white"
            >
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Image Counter */}
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
            {currentIndex + 1} / {images.length}
          </div>
        </div>
      </div>

      {/* Image Analysis Information */}
      {(geminiAnalysis?.explanations && geminiAnalysis.explanations[currentIndex]) || 
       locations[currentIndex]?.accidentHotspot ? (
        <div className="mt-2 mb-3 p-3 border rounded-md bg-card text-sm">
          <div className="flex flex-col gap-2">
            {/* Gemini Analysis */}
            {geminiAnalysis?.explanations && geminiAnalysis.explanations[currentIndex] && (
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p>{geminiAnalysis.explanations[currentIndex]}</p>
              </div>
            )}
            
            {/* Accident Hotspot Analysis */}
            {locations[currentIndex]?.accidentHotspot && (
              <>
                <div className="flex items-start gap-2">
                  <MapPinIcon className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex flex-col gap-1">
                    <p className="font-medium">Accident History Analysis</p>
                    <p className="text-muted-foreground">{locations[currentIndex].accidentHotspot.analysisText}</p>
                  </div>
                </div>
                
                {locations[currentIndex].accidentHotspot.riskFactors?.length > 0 && (
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col gap-1">
                      <p className="font-medium">Risk Factors:</p>
                      <ul className="list-disc list-inside text-muted-foreground">
                        {locations[currentIndex].accidentHotspot.riskFactors.map((factor, idx) => (
                          <li key={idx}>{factor}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Safety Precautions */}
            {(geminiAnalysis?.precautions?.[currentIndex] || 
              locations[currentIndex]?.accidentHotspot?.suggestedPrecautions?.length > 0) && (
              <div className="flex items-start gap-2">
                <Lightbulb className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                <div className="flex flex-col gap-1">
                  <p className="font-medium">Safety Tips:</p>
                  <ul className="list-disc list-inside text-muted-foreground">
                    {locations[currentIndex]?.accidentHotspot?.suggestedPrecautions?.map((tip, idx) => (
                      <li key={`hotspot-${idx}`}>{tip}</li>
                    ))}
                    {geminiAnalysis?.precautions?.[currentIndex] && (
                      <li key="gemini">{geminiAnalysis.precautions[currentIndex]}</li>
                    )}
                  </ul>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Thumbnail Navigation */}
      <div className="flex gap-1 overflow-x-auto py-1">
        {locations.map((location, index) => (
          <div
            key={index}
            className={`relative flex-shrink-0 w-48 h-36 md:w-56 md:h-44 cursor-pointer group overflow-hidden rounded-lg ${activeLocationStyle(index)}`}
            onClick={() => handleImageClick(location)}
          >
            <img
              src={images[index] || ''}
              alt={`Street view ${index + 1}`}
              className="object-cover w-full h-full transition-transform duration-300 group-hover:scale-105"
            />
            
            {/* Add Street Name Overlay */}
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-white">
              <p className="text-sm font-medium truncate">
                {location.streetName || `Location ${index + 1}`}
              </p>
            </div>
            
            {/* Selected Indicator */}
            {activeLocationStyle(index) && (
              <div className="absolute top-2 right-2 bg-purple-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow-md">
                Selected
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default StreetViewGallery; 