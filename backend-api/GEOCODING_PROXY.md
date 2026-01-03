# Geocoding Proxy Implementation

## Overview

The backend provides a geocoding proxy endpoint that forwards address geocoding requests to the Nominatim API (OpenStreetMap) with proper User-Agent headers. This is necessary because browsers do not allow JavaScript to set custom User-Agent headers due to security restrictions.

## Endpoint

```
GET /api/v1/geocoding/search?q={address}
```

### Authentication

Requires valid JWT token in Authorization header:
```
Authorization: Bearer <access_token>
```

### Parameters

- `q` (required): Address string to geocode (1-500 characters)

### Response

```json
{
  "success": true,
  "data": [
    {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "displayName": "New York, NY, USA",
      "address": {
        "road": "Main Street",
        "city": "New York",
        "state": "New York",
        "country": "USA",
        "postcode": "10001"
      },
      "boundingBox": [40.7, 40.8, -74.1, -74.0]
    }
  ]
}
```

### Error Responses

- `400 VALIDATION_ERROR`: Missing or invalid query parameter
- `401 AUTHENTICATION_REQUIRED`: Missing or invalid token
- `502 EXTERNAL_API_ERROR`: Nominatim API error
- `500 INTERNAL_ERROR`: Unexpected server error

## Implementation Details

### Backend Service

**File:** `src/services/geocoding.service.ts`

- Uses axios to make HTTP requests to Nominatim API
- Sets proper User-Agent header: `CommunityActivityTracker/1.0`
- Implements rate limiting (1 request per second) to respect Nominatim usage policy
- Caches results in memory to reduce API calls
- Handles errors gracefully with descriptive messages

### Frontend Service

**File:** `web-frontend/src/services/geocoding.service.ts`

- Calls backend proxy endpoint instead of Nominatim directly
- Includes authentication token in requests
- Maintains client-side cache for performance
- Provides same interface as before (no changes needed in components)

## Nominatim Usage Policy Compliance

This implementation complies with Nominatim's usage policy:

1. ✅ **User-Agent Header**: Set to `CommunityActivityTracker/1.0` (backend can set this)
2. ✅ **Rate Limiting**: Maximum 1 request per second
3. ✅ **Caching**: Results are cached to minimize repeated requests
4. ✅ **Timeout**: 10 second timeout prevents hanging requests

## Testing

Run backend tests:
```bash
cd backend-api
npm test -- geocoding
```

## Future Enhancements

Consider these improvements:

1. **Persistent Caching**: Use Redis or database for cache persistence across server restarts
2. **Batch Geocoding**: Support multiple addresses in a single request
3. **Reverse Geocoding**: Add endpoint for coordinate-to-address conversion
4. **Alternative Providers**: Support fallback to other geocoding services (Google Maps, Mapbox)
5. **Rate Limit Monitoring**: Track and log rate limit usage
