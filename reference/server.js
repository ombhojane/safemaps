require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes

// 1. Search for a place by text query - using Places API v1
app.get('/api/places/search', async (req, res) => {
  try {
    const { query } = req.query;
    if (!query) {
      return res.status(400).json({ error: 'Query parameter is required' });
    }

    console.log(`Searching for places with query: ${query}`);
    
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchText',
      { textQuery: query },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location'
        }
      }
    );

    // Transform the response to match the format expected by the client
    if (response.data && response.data.places && response.data.places.length > 0) {
      const transformedResults = response.data.places.map(place => ({
        place_id: place.id,
        name: place.displayName?.text || 'Unnamed Location',
        formatted_address: place.formattedAddress || '',
        geometry: {
          location: place.location || { lat: 0, lng: 0 }
        }
      }));

      res.json({
        status: 'OK',
        results: transformedResults
      });
    } else {
      res.json({
        status: 'ZERO_RESULTS',
        results: []
      });
    }
  } catch (error) {
    console.error('Error searching places:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search places', details: error.message });
  }
});

// 2. Get place details by place_id - using Places API v1
app.get('/api/places/details', async (req, res) => {
  try {
    const { placeId } = req.query;
    if (!placeId) {
      return res.status(400).json({ error: 'placeId parameter is required' });
    }

    console.log(`Getting details for place: ${placeId}`);
    
    const response = await axios.get(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,photos,internationalPhoneNumber,nationalPhoneNumber'
        }
      }
    );

    // Transform the response to match the format expected by the client
    if (response.data) {
      const transformedPhotos = response.data.photos?.map(photo => ({
        photo_reference: photo.name,
        width: photo.widthPx,
        height: photo.heightPx,
        html_attributions: photo.authorAttributions?.map(author => 
          `<a href="${author.uri}">${author.displayName}</a>`
        ) || []
      })) || [];

      const transformedResult = {
        place_id: response.data.id,
        name: response.data.displayName?.text || 'Unnamed Location',
        formatted_address: response.data.formattedAddress || '',
        phone: response.data.internationalPhoneNumber || response.data.nationalPhoneNumber || 'No phone number available',
        geometry: {
          location: response.data.location || { lat: 0, lng: 0 }
        },
        photos: transformedPhotos
      };

      res.json({
        status: 'OK',
        result: transformedResult
      });
    } else {
      res.json({
        status: 'NOT_FOUND',
        result: null
      });
    }
  } catch (error) {
    console.error('Error fetching place details:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch place details', details: error.message });
  }
});

// 3. Proxy for place photos - using Places API v1
app.get('/api/places/photo', async (req, res) => {
  try {
    const { photoReference } = req.query;
    const maxWidth = parseInt(req.query.maxWidth) || 400;
    
    if (!photoReference) {
      return res.status(400).json({ error: 'photoReference parameter is required' });
    }

    console.log(`Getting photo: ${photoReference}`);
    
    // Extract the actual photo reference from the full name if needed
    const photoName = photoReference.includes('/photos/') 
      ? photoReference 
      : `places/${photoReference}`;
    
    // Make a request to get the actual photo
    const response = await axios.get(
      `https://places.googleapis.com/v1/${photoName}/media`,
      {
        headers: {
          'X-Goog-Api-Key': GOOGLE_API_KEY
        },
        params: {
          maxWidthPx: maxWidth,
          skipHttpRedirect: false
        },
        responseType: 'arraybuffer'
      }
    );

    // Set appropriate headers
    const contentType = response.headers['content-type'];
    res.setHeader('Content-Type', contentType);
    res.send(response.data);
  } catch (error) {
    console.error('Error fetching place photo:', error.response?.data || error.message);
    
    // If we don't get a photo, send a placeholder image
    res.status(500).json({ error: 'Failed to fetch place photo', details: error.message });
  }
});

// 4. Search by geocoordinates - using Places API v1
app.get('/api/places/nearby', async (req, res) => {
  try {
    const { lat, lng, radius = 1000 } = req.query;
    
    if (!lat || !lng) {
      return res.status(400).json({ error: 'lat and lng parameters are required' });
    }

    console.log(`Searching nearby places at: ${lat},${lng} with radius ${radius}`);
    
    // Use the nearby search endpoint
    const response = await axios.post(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        locationRestriction: {
          circle: {
            center: {
              latitude: parseFloat(lat),
              longitude: parseFloat(lng)
            },
            radius: parseFloat(radius)
          }
        },
        maxResultCount: 20 // Increase result count to get more places
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.nationalPhoneNumber'
        }
      }
    );

    // Transform the response to match the format expected by the client
    if (response.data && response.data.places && response.data.places.length > 0) {
      const transformedResults = response.data.places.map(place => ({
        place_id: place.id,
        name: place.displayName?.text || 'Unnamed Location',
        formatted_address: place.formattedAddress || '',
        phone: place.internationalPhoneNumber || place.nationalPhoneNumber || 'No phone number available',
        geometry: {
          location: place.location || { lat: parseFloat(lat), lng: parseFloat(lng) }
        }
      }));

      res.json({
        status: 'OK',
        results: transformedResults
      });
    } else {
      // Fallback to text search in this area if no results
      console.log('No places found nearby, trying text search for this location');
      const locationName = `${lat},${lng}`;
      
      const textSearchResponse = await axios.post(
        'https://places.googleapis.com/v1/places:searchText',
        { textQuery: locationName },
        {
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': GOOGLE_API_KEY,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.internationalPhoneNumber,places.nationalPhoneNumber'
          }
        }
      );
      
      if (textSearchResponse.data && textSearchResponse.data.places && textSearchResponse.data.places.length > 0) {
        const transformedResults = textSearchResponse.data.places.map(place => ({
          place_id: place.id,
          name: place.displayName?.text || 'Unnamed Location',
          formatted_address: place.formattedAddress || '',
          phone: place.internationalPhoneNumber || place.nationalPhoneNumber || 'No phone number available',
          geometry: {
            location: place.location || { lat: parseFloat(lat), lng: parseFloat(lng) }
          }
        }));

        return res.json({
          status: 'OK',
          results: transformedResults
        });
      }
      
      res.json({
        status: 'ZERO_RESULTS',
        results: []
      });
    }
  } catch (error) {
    console.error('Error searching nearby places:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to search nearby places', details: error.message });
  }
});

// Serve the frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 