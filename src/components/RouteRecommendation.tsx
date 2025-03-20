
import { RouteAnalysis } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ThumbsUp, AlertTriangle, Shield, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface RouteRecommendationProps {
  analysis: RouteAnalysis;
}

const RouteRecommendation = ({ analysis }: RouteRecommendationProps) => {
  const { overallRiskScore, recommendation, route } = analysis;
  
  // Determine risk level based on score
  const getRiskLevel = (score: number) => {
    if (score < 3) return { level: "low", color: "text-risk-low", icon: Shield };
    if (score < 6) return { level: "medium", color: "text-risk-medium", icon: Info };
    return { level: "high", color: "text-risk-high", icon: AlertTriangle };
  };
  
  const { level, color, icon: RiskIcon } = getRiskLevel(overallRiskScore);
  
  return (
    <Card className="overflow-hidden animate-once animate-fade-in">
      <CardHeader className={cn(
        "pb-3",
        level === "low" ? "bg-risk-low/10" : 
        level === "medium" ? "bg-risk-medium/10" : 
        "bg-risk-high/10"
      )}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center">
            <RiskIcon className={cn("mr-2 h-5 w-5", color)} />
            Route Analysis
          </CardTitle>
          <Badge variant="outline" className={cn(
            "font-medium capitalize",
            level === "low" ? "border-risk-low text-risk-low" : 
            level === "medium" ? "border-risk-medium text-risk-medium" : 
            "border-risk-high text-risk-high"
          )}>
            {level} risk
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Risk Score
            </div>
            <div className="font-medium">
              {overallRiskScore.toFixed(1)}/10
            </div>
          </div>
          
          <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all ease-in-out duration-1000",
                level === "low" ? "bg-risk-low" : 
                level === "medium" ? "bg-risk-medium" : 
                "bg-risk-high"
              )} 
              style={{ width: `${(overallRiskScore / 10) * 100}%` }}
            ></div>
          </div>
          
          <div className="pt-1">
            <div className="flex items-start space-x-3 pt-2">
              <ThumbsUp className="h-5 w-5 text-muted-foreground mt-0.5" />
              <p className="text-sm text-muted-foreground">
                {recommendation}
              </p>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 pt-2">
            <Badge variant="outline" className="bg-background/50">
              {route.distance}
            </Badge>
            <Badge variant="outline" className="bg-background/50">
              {route.duration}
            </Badge>
            <Badge variant="outline" className="bg-background/50">
              {route.riskAreas.length} risk {route.riskAreas.length === 1 ? 'area' : 'areas'}
            </Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteRecommendation;
