// Global variables
let map;
let marker;
let placeService;
let currentPlace = null;
let selectedNearbyPlaceId = null;

// Initialize the map
function initMap() {
  // Default center (e.g., New York City)
  const defaultCenter = { lat: 40.7128, lng: -74.0060 };
  
  // Create the map with modern styling
  map = new google.maps.Map(document.getElementById('map'), {
    center: defaultCenter,
    zoom: 13,
    mapTypeControl: true,
    fullscreenControl: true,
    streetViewControl: true,
    mapId: 'DEMO_MAP_ID', // Required for Advanced Markers
    styles: [
      {
        "featureType": "administrative",
        "elementType": "geometry",
        "stylers": [{"visibility": "off"}]
      },
      {
        "featureType": "poi",
        "stylers": [{"visibility": "simplified"}]
      },
      {
        "featureType": "road",
        "elementType": "labels.icon",
        "stylers": [{"visibility": "off"}]
      },
      {
        "featureType": "transit",
        "stylers": [{"visibility": "off"}]
      }
    ]
  });
  
  // Initialize Places service
  placeService = new google.maps.places.PlacesService(map);
  
  // Initial marker - use a modern marker for better visibility
  const markerElement = document.createElement('div');
  markerElement.innerHTML = `
    <div style="cursor: pointer">
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="#2563eb" stroke="#ffffff" stroke-width="1"/>
      </svg>
    </div>
  `;
  
  // We'll use a basic marker instead of AdvancedMarkerElement if libraries aren't loaded correctly
  try {
    marker = new google.maps.marker.AdvancedMarkerElement({
      map,
      position: defaultCenter,
      content: markerElement,
      gmpDraggable: true,
      title: 'Drag me!'
    });
    
    // Add marker drag event - note different event name for AdvancedMarkerElement
    marker.addListener('dragend', (event) => {
      const position = marker.position;
      document.getElementById('latitude').value = position.lat;
      document.getElementById('longitude').value = position.lng;
      searchByCoordinates(position.lat, position.lng);
    });
  } catch (e) {
    console.error("AdvancedMarkerElement not supported, using fallback marker", e);
    marker = new google.maps.Marker({
      map,
      position: defaultCenter,
      draggable: true,
      title: 'Drag me!',
      animation: google.maps.Animation.DROP,
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#2563eb',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2
      }
    });
    
    // Add marker drag event
    marker.addListener('dragend', function() {
      const position = marker.getPosition();
      document.getElementById('latitude').value = position.lat();
      document.getElementById('longitude').value = position.lng();
      searchByCoordinates(position.lat(), position.lng());
    });
  }
  
  // Add click event to map
  map.addListener('click', function(event) {
    // Animate the marker
    if (marker instanceof google.maps.Marker) {
      marker.setAnimation(google.maps.Animation.DROP);
    }
    
    // Set marker position (different method depending on marker type)
    if (marker instanceof google.maps.marker.AdvancedMarkerElement) {
      marker.position = event.latLng;
    } else {
      marker.setPosition(event.latLng);
    }
    
    document.getElementById('latitude').value = event.latLng.lat();
    document.getElementById('longitude').value = event.latLng.lng();
    searchByCoordinates(event.latLng.lat(), event.latLng.lng());
  });
  
  // Set up event listeners
  setupEventListeners();
}

// Set up event listeners for buttons and inputs
function setupEventListeners() {
  // Search by place name
  document.getElementById('search-btn').addEventListener('click', function() {
    const query = document.getElementById('place-search').value.trim();
    if (query) {
      searchByPlaceName(query);
    } else {
      showError('Please enter a place name');
      shakeElement(document.getElementById('place-search'));
    }
  });
  
  // Search by place name (on Enter key)
  document.getElementById('place-search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
      const query = document.getElementById('place-search').value.trim();
      if (query) {
        searchByPlaceName(query);
      } else {
        showError('Please enter a place name');
        shakeElement(this);
      }
    }
  });
  
  // Search by coordinates
  document.getElementById('coordinates-btn').addEventListener('click', function() {
    const lat = parseFloat(document.getElementById('latitude').value);
    const lng = parseFloat(document.getElementById('longitude').value);
    
    if (isNaN(lat) || isNaN(lng)) {
      showError('Please enter valid coordinates');
      if (isNaN(lat)) shakeElement(document.getElementById('latitude'));
      if (isNaN(lng)) shakeElement(document.getElementById('longitude'));
      return;
    }
    
    searchByCoordinates(lat, lng);
  });
  
  // Get current location
  document.getElementById('current-location-btn').addEventListener('click', function() {
    if (navigator.geolocation) {
      showLoading();
      navigator.geolocation.getCurrentPosition(
        function(position) {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          
          document.getElementById('latitude').value = lat;
          document.getElementById('longitude').value = lng;
          
          // Update map and marker
          const latLng = new google.maps.LatLng(lat, lng);
          map.setCenter(latLng);
          
          // Set marker position with animation
          if (marker instanceof google.maps.marker.AdvancedMarkerElement) {
            marker.position = latLng;
          } else {
            marker.setAnimation(google.maps.Animation.DROP);
            marker.setPosition(latLng);
          }
          
          // Search for nearby places
          searchByCoordinates(lat, lng);
        },
        function(error) {
          hideLoading();
          
          let errorMessage = 'Unable to retrieve your location';
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Location access was denied';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'Location information is unavailable';
              break;
            case error.TIMEOUT:
              errorMessage = 'The request to get user location timed out';
              break;
          }
          
          showError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      showError('Geolocation is not supported by your browser');
    }
  });
}

