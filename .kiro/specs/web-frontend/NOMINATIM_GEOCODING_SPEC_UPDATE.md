# Nominatim Geocoding Integration - Specification Update

## Date
December 26, 2025

## Overview

Added a new requirement to integrate with the Nominatim geocoding API to facilitate automatic population of venue coordinates based on addresses. This feature will significantly improve the user experience when creating or editing venues by eliminating the need to manually look up latitude and longitude values.

## Changes Made

### 1. Requirements Document ✅

**File:** `.kiro/specs/web-frontend/requirements.md`

**Added Requirement 21: Venue Geocoding Integration**

**User Story:** As a community organizer, I want to automatically populate venue coordinates from addresses, so that I can quickly add venues to the map without manually looking up coordinates.

**Acceptance Criteria (10 total):**

1. Integration with Nominatim geocoding API
2. Geocode button in venue create/edit form
3. API call to Nominatim with venue address
4. Automatic population of latitude/longitude on success
5. Selection dialog for multiple results
6. Error message when no results found
7. Loading indicator during geocoding
8. Manual override capability for coordinates
9. Respect Nominatim usage policy (User-Agent, rate limiting)
10. Disable geocoding when offline

**Updated Glossary:**
- Added **Nominatim**: OpenStreetMap's geocoding API service
- Added **Geocoding**: Process of converting addresses to coordinates

### 2. Design Document ✅

**File:** `.kiro/specs/web-frontend/design.md`

**Added GeocodingService:**
```typescript
- geocodeAddress(address): Queries Nominatim API to convert address to coordinates
- searchAddress(query): Searches for addresses using Nominatim search endpoint
- Returns array of geocoding results with latitude, longitude, and display name
- Implements rate limiting (max 1 request per second)
- Includes User-Agent header as required by Nominatim terms
- Handles API errors and network failures gracefully
- Caches recent geocoding results to reduce API calls
```

**Updated VenueForm Component:**
- Added "Geocode Address" button functionality
- Added loading indicator during geocoding
- Added selection dialog for multiple results
- Added error message display for failed geocoding
- Added offline state handling (disable button)
- Added manual override capability

**Added Data Model:**
```typescript
interface GeocodingResult {
  latitude: number;
  longitude: number;
  displayName: string;
  address: {
    road?: string;
    city?: string;
    state?: string;
    country?: string;
    postcode?: string;
  };
  boundingBox?: [number, number, number, number];
}
```

**Added Correctness Properties (7 new properties):**

- **Property 69:** Geocoding Request Success
- **Property 70:** Geocoding Coordinate Population
- **Property 71:** Geocoding Multiple Results Handling
- **Property 72:** Geocoding Error Handling
- **Property 73:** Geocoding Loading State
- **Property 74:** Geocoding Manual Override
- **Property 75:** Geocoding Offline Behavior

### 3. Tasks Document ✅

**File:** `.kiro/specs/web-frontend/tasks.md`

**Added Task 8.5: Implement Nominatim geocoding integration**

**Sub-tasks:**
- **8.5.1:** Create GeocodingService with Nominatim API integration
- **8.5.2:** Update VenueForm component with geocoding UI
- **8.5.3*** (optional): Write property tests for geocoding

## Nominatim API Integration Details

### API Endpoint

**Search Endpoint:**
```
https://nominatim.openstreetmap.org/search
```

**Query Parameters:**
- `q`: Address query string (required)
- `format`: Response format (use `json`)
- `limit`: Maximum number of results (default 1, max 50)
- `addressdetails`: Include address breakdown (0 or 1)

**Example Request:**
```
GET https://nominatim.openstreetmap.org/search?q=123+Main+St,+Seattle,+WA&format=json&limit=5&addressdetails=1
```

**Example Response:**
```json
[
  {
    "lat": "47.6062",
    "lon": "-122.3321",
    "display_name": "123 Main Street, Seattle, King County, Washington, USA",
    "address": {
      "road": "Main Street",
      "city": "Seattle",
      "county": "King County",
      "state": "Washington",
      "country": "United States",
      "postcode": "98101"
    },
    "boundingbox": ["47.6061", "47.6063", "-122.3322", "-122.3320"]
  }
]
```

