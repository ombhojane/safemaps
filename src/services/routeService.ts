import { Location, Route, RiskArea, RouteAnalysis, RoutePoint, EmergencyContact } from "@/types";
import { v4 as uuidv4 } from "uuid";

// Demo data service
class RouteService {
  async getRoutes(source: Location, destination: Location): Promise<Route[]> {
    console.log("Fetching routes from", source, "to", destination);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Demo routes with different risk profiles
    return [
      {
        id: "route-1",
        source,
        destination,
        points: this.generateRoutePoints(source, destination, "low"),
        riskScore: 2.3,
        distance: "5.2 km",
        duration: "12 min",
        riskAreas: this.generateRiskAreas("low")
      },
      {
        id: "route-2",
        source,
        destination,
        points: this.generateRoutePoints(source, destination, "medium"),
        riskScore: 5.7,
        distance: "4.8 km",
        duration: "10 min",
        riskAreas: this.generateRiskAreas("medium")
      },
      {
        id: "route-3",
        source,
        destination,
        points: this.generateRoutePoints(source, destination, "high"),
        riskScore: 8.2,
        distance: "4.5 km",
        duration: "9 min",
        riskAreas: this.generateRiskAreas("high")
      }
    ];
  }

  async analyzeRoute(routeId: string): Promise<RouteAnalysis> {
    console.log("Analyzing route:", routeId);
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Get demo route
    const routes = await this.getRoutes(
      { name: "Current Location", coordinates: { lat: 37.7749, lng: -122.4194 } },
      { name: "Destination", coordinates: { lat: 37.7833, lng: -122.4167 } }
    );
    const route = routes.find(r => r.id === routeId) || routes[0];
    
    return {
      route,
      overallRiskScore: route.riskScore,
      riskAreas: route.riskAreas,
      recommendation: this.getRecommendation(route.riskScore)
    };
  }

  private generateRoutePoints(source: Location, destination: Location, riskProfile: string): RoutePoint[] {
    const points: RoutePoint[] = [];
    const count = 20; // Number of points
    
    for (let i = 0; i <= count; i++) {
      const ratio = i / count;
      
      // Create a slightly curved path between source and destination
      const midpointVariation = riskProfile === "low" ? 0.0001 : 
                                riskProfile === "medium" ? 0.0005 : 0.001;
      
      // Add some randomness to make the route look more natural
      const jitterLat = (Math.random() - 0.5) * 0.001;
      const jitterLng = (Math.random() - 0.5) * 0.001;
      
      // Create a curved path
      const lat = source.coordinates.lat * (1 - ratio) + destination.coordinates.lat * ratio + 
                  Math.sin(ratio * Math.PI) * midpointVariation + jitterLat;
      const lng = source.coordinates.lng * (1 - ratio) + destination.coordinates.lng * ratio + 
                  Math.sin(ratio * Math.PI) * midpointVariation + jitterLng;
      
      // Add risk score to some points based on risk profile
      let riskScore;
      let riskReason;
      
      if (riskProfile === "low" && Math.random() < 0.1) {
        riskScore = Math.random() * 3;
        riskReason = "Minor pedestrian traffic";
      } else if (riskProfile === "medium" && Math.random() < 0.3) {
        riskScore = 3 + Math.random() * 3;
        riskReason = "Moderate traffic congestion";
      } else if (riskProfile === "high" && Math.random() < 0.5) {
        riskScore = 6 + Math.random() * 4;
        riskReason = "Heavy traffic and poor visibility";
      }
      
      points.push({
        coordinates: { lat, lng },
        riskScore,
        riskReason
      });
    }
    
    return points;
  }

  private generateRiskAreas(riskProfile: string): RiskArea[] {
    const riskAreas: RiskArea[] = [];
    
    // Base coordinates (San Francisco)
    const baseLat = 37.7749;
    const baseLng = -122.4194;
    
    const riskCount = riskProfile === "low" ? 1 : 
                      riskProfile === "medium" ? 3 : 5;
    
    const riskReasons = [
      "Construction zone with limited visibility",
      "School zone with high pedestrian activity",
      "Intersection with history of accidents",
      "Poor road conditions and potholes",
      "Narrow road with heavy traffic",
      "Area with limited lighting at night",
      "Steep hill with sharp turns",
      "Heavy merging traffic",
      "Area prone to flooding during rain"
    ];
    
    for (let i = 0; i < riskCount; i++) {
      const latOffset = (Math.random() - 0.5) * 0.02;
      const lngOffset = (Math.random() - 0.5) * 0.02;
      
      let riskLevel: 'low' | 'medium' | 'high';
      
      if (riskProfile === "low") {
        riskLevel = "low";
      } else if (riskProfile === "medium") {
        riskLevel = Math.random() > 0.7 ? "medium" : "low";
      } else {
        riskLevel = Math.random() > 0.6 ? "high" : Math.random() > 0.5 ? "medium" : "low";
      }
      
      const randomReasonIndex = Math.floor(Math.random() * riskReasons.length);
      
      riskAreas.push({
        id: `risk-${i + 1}`,
        location: {
          lat: baseLat + latOffset,
          lng: baseLng + lngOffset
        },
        riskLevel,
        description: riskReasons[randomReasonIndex],
        emergencyContacts: this.generateEmergencyContacts(riskLevel)
      });
    }
    
    return riskAreas;
  }