// Search by place name
function searchByPlaceName(query) {
  showLoading();
  hideError();
  
  fetch(`/api/places/search?query=${encodeURIComponent(query)}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      hideLoading();
      console.log('Place search response:', data);
      
      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        showError('No places found matching your search');
        return;
      }
      
      // Get the first result
      const place = data.results[0];
      
      // Update the map
      const location = place.geometry.location;
      const latLng = new google.maps.LatLng(location.lat, location.lng);
      map.setCenter(latLng);
      map.setZoom(15); // Zoom in for better visibility
      
      // Set marker position (different method depending on marker type)
      if (marker instanceof google.maps.marker.AdvancedMarkerElement) {
        marker.position = latLng;
      } else {
        marker.setAnimation(google.maps.Animation.DROP);
        marker.setPosition(latLng);
      }
      
      // Update coordinate inputs
      document.getElementById('latitude').value = location.lat;
      document.getElementById('longitude').value = location.lng;
      
      // Get details for the place
      getPlaceDetails(place.place_id);
      
      // Also search for nearby places
      searchByCoordinates(location.lat, location.lng);
    })
    .catch(error => {
      hideLoading();
      showError('Error searching for place: ' + error.message);
      console.error(error);
    });
}

// Search by coordinates
function searchByCoordinates(lat, lng) {
  showLoading();
  hideError();
  
  fetch(`/api/places/nearby?lat=${lat}&lng=${lng}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      hideLoading();
      console.log('Nearby search response:', data);
      
      if (data.status !== 'OK' || !data.results || data.results.length === 0) {
        showError('No places found near this location');
        return;
      }
      
      // Display the list of nearby places with phone numbers
      displayNearbyPlaces(data.results);
      
      // If we don't have a selected place yet, get details for the first place
      if (!selectedNearbyPlaceId) {
        const place = data.results[0];
        getPlaceDetails(place.place_id);
        selectedNearbyPlaceId = place.place_id;
      }
    })
    .catch(error => {
      hideLoading();
      showError('Error searching for nearby places: ' + error.message);
      console.error(error);
    });
}

