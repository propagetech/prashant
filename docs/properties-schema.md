# Public listing schema

`data/properties.json` is the file-based catalogue. The admin demand desk can also publish listings to DynamoDB (`GET /properties`). The public map merges both; API records win on the same ID. Keep legal documents, Drive URLs, survey numbers, and owner names out of both.

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
      "boundary": [],
      "mapsUrl": "https://www.google.com/maps/dir/?api=1&destination=13.0,77.6",
      "photos": ["imgs/listings/BLR-PLT-01/01.jpg"],
      "pimPdf": ""
    }
  ]
}
```

Allowed `status` values: `Available`, `Under offer`, `Sold`. Live status and admin-published parcels from the API win over this file.

The public map shows a pin from `center` or a Google Maps `placeUrl`. `boundary` is optional. The outline appears only after someone clicks that pin.
