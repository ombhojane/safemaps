
import { RiskArea } from "@/types";
import { cn } from "@/lib/utils";
import { AlertTriangle, Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface RiskAreaDetailsProps {
  riskAreas: RiskArea[];
}

const RiskAreaDetails = ({ riskAreas }: RiskAreaDetailsProps) => {
  const getRiskColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'text-risk-low';
      case 'medium': return 'text-risk-medium';
      case 'high': return 'text-risk-high';
      default: return 'text-muted-foreground';
    }
  };

  const getRiskBgColor = (level: 'low' | 'medium' | 'high') => {
    switch (level) {
      case 'low': return 'bg-risk-low/10';
      case 'medium': return 'bg-risk-medium/10';
      case 'high': return 'bg-risk-high/10';
      default: return 'bg-muted';
    }
  };

  if (riskAreas.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 text-muted-foreground">
        <Info className="mr-2 h-5 w-5" />
        <span>No risk areas detected for this route.</span>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1">
      {riskAreas.map((area) => (
        <Card key={area.id} className="overflow-hidden animate-once animate-scale">
          <CardContent className="p-0">
            <div className={cn(
              "p-4 flex items-start gap-4",
              getRiskBgColor(area.riskLevel)
            )}>
              <div className={cn(
                "mt-1 flex-shrink-0 rounded-full p-2", 
                getRiskBgColor(area.riskLevel),
                "border",
                area.riskLevel === 'low' ? "border-risk-low/20" :
                area.riskLevel === 'medium' ? "border-risk-medium/20" :
                "border-risk-high/20"
              )}>
                <AlertTriangle className={cn("h-5 w-5", getRiskColor(area.riskLevel))} />
              </div>
              
              <div className="space-y-1">
                <div className="flex items-center">
                  <h4 className="font-medium capitalize">{area.riskLevel} Risk Area</h4>
                  <span className={cn(
                    "ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                    area.riskLevel === 'low' ? "bg-risk-low/20 text-risk-low" :
                    area.riskLevel === 'medium' ? "bg-risk-medium/20 text-risk-medium" :
                    "bg-risk-high/20 text-risk-high"
                  )}>
                    {area.riskLevel === 'low' ? 'Low' : 
                     area.riskLevel === 'medium' ? 'Medium' : 'High'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">{area.description}</p>
                <div className="flex items-center text-xs mt-2 text-muted-foreground">
                  <span>Location: {area.location.lat.toFixed(6)}, {area.location.lng.toFixed(6)}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default RiskAreaDetails;
