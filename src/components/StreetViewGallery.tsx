import { useState } from "react";
import { ArrowLeft, ArrowRight, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface StreetViewGalleryProps {
  images: string[];
  className?: string;
}

const StreetViewGallery = ({ images, className }: StreetViewGalleryProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);

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

  return (
    <div className={cn("w-full flex flex-col gap-2", className)}>
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
      </div>

      {/* Thumbnail Navigation */}
      <div className="flex gap-1 overflow-x-auto py-1">
        {images.map((image, index) => (
          <button
            key={index}
            className={cn(
              "flex-shrink-0 w-16 h-16 rounded overflow-hidden border-2",
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
          </button>
        ))}
      </div>
    </div>
  );
};

export default StreetViewGallery; 