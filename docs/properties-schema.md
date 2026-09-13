# Public properties.json schema

`data/properties.json` is the only public listing file. Keep legal documents, Drive URLs, survey numbers, and owner names out of it.

```json
{
  "updated": "2026-09-13",
  "properties": [
    {
      "id": "BLR-PLT-01",
      "title": "Residential plot",
      "listingDate": "2026-09-13",
      "status": "Available",
      "area": "2,400 sq ft",
      "dimensions": "40 ft by 60 ft",
      "roadAccess": "Public road",
      "landType": "Residential plot",
      "facing": "East",
      "priceGuidance": "Call for price",
      "location": "Village, taluk, district",
      "center": { "lat": 13.0, "lng": 77.6 },
      "boundary": [
        { "lat": 13.0, "lng": 77.6 },
        { "lat": 13.0, "lng": 77.61 },
        { "lat": 12.99, "lng": 77.61 },
        { "lat": 12.99, "lng": 77.6 }
      ],
      "mapsUrl": "https://www.google.com/maps/dir/?api=1&destination=13.0,77.6",
      "photos": ["imgs/listings/BLR-PLT-01/01.jpg"],
      "pimPdf": ""
    }
  ]
}
```

Allowed `status` values: `Available`, `Under offer`, `Sold`. Live overrides come from the API overlay and win over this file.
