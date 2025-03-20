
import React, { useEffect, useRef, useState } from 'react';
import { Route, RiskArea } from '@/types';
import { cn } from '@/lib/utils';
import { LucideInfo, MapPin } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface MapProps {
  route?: Route | null;
  riskAreas?: RiskArea[];
  isLoading?: boolean;
  className?: string;
}

const Map = ({ route, riskAreas, isLoading, className }: MapProps) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [showDemo, setShowDemo] = useState<boolean>(true);
  
  // This is a simulated map with a static image for the demo
  // In a real implementation, this would use a mapping library like Mapbox, Google Maps, or Leaflet
  
  useEffect(() => {
    // Simulate map loading
    const timer = setTimeout(() => {
      setShowDemo(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  // Calculate the risk color based on risk score
  const getRiskColor = (score?: number) => {
    if (!score) return 'bg-gray-400';
    if (score < 3) return 'bg-risk-low';
    if (score < 6) return 'bg-risk-medium';
    return 'bg-risk-high';
  };

  const getRiskLevelColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'bg-risk-low';
      case 'medium': return 'bg-risk-medium';
      case 'high': return 'bg-risk-high';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div 
      ref={mapContainerRef} 
      className={cn("relative w-full h-full rounded-lg overflow-hidden shadow-lg", className)}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex items-center justify-center bg-muted">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            <p className="text-muted-foreground animate-pulse">Loading map...</p>
          </div>
        </div>
      ) : (
        <>
          {/* Demo map background */}
          <div className="absolute inset-0 bg-[#f8f9fa] dark:bg-[#242526]">
            {/* Grid pattern to simulate a map */}
            <div className="absolute inset-0" style={{ 
              backgroundImage: `linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), 
                              linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)`,
              backgroundSize: '20px 20px' 
            }}></div>
          </div>

          {/* Simulated map content */}
          {route && (
            <div className="absolute inset-0 p-4">
              {/* Source marker */}
              <div className="absolute animate-pulse-slow" style={{ 
                left: '20%', 
                top: '60%',
                transform: 'translate(-50%, -50%)'
              }}>
                <div className="relative">
                  <div className="absolute -inset-2 bg-primary/20 rounded-full animate-ping opacity-50"></div>
                  <div className="w-6 h-6 bg-primary rounded-full border-2 border-white shadow-md"></div>
                </div>
                <div className="glassmorphism mt-2 px-2 py-1 rounded-md text-xs font-medium text-center shadow-sm">
                  {route.source.name}
                </div>
              </div>

              {/* Destination marker */}
              <div className="absolute" style={{ 
                left: '75%', 
                top: '30%',
                transform: 'translate(-50%, -50%)'
              }}>
                <div className="relative">
                  <div className="absolute -inset-3 bg-primary/20 rounded-full animate-ping opacity-50"></div>
                  <div className="w-6 h-6 bg-primary rounded-full border-2 border-white shadow-md"></div>
                </div>
                <div className="glassmorphism mt-2 px-2 py-1 rounded-md text-xs font-medium text-center shadow-sm">
                  {route.destination.name}
                </div>
              </div>

              {/* Route line */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 5 }}>
                <path 
                  d={`M ${20}% ${60}% Q ${45}% ${40}%, ${75}% ${30}%`}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray="8,8"
                  className="animate-dash"
                  style={{ 
                    strokeDashoffset: '0',
                    animation: 'dash 30s linear infinite',
                    strokeDasharray: '8,6' 
                  }}
                />
              </svg>

              {/* Risk areas */}
              {riskAreas?.map((area, index) => (
                <TooltipProvider key={area.id} delayDuration={0}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div 
                        className="absolute cursor-pointer animate-float"
                        style={{ 
                          left: `${25 + index * 12}%`, 
                          top: `${45 + (index % 3) * 8}%`,
                          transform: 'translate(-50%, -50%)',
                          zIndex: 10,
                          animationDelay: `${index * 0.5}s`
                        }}
                      >
                        <div className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center shadow-lg border-2 border-white",
                          getRiskLevelColor(area.riskLevel)
                        )}>
                          <MapPin className="w-4 h-4 text-white" />
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className={cn(
                            "w-3 h-3 rounded-full", 
                            getRiskLevelColor(area.riskLevel)
                          )}></span>
                          <span className="font-medium capitalize">{area.riskLevel} Risk Area</span>
                        </div>
                        <p className="text-sm text-muted-foreground">{area.description}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ))}
            </div>
          )}

          {/* Map overlay for glass effect */}
          <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent to-background/10 rounded-lg"></div>

          {/* Show starting instructions if no route */}
          {!route && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center space-y-3 p-6 max-w-md mx-auto">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-10 h-10 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Enter your route</h3>
                <p className="text-muted-foreground">
                  Enter your source and destination to analyze potential risk areas along different routes.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Map;
