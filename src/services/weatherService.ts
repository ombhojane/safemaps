import OpenWeatherMap, { CountryCode } from 'openweathermap-ts';

// Get API key from environment variables
const API_KEY = import.meta.env.VITE_OPENWEATHER_API_KEY;

// Weather data interface
export interface WeatherData {
  temperature: number;
  feelsLike: number;
  description: string;
  icon: string;
  main: string;
  humidity: number;
  windSpeed: number;
  location: string;
  timestamp: number;
}

// Initialize OpenWeatherMap client
const openWeather = new OpenWeatherMap({
  apiKey: API_KEY,
  units: 'metric'
});

/**
 * Get current weather data by geographic coordinates
 */
export const getCurrentWeatherByCoordinates = async (
  lat: number, 
  lng: number
): Promise<WeatherData | null> => {
  try {
    const weatherData = await openWeather.getCurrentWeatherByGeoCoordinates(lat, lng);
    
    return {
      temperature: weatherData.main.temp,
      feelsLike: weatherData.main.feels_like,
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      main: weatherData.weather[0].main,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
      location: weatherData.name,
      timestamp: weatherData.dt
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
};

/**
 * Get current weather data by city name
 */
export const getCurrentWeatherByCity = async (
  cityName: string, 
  countryCode?: CountryCode
): Promise<WeatherData | null> => {
  try {
    const params = countryCode ? { cityName, countryCode } : { cityName };
    const weatherData = await openWeather.getCurrentWeatherByCityName(params);
    
    return {
      temperature: weatherData.main.temp,
      feelsLike: weatherData.main.feels_like,
      description: weatherData.weather[0].description,
      icon: weatherData.weather[0].icon,
      main: weatherData.weather[0].main,
      humidity: weatherData.main.humidity,
      windSpeed: weatherData.wind.speed,
      location: weatherData.name,
      timestamp: weatherData.dt
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return null;
  }
};

/**
 * Get weather icon URL from OpenWeatherMap
 */
export const getWeatherIconUrl = (iconCode: string): string => {
  return `https://openweathermap.org/img/wn/${iconCode}@2x.png`;
};

/**
 * Get weather data for source location of a route
 * Used for caching the weather data for a specific route
 */
export const getRouteLocationWeather = async (
  lat: number, 
  lng: number
): Promise<WeatherData | null> => {
  return getCurrentWeatherByCoordinates(lat, lng);
};

/**
 * Get weather condition as a simple string
 */
export const getWeatherCondition = (weatherData: WeatherData): string => {
  const main = weatherData.main.toLowerCase();
  
  if (main.includes('clear')) return 'Clear';
  if (main.includes('cloud')) return 'Cloudy';
  if (main.includes('rain') || main.includes('drizzle')) return 'Rainy';
  if (main.includes('snow')) return 'Snowy';
  if (main.includes('thunderstorm')) return 'Thunderstorm';
  if (main.includes('mist') || main.includes('fog')) return 'Foggy';
  if (main.includes('haze')) return 'Hazy';
  if (main.includes('dust') || main.includes('sand')) return 'Dusty';
  if (main.includes('smoke')) return 'Smoky';
  if (main.includes('tornado')) return 'Tornado';
  
  return weatherData.description.charAt(0).toUpperCase() + weatherData.description.slice(1);
}; 