// Display a list of nearby places with phone numbers
function displayNearbyPlaces(places) {
  const nearbyPlacesContainer = document.getElementById('nearby-places-container');
  nearbyPlacesContainer.classList.remove('hidden');
  
  const nearbyPlacesList = document.getElementById('nearby-places-list');
  nearbyPlacesList.innerHTML = '';
  
  // Create and add place items
  places.forEach((place, index) => {
    const placeItem = document.createElement('div');
    placeItem.className = 'nearby-place-item';
    
    // If this is the selected place or the first place and none selected, mark it as selected
    if ((selectedNearbyPlaceId && place.place_id === selectedNearbyPlaceId) || 
        (!selectedNearbyPlaceId && index === 0)) {
      placeItem.classList.add('selected');
      selectedNearbyPlaceId = place.place_id;
    }
    
    placeItem.setAttribute('data-place-id', place.place_id);
    
    // Format phone number for display and linking
    let phoneDisplay = '';
    if (place.phone && place.phone !== 'No phone number available') {
      // Remove spaces from the phone number for the href
      const phoneHref = place.phone.replace(/\s/g, '');
      phoneDisplay = `
        <div class="nearby-place-phone">
          <span class="phone-icon"></span>
          <a href="tel:${phoneHref}">${place.phone}</a>
        </div>
      `;
    } else {
      phoneDisplay = `
        <div class="nearby-place-phone">
          <span class="phone-icon"></span>
          <span>No phone number available</span>
        </div>
      `;
    }
    
    placeItem.innerHTML = `
      <div class="nearby-place-name">${place.name}</div>
      <div class="nearby-place-address">${place.formatted_address || 'No address available'}</div>
      ${phoneDisplay}
    `;
    
    // Add click event to show details of this place
    placeItem.addEventListener('click', function() {
      const placeId = this.getAttribute('data-place-id');
      selectedNearbyPlaceId = placeId;
      getPlaceDetails(placeId);
      
      // Highlight the selected place
      const selectedItems = nearbyPlacesList.querySelectorAll('.nearby-place-item.selected');
      selectedItems.forEach(item => item.classList.remove('selected'));
      this.classList.add('selected');
      
      // Scroll this item into view if it's not visible
      this.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    
    nearbyPlacesList.appendChild(placeItem);
  });
}

// Get place details
function getPlaceDetails(placeId) {
  showLoading();
  
  fetch(`/api/places/details?placeId=${placeId}`)
    .then(response => {
      if (!response.ok) {
        throw new Error('Network response was not ok');
      }
      return response.json();
    })
    .then(data => {
      hideLoading();
      console.log('Place details response:', data);
      
      if (data.status !== 'OK' || !data.result) {
        showError('No details found for this place');
        return;
      }
      
      currentPlace = data.result;
      displayPlaceDetails(currentPlace);
      
      // Update marker position
      const location = currentPlace.geometry.location;
      const latLng = new google.maps.LatLng(location.lat, location.lng);
      
      // Set marker position (different method depending on marker type)
      if (marker instanceof google.maps.marker.AdvancedMarkerElement) {
        marker.position = latLng;
      } else {
        marker.setPosition(latLng);
      }
      
      // Smoothly pan to the location rather than jumping
      map.panTo(latLng);
    })
    .catch(error => {
      hideLoading();
      showError('Error getting place details: ' + error.message);
      console.error(error);
    });
}

// Display place details and photos
function displayPlaceDetails(place) {
  // Show the results container with a fade-in effect
  const resultsContainer = document.getElementById('results-container');
  resultsContainer.classList.remove('hidden');
  resultsContainer.style.opacity = '0';
  
  // Trigger reflow to ensure the transition works
  void resultsContainer.offsetWidth;
  
  // Fade in
  resultsContainer.style.transition = 'opacity 0.3s ease-in-out';
  resultsContainer.style.opacity = '1';
  
  // Display place name and address
  document.getElementById('place-name').textContent = place.name;
  document.getElementById('place-address').textContent = place.formatted_address || '';
  
  // Display phone number
  const placePhone = document.getElementById('place-phone');
  if (place.phone && place.phone !== 'No phone number available') {
    // Remove spaces from the phone number for the href
    const phoneHref = place.phone.replace(/\s/g, '');
    placePhone.innerHTML = `<span class="phone-icon"></span><a href="tel:${phoneHref}">${place.phone}</a>`;
  } else {
    placePhone.innerHTML = '<span class="phone-icon"></span>No phone number available';
  }
  
  // Clear previous photos
  const photosContainer = document.getElementById('photos-container');
  photosContainer.innerHTML = '';
  
  // Check if there are photos
  if (place.photos && place.photos.length > 0) {
    // Display photos
    place.photos.forEach(photo => {
      const photoRef = photo.photo_reference;
      
      if (!photoRef) return;
      
      // Create photo element
      const photoItem = document.createElement('div');
      photoItem.className = 'photo-item';
      
      const img = document.createElement('img');
      img.src = `/api/places/photo?photoReference=${encodeURIComponent(photoRef)}&maxWidth=400`;
      img.alt = place.name;
      img.loading = 'lazy';
      
      // Add loading state
      photoItem.classList.add('loading');
      
      // Remove loading state when image loads
      img.onload = () => {
        photoItem.classList.remove('loading');
        photoItem.style.opacity = '0';
        void photoItem.offsetWidth; // Trigger reflow
        photoItem.style.transition = 'opacity 0.3s ease-in-out';
        photoItem.style.opacity = '1';
      };
      
      // Add attribution if available
      if (photo.html_attributions && photo.html_attributions.length > 0) {
        const attribution = document.createElement('div');
        attribution.className = 'photo-attribution';
        attribution.innerHTML = photo.html_attributions[0];
        photoItem.appendChild(attribution);
      }
      
      photoItem.appendChild(img);
      photosContainer.appendChild(photoItem);
    });
  } else {
    // No photos available
    photosContainer.innerHTML = '<p>No photos available for this place</p>';
  }
}

// Show loading indicator
function showLoading() {
  document.getElementById('loading').classList.remove('hidden');
}

// Hide loading indicator
function hideLoading() {
  document.getElementById('loading').classList.add('hidden');
}

// Show error message
function showError(message) {
  const errorElement = document.getElementById('error-message');
  errorElement.textContent = message;
  errorElement.classList.remove('hidden');
  
  // Add auto-hide after 5 seconds
  setTimeout(() => {
    errorElement.classList.add('hidden');
  }, 5000);
}

// Hide error message
function hideError() {
  document.getElementById('error-message').classList.add('hidden');
}

// Add shake animation to an element for better feedback
function shakeElement(element) {
  element.classList.add('shake');
  
  // Remove the class after the animation completes
  setTimeout(() => {
    element.classList.remove('shake');
  }, 500);
} 