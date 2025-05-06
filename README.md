# SafeMaps

SafeMaps helps users find safe routes between locations by analyzing road conditions, traffic patterns, and environmental factors.

## Features

- **Safety Analysis**: Uses AI to analyze street view images and identify potential hazards
- **Route Comparison**: View multiple route options with safety scores
- **Turn-by-Turn Navigation**: Get directions with safety alerts for risky areas
- **Street View Preview**: See what your route looks like before traveling
- **Weather Integration**: Check weather conditions along your route
- **Emergency Contacts**: Quick access to nearby emergency services

## Description

SafeMaps analyzes various risk factors to recommend the safest travel routes:

- **Road Infrastructure**: Analyzes road design, lane width, dividers/barriers, and shoulder conditions
- **Traffic Conditions**: Evaluates congestion, merging zones, vehicle mix, and traffic patterns
- **Environmental Factors**: Considers weather conditions, lighting, visibility, and road surface
- **Human Factors**: Accounts for pedestrian zones, construction areas, and other unpredictable elements
- **Infrastructure Quality**: Assesses road surface, street lighting, and traffic signage

## Architecture

- **Frontend**: Built with React, TypeScript, and Vite for a fast, responsive user interface
- **UI Components**: Utilizes shadcn-ui and Tailwind CSS for modern, accessible design
- **Mapping Services**: Integrates Google Maps for routing, Places API for location search, and Street View
- **AI Integration**: Leverages Google's Gemini LLMs for image analysis and safety assessment
- OpenWeatherMap for weather data

## Setup

### Prerequisites

- Node.js (v14.0.0 or later)
- npm or yarn
- Google Cloud API key (Maps SDK, Places API)
- Google Gemini API key

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/safemaps.git
   cd safemaps
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn
   ```

3. **Set up environment variables**
   
   Create a `.env` file in the root directory with the following content:
   ```
   VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
   VITE_SERPER_API_KEY=your_serper_api_key
   ```

4. **Start the development server**
   ```bash
   npm run dev
   # or
   yarn dev
   ```

### API Key Setup

#### Google Maps API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to APIs & Services > Library
4. Enable the following APIs:
   - Places API
   - Maps JavaScript API
   - Directions API
   - Street View API
   - Geocoding API
5. Go to APIs & Services > Credentials
6. Create an API key and add appropriate restrictions

#### Google Gemini API

1. Visit the [Gemini API page](https://ai.google.dev/)
2. Sign up and obtain your API key
3. Copy the key to your `.env` file

## 🚗 Usage Guide

1. **Start a route search**
   - Enter your destination in the search bar
   - Use your current location or enter a starting point

2. **Compare route options**
   - Review multiple routes with safety scores, estimated time, and distance
   - Select a route to view detailed safety information
   - Check the Street View gallery to preview your journey

3. **Start navigation**
   - Select "Navigate" on your chosen route
   - Follow the turn-by-turn directions with voice guidance
   - Receive safety alerts for upcoming risk areas

4. **Customize your experience**
   - Adjust voice guidance volume or mute as needed
   - Access emergency contacts when required

## Contributing

We welcome contributions to SafeMaps:

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Submit a pull request


## Upcoming Plans

- **Suggessions from Crowdsourcing**: Allow users to report unsafe conditions in real-time, respond to safer routes & give suggessions
- **Personalized Safety Profiles**: Customize safety parameters based on user preferences
- Enhnace the User Experience for Navigation
  
## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgements

- Google Maps SDK, Places, and Gemini AI for core services
- React and Vite communities for the excellent development tools
- shadcn-ui for the beautiful UI components
- OpenWeatherMap for weather data integration

# SafeMaps - Accident Hotspot Analysis Feature

## Overview
The Accident Hotspot Analysis feature enhances the safety route planning capabilities of SafeMaps by identifying and analyzing locations with a history of accidents. This feature integrates with the existing street view analysis to provide a more comprehensive safety assessment of routes.

## How It Works

### Accident Hotspot Detection
- The system identifies potential accident hotspots along a route using LangChain.js agents.
- For each street view location, it queries for past 6 months accident history.
- The accident data is analyzed using the Gemini AI model to determine:
  - Accident frequency (low, moderate, high, or very high)
  - Accident severity (minor, moderate, severe, or fatal)
  - Risk factors contributing to accidents
  - Safety precautions specific to that location

### Integration with Street View Analysis
- Accident context is added to the street view image analysis.
- The Gemini AI model considers accident history when assessing risk scores.
- Street view locations with significant accident history receive higher risk scores.
- Overall route safety scores now include accident history as a factor.

## Implementation Details

### Key Components
1. **Accident Hotspot Service** (`accidentHotspotsService.ts`):
   - Performs web searches for accident history data
   - Uses LangChain.js agents to process and analyze search results
   - Returns structured data about accident history for specific locations

2. **Maps Service Integration** (`mapsService.ts`):
   - Enhanced to obtain address information for each street view location
   - Calls the accident hotspot service to get accident data for each location
   - Passes accident context to the street view image analysis

3. **Gemini Service Enhancement** (`geminiService.ts`):
   - Updated prompt to consider accident history data
   - Modified scoring system to account for accident patterns
   - Adds 5-25 points to risk scores based on accident frequency and severity

### Technology Stack
- **LangChain.js**: Framework for creating AI agents that perform web searches and analyze data
- **Google Gemini AI**: Advanced LLM for interpreting accident data and street view images
- **Dynamic Structured Tools**: Custom tools for web searches and data processing

## Usage
The accident hotspot analysis is automatically integrated into the route analysis workflow. No additional user actions are required to benefit from this feature.

When viewing a route:
1. The system analyzes street view images along the route
2. For each location, it retrieves and analyzes accident history data
3. The final risk assessment includes both visual safety factors and accident history
4. Users see safety recommendations that account for known accident patterns

## Future Enhancements
- Integration with official traffic accident databases
- Temporal analysis of accident patterns (time of day, day of week, seasonal patterns)
- Machine learning models to predict accident likelihood based on visual features and historical data
- User reporting of unsafe conditions and near-miss incidents


