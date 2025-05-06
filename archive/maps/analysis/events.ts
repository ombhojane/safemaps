import { Route } from "../types";

// Define a custom event for route analysis updates
export const ROUTE_ANALYSIS_COMPLETE_EVENT = 'route-analysis-complete';

// Custom event to dispatch when route analysis is complete
export const dispatchRouteAnalysisComplete = (route: Route) => {
  const event = new CustomEvent(ROUTE_ANALYSIS_COMPLETE_EVENT, { 
    detail: { 
      routeId: route.id,
      analysis: route.geminiAnalysis
    } 
  });
  window.dispatchEvent(event);
}; 