### Usage Policy Requirements

**Nominatim Usage Policy:** https://operations.osmfoundation.org/policies/nominatim/

**Key Requirements:**
1. **User-Agent Header:** Must include application name and contact info
   - Example: `User-Agent: CommunityActivityTracker/1.0 (contact@example.com)`
2. **Rate Limiting:** Maximum 1 request per second
3. **Caching:** Cache results to avoid repeated queries for same address
4. **Attribution:** Display OpenStreetMap attribution when using results

### Implementation Strategy

**GeocodingService Implementation:**

```typescript
export class GeocodingService {
  private static readonly BASE_URL = 'https://nominatim.openstreetmap.org';
  private static readonly USER_AGENT = 'CommunityActivityTracker/1.0';
  private static readonly RATE_LIMIT_MS = 1000; // 1 request per second
  private static lastRequestTime = 0;
  private static cache = new Map<string, GeocodingResult[]>();

  static async geocodeAddress(address: string): Promise<GeocodingResult[]> {
    // Check cache first
    if (this.cache.has(address)) {
      return this.cache.get(address)!;
    }

    // Enforce rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.RATE_LIMIT_MS) {
      await new Promise(resolve => 
        setTimeout(resolve, this.RATE_LIMIT_MS - timeSinceLastRequest)
      );
    }

    // Make API request
    const params = new URLSearchParams({
      q: address,
      format: 'json',
      limit: '5',
      addressdetails: '1'
    });

    const response = await fetch(`${this.BASE_URL}/search?${params}`, {
      headers: {
        'User-Agent': this.USER_AGENT
      }
    });

    if (!response.ok) {
      throw new Error(`Geocoding failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.lastRequestTime = Date.now();

    // Transform to our format
    const results: GeocodingResult[] = data.map((item: any) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      displayName: item.display_name,
      address: item.address || {},
      boundingBox: item.boundingbox
    }));

    // Cache results
    this.cache.set(address, results);

    return results;
  }
}
```

**VenueForm Component Updates:**

```typescript
// Add state for geocoding
const [isGeocoding, setIsGeocoding] = useState(false);
const [geocodingResults, setGeocodingResults] = useState<GeocodingResult[]>([]);
const [showResultsDialog, setShowResultsDialog] = useState(false);

// Geocode button handler
const handleGeocode = async () => {
  if (!address) {
    setAddressError('Address is required for geocoding');
    return;
  }

  setIsGeocoding(true);
  try {
    const results = await GeocodingService.geocodeAddress(address);
    
    if (results.length === 0) {
      // No results found
      setNotification({
        type: 'error',
        message: 'Address could not be geocoded. Please check the address or enter coordinates manually.'
      });
    } else if (results.length === 1) {
      // Single result - auto-populate
      setLatitude(results[0].latitude.toString());
      setLongitude(results[0].longitude.toString());
      setNotification({
        type: 'success',
        message: 'Coordinates populated successfully'
      });
    } else {
      // Multiple results - show selection dialog
      setGeocodingResults(results);
      setShowResultsDialog(true);
    }
  } catch (error) {
    setNotification({
      type: 'error',
      message: 'Geocoding failed. Please try again or enter coordinates manually.'
    });
  } finally {
    setIsGeocoding(false);
  }
};

// In the form JSX
<FormField label="Coordinates" description="Optional - can be geocoded from address">
  <SpaceBetween direction="horizontal" size="s">
    <Input
      value={latitude}
      onChange={({ detail }) => setLatitude(detail.value)}
      placeholder="Latitude"
    />
    <Input
      value={longitude}
      onChange={({ detail }) => setLongitude(detail.value)}
      placeholder="Longitude"
    />
    <Button
      onClick={handleGeocode}
      loading={isGeocoding}
      disabled={!address || !isOnline || isGeocoding}
      iconName="search"
    >
      Geocode Address
    </Button>
  </SpaceBetween>
</FormField>

{/* Results selection dialog */}
<Modal
  visible={showResultsDialog}
  onDismiss={() => setShowResultsDialog(false)}
  header="Select Location"
