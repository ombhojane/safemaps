# Setting Up Google Custom Search API for SafeMaps

This guide explains how to set up and configure Google Custom Search API for use with the accident hotspots service in SafeMaps.

## Prerequisites

1. A Google account
2. Google Maps API key (already in use for the application)

## Step 1: Create a Programmable Search Engine

1. Visit the [Programmable Search Engine Control Panel](https://programmablesearchengine.google.com/create/new)
2. Enter a name for your search engine (e.g., "SafeMaps Accident Search")
3. Configure what to search:
   - Choose "Search the entire web" to find accident data from any website
   - Alternatively, you can specify specific sites that provide accident and traffic data for your region
4. Click "Create"

## Step 2: Get Your Search Engine ID

1. After creating the search engine, you'll be taken to your engine's setup page
2. Look for the "Search engine ID" in the "Basics" section
3. Copy this ID - it will look something like `012345678901234567890:abcdefghijk`

## Step 3: Enable Custom Search JSON API

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project or create a new one
3. Navigate to "APIs & Services" > "Library"
4. Search for "Custom Search API" and select it
5. Click "Enable"

## Step 4: Configure Environment Variables

1. Add the following environment variable to your `.env` file:
   ```
   VITE_CUSTOM_SEARCH_ENGINE_ID=your_search_engine_id
   ```
2. The application is already configured to use your `VITE_GOOGLE_MAPS_API_KEY` for authentication

## Step 5: Testing the Integration

1. Restart your application to load the new environment variables
2. Test the accident hotspot feature by searching for a location
3. Check the console logs for any errors or API responses

## Troubleshooting

- **API Quota Issues**: The Custom Search JSON API provides 100 search queries per day for free. Beyond that, billing must be enabled ($5 per 1000 queries, up to 10,000 per day).
- **No Results Found**: Make sure your search engine is set to search the entire web or includes relevant accident reporting websites.
- **Authentication Errors**: Verify that your Google Maps API key has the Custom Search API enabled in the Google Cloud Console.

## Further Customization

For advanced configurations, visit:
- [Custom Search JSON API Overview](https://developers.google.com/custom-search/v1/overview)
- [Using REST with Custom Search](https://developers.google.com/custom-search/v1/using_rest)
- [Performance Tips](https://developers.google.com/custom-search/v1/performance) 