  private generateEmergencyContacts(riskLevel: 'low' | 'medium' | 'high'): EmergencyContact[] {
    const contacts: EmergencyContact[] = [];
    
    // Generate more emergency contacts for higher risk areas
    const contactCount = riskLevel === 'low' ? 2 : 
                        riskLevel === 'medium' ? 3 : 4;
    
    const hospitalNames = [
      "City General Hospital",
      "Memorial Medical Center",
      "University Health System",
      "Community Regional Hospital",
      "Mercy Medical Center"
    ];
    
    const policeStations = [
      "Central Police Station",
      "Downtown Precinct",
      "Northern District Police",
      "Highway Patrol Division",
      "County Sheriff's Office"
    ];
    
    const fireStations = [
      "City Fire Station #1",
      "Central Fire Department",
      "Volunteer Fire Brigade",
      "Metropolitan Fire Service",
      "Rescue Fire Department"
    ];
    
    const roadsideServices = [
      "AAA Roadside Assistance",
      "24/7 Towing Service",
      "Emergency Road Help",
      "Rapid Response Towing",
      "Highway Rescue Services"
    ];
    
    // Always add at least one hospital
    contacts.push({
      id: `hospital-${Math.floor(Math.random() * 1000)}`,
      name: hospitalNames[Math.floor(Math.random() * hospitalNames.length)],
      type: 'hospital',
      phoneNumber: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
      address: `${Math.floor(Math.random() * 1000) + 100} Medical Center Blvd, San Francisco, CA`,
      distance: `${(Math.random() * 2 + 0.5).toFixed(1)} km`
    });
    
    // Add police station
    if (contactCount >= 2) {
      contacts.push({
        id: `police-${Math.floor(Math.random() * 1000)}`,
        name: policeStations[Math.floor(Math.random() * policeStations.length)],
        type: 'police',
        phoneNumber: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        address: `${Math.floor(Math.random() * 300) + 100} Justice Ave, San Francisco, CA`,
        distance: `${(Math.random() * 3 + 0.8).toFixed(1)} km`
      });
    }
    
    // Add fire station
    if (contactCount >= 3) {
      contacts.push({
        id: `fire-${Math.floor(Math.random() * 1000)}`,
        name: fireStations[Math.floor(Math.random() * fireStations.length)],
        type: 'fire',
        phoneNumber: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        address: `${Math.floor(Math.random() * 200) + 100} Rescue St, San Francisco, CA`,
        distance: `${(Math.random() * 2.5 + 1).toFixed(1)} km`
      });
    }
    
    // Add roadside assistance
    if (contactCount >= 4) {
      contacts.push({
        id: `roadside-${Math.floor(Math.random() * 1000)}`,
        name: roadsideServices[Math.floor(Math.random() * roadsideServices.length)],
        type: 'roadside',
        phoneNumber: `(${Math.floor(Math.random() * 900) + 100}) ${Math.floor(Math.random() * 900) + 100}-${Math.floor(Math.random() * 9000) + 1000}`,
        address: `${Math.floor(Math.random() * 500) + 100} Highway Blvd, San Francisco, CA`,
        distance: `${(Math.random() * 4 + 2).toFixed(1)} km`
      });
    }
    
    return contacts;
  }

  private getRecommendation(riskScore: number): string {
    if (riskScore < 3) {
      return "This route is generally safe with minimal risk areas. Proceed normally.";
    } else if (riskScore < 6) {
      return "This route has some moderate risk areas. Drive with caution, especially at marked points.";
    } else {
      return "This route has significant risk areas. Consider an alternative route or proceed with extreme caution if you must take this path.";
    }
  }
}

export default new RouteService();