>
  <SpaceBetween size="m">
    <Box>Multiple locations found. Please select the correct one:</Box>
    {geocodingResults.map((result, index) => (
      <Button
        key={index}
        onClick={() => {
          setLatitude(result.latitude.toString());
          setLongitude(result.longitude.toString());
          setShowResultsDialog(false);
          setNotification({
            type: 'success',
            message: 'Coordinates populated successfully'
          });
        }}
        fullWidth
      >
        {result.displayName}
      </Button>
    ))}
  </SpaceBetween>
</Modal>
```

## Benefits

1. ✅ **Improved UX:** Users don't need to manually look up coordinates
2. ✅ **Faster Data Entry:** One-click geocoding vs manual coordinate lookup
3. ✅ **Accuracy:** Reduces errors from manual coordinate entry
4. ✅ **Flexibility:** Users can still manually override if needed
5. ✅ **Offline Awareness:** Gracefully handles offline state
6. ✅ **Multiple Results:** Handles ambiguous addresses with selection dialog
7. ✅ **Error Handling:** Clear feedback when geocoding fails
8. ✅ **Performance:** Caching reduces redundant API calls
9. ✅ **Compliance:** Respects Nominatim usage policy

## User Workflow

### Creating a New Venue

1. User clicks "Create Venue" button
2. User enters venue name and address
3. User selects geographic area
4. User clicks "Geocode Address" button
5. System shows loading indicator
6. System calls Nominatim API with address
7. **Single Result:** Latitude/longitude auto-populated
8. **Multiple Results:** User selects correct location from dialog
9. **No Results:** Error message displayed, user can enter manually
10. User reviews/adjusts coordinates if needed
11. User submits form

### Editing an Existing Venue

1. User clicks "Edit" on venue
2. Form opens with existing data (including coordinates if present)
3. User updates address
4. User clicks "Geocode Address" to update coordinates
5. System updates latitude/longitude based on new address
6. User submits form

## Technical Considerations

### Rate Limiting

**Nominatim Policy:** Maximum 1 request per second

**Implementation:**
- Track last request timestamp
- Delay subsequent requests if needed
- Display loading indicator during delay
- Cache results to avoid repeated requests

### Caching Strategy

**Cache Key:** Full address string (normalized)

**Cache Duration:** Session-based (cleared on page refresh)

**Benefits:**
- Reduces API calls for repeated addresses
- Improves performance
- Respects rate limits

### Error Scenarios

1. **Network Error:** Display "Network error, please try again"
2. **No Results:** Display "Address not found, please check address or enter coordinates manually"
3. **API Error:** Display "Geocoding service unavailable, please enter coordinates manually"
4. **Rate Limited:** Automatically wait and retry (transparent to user)
5. **Offline:** Disable button with message "Geocoding requires internet connection"

### Offline Behavior

**When Offline:**
- Geocode button is disabled
- Tooltip or message: "Geocoding requires internet connection"
- Users can still manually enter coordinates
- Form submission works normally with manual coordinates

**When Online:**
- Geocode button is enabled
- Full geocoding functionality available

## Testing Strategy

### Unit Tests

1. **GeocodingService Tests:**
   - Test successful geocoding with single result
   - Test successful geocoding with multiple results
   - Test geocoding with no results
   - Test API error handling
   - Test rate limiting enforcement
   - Test caching behavior

2. **VenueForm Tests:**
   - Test geocode button click triggers API call
   - Test loading state during geocoding
   - Test coordinate population on single result
   - Test selection dialog on multiple results
   - Test error message on no results
   - Test button disabled when offline
   - Test manual coordinate override

### Property Tests (Optional)

- **Property 69:** Geocoding request success
- **Property 70:** Coordinate population
- **Property 71:** Multiple results handling
- **Property 72:** Error handling
- **Property 73:** Loading state
- **Property 74:** Manual override
- **Property 75:** Offline behavior

### Integration Tests

1. Complete venue creation flow with geocoding
2. Complete venue editing flow with address change and re-geocoding
3. Offline-to-online transition with geocoding
4. Multiple result selection and form submission

## API Documentation Reference

**Nominatim Documentation:** https://nominatim.org/release-docs/latest/api/Overview/

**Key Endpoints:**
- Search: https://nominatim.org/release-docs/latest/api/Search/
- Reverse: https://nominatim.org/release-docs/latest/api/Reverse/ (future enhancement)

**Usage Policy:** https://operations.osmfoundation.org/policies/nominatim/

## Future Enhancements

### Phase 2 Potential Features

1. **Reverse Geocoding:** Click on map to set venue location and auto-populate address
2. **Address Autocomplete:** Suggest addresses as user types
3. **Batch Geocoding:** Geocode multiple venues at once
4. **Geocoding History:** Show previously geocoded addresses
5. **Alternative Providers:** Support Google Maps Geocoding API as fallback
6. **Address Validation:** Validate address format before geocoding
7. **Coordinate Precision:** Allow specifying coordinate precision/accuracy

## Dependencies

### External API
- **Nominatim API:** Free, no API key required
- **Rate Limit:** 1 request per second
- **Availability:** Public service, no SLA

### No Backend Changes Required
This is a frontend-only feature that directly calls the Nominatim API. No backend API changes are needed.

### Browser Requirements
- Fetch API support (all modern browsers)
- CORS support (Nominatim allows cross-origin requests)

## Implementation Priority

**Priority:** Medium

**Rationale:**
- Significantly improves UX for venue management
- Not blocking for MVP (users can manually enter coordinates)
- Relatively simple to implement
- No backend dependencies

**Estimated Implementation Time:** 3-4 hours
- GeocodingService: 1 hour
- VenueForm updates: 1.5 hours
- Testing: 1-1.5 hours

## Files Updated

### Specification Documents
1. ✅ `.kiro/specs/web-frontend/requirements.md` - Added Requirement 21
2. ✅ `.kiro/specs/web-frontend/design.md` - Added GeocodingService, updated VenueForm, added properties
3. ✅ `.kiro/specs/web-frontend/tasks.md` - Added Task 8.5
4. ✅ `.kiro/specs/web-frontend/NOMINATIM_GEOCODING_SPEC_UPDATE.md` - This document

### Implementation Files (To Be Created/Updated)
- ⏭️ `web-frontend/src/services/geocoding.service.ts` - New file
- ⏭️ `web-frontend/src/components/features/VenueForm.tsx` - Update with geocoding
- ⏭️ `web-frontend/src/types/index.ts` - Add GeocodingResult interface
- ⏭️ `web-frontend/src/services/__tests__/geocoding.service.test.ts` - New test file

## Security and Privacy Considerations

### Data Privacy
- Addresses sent to Nominatim are public data (OpenStreetMap)
- No personal information should be included in geocoding requests
- Participant home addresses should be geocoded with caution

### API Security
- Nominatim uses HTTPS
- No API key required (public service)
- Rate limiting prevents abuse
- User-Agent header identifies application

### Recommendations
1. Consider adding a privacy notice when geocoding participant home addresses
2. Consider allowing users to opt-out of geocoding for sensitive locations
3. Consider implementing a backend proxy for Nominatim to:
   - Hide client IP addresses
   - Implement additional rate limiting
   - Cache results server-side
   - Monitor usage and costs

## Attribution Requirements

**OpenStreetMap Attribution:**

When displaying geocoded venues on the map, the application should include OpenStreetMap attribution as required by the ODbL license:

```
© OpenStreetMap contributors
```

This attribution should be visible on:
- Map view (already required for Leaflet/Mapbox)
- Any page displaying geocoded coordinates

## Conclusion

The Nominatim geocoding integration specification is now complete. This feature will significantly improve the venue management experience by automating coordinate lookup while maintaining flexibility for manual entry and handling edge cases gracefully.

**Status:** ✅ SPECIFICATION COMPLETE
**Requirements Added:** ✅ Requirement 21 (10 acceptance criteria)
**Design Updated:** ✅ Service, component, data model, 7 properties
**Tasks Added:** ✅ Task 8.5 (3 sub-tasks)
**Ready for Implementation:** ✅ YES
**Backend Changes Required:** ❌ NO
**External Dependencies:** ✅ Nominatim API (free, public)
**Estimated Implementation Time:** 3-4 hours
