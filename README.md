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
   VITE_GOOGLE_MAPS_API_KEY=your_google_cloud_api_key
   VITE_GEMINI_API_KEY=your_gemini_api_key
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


