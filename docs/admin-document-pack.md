# Admin guide: collect property document previews

Operator notes. The same copy lives on `/documents/`. Do not publish survey numbers, deeds, or Drive URLs on listing pages.

## Purpose

For each listing, collect **on-screen previews** from official government land and registration sites. Store them in a **private Google Drive** folder named after the public property ID (for example `BLR-PLT-01`). Share files only after an enquiry is reviewed.

This pack is for due-diligence readiness. It is not a public download library.

## Preview versus paid copy

A **preview** is what the official portal shows without buying a digitally signed or certified PDF:

- RTC / Pahani screen
- Mutation (MR) status
- Encumbrance search or index result
- Khata / property-tax extract view
- Survey sketch or tippan preview, if the portal shows it

Capture that screen with a screenshot or the browser Print dialog (Save as PDF). Name the file with the date and portal.

A **paid copy** is a digitally signed EC, certified registered-document extract, or signed i-RTC that the portal sells. Do not buy those unless the owner asks. If bought later, put them in `02-certified`, not in `01-previews`.

## Rules

- Use official `.gov.in` portals only. Start from the department home page if a deep link has moved.
- Use a citizen login that belongs to the business, not a personal account you cannot hand over.
- Do not use unofficial "download sale deed" sites, Telegram sellers, or broker PDFs of unknown origin.
- Do not write scrapers, bots, or anything that bypasses login, CAPTCHA, or payment.
- Do not paste survey numbers, owner names, deed numbers, or Drive links into the public listing form.
- Keep the Drive folder Restricted (named people). Never "Anyone with the link".

## What you need from the owner (Drive only)

Keep this in `00-index.txt` inside the listing folder. Never on the website.

- District, taluk, hobli / village, or BBMP ward
- Survey number and hissa, or PID / khata for municipal land
- Sub-registrar office, if known
- Whether the land is rural (Bhoomi) or municipal (e-Aasthi / e-Khata / e-Swathu)
- Any existing owner-held scans (those go in `03-owner-supplied`)

## Recommended pack per listing

**Rural / agricultural (Bhoomi)**

1. RTC (Pahani) preview
2. Mutation register preview, if shown
3. Kaveri encumbrance search / index preview
4. Survey sketch or tippan preview, if Bhoomojini shows it
5. Tax receipt preview, if a village or panchayat portal shows it

**Bengaluru municipal / BBMP**

1. e-Aasthi / e-Khata extract preview
2. Property-tax view, if shown on the same family of sites
3. Kaveri encumbrance search / index preview
4. Layout or planning note only from an official BDA / BIAAPA / BMRDA page, if the parcel is in a notified layout

Skip a row if the official site has no free view. Write `not on portal YYYY-MM-DD` in `00-index.txt`.

## Official Karnataka starting points

Menus change. If a URL fails, open the department home and use the published citizen services.

| Record | Portal | Start here |
| --- | --- | --- |
| RTC / Pahani and mutation | Bhoomi | https://landrecords.karnataka.gov.in/ |
| Signed i-RTC (often paid) | i-RTC | https://rtc.karnataka.gov.in/ |
| Survey sketch / tippan | Bhoomojini | https://bhoomojini.karnataka.gov.in/ |
| Registration, EC search | Kaveri 2.0 | https://kaveri.karnataka.gov.in/landingpage |
| Stamps and Registration | IGR Karnataka | https://igr.karnataka.gov.in/ |
| Bengaluru khata | BBMP e-Aasthi | https://bbmpeaasthi.karnataka.gov.in/ |
| Gram panchayat Form 9 / 11 | e-Swathu | https://eswathu.karnataka.gov.in/ |

Optional location check: the official Dishaank survey app. That is a map check, not a title paper.

## How to capture (every portal)

1. Open only the official site from the table above.
2. Search with the district / village / survey or PID the owner gave you.
3. When the record appears, do not click through a payment or "certified copy" checkout.
4. Capture the preview: screenshot the record pane, or Print and Save as PDF.
5. If the screen includes a survey number, that is expected in Drive. Do not copy it into `properties.json` or the admin listing form.
6. Upload to the matching listing folder the same day.

### Bhoomi RTC

Open Bhoomi. Choose the RTC / Pahani view. Select district, taluk, village, then survey number. Capture the RTC that loads. If mutation history is on a sibling screen, capture that too. If i-RTC asks for a fee, stop and note it as paid.

### Kaveri EC and registration index

Open Kaveri 2.0. Sign in with the business citizen account if the service requires it. Use the official property or Online EC search. Capture the result list or index **before** any digitally signed download that needs payment. A search hit that names the SRO and year is enough for the preview pack.

### Khata and tax

For BBMP limits, use e-Aasthi. For gram panchayat property, use e-Swathu. Capture the extract or Form 9 / Form 11 view the portal shows without a paid certified copy.

### Survey sketch

On Bhoomojini, open the citizen sketch / tippan / RTC-sketch service if it is listed. Capture the drawing preview. If the service is office-only that week, write that in `00-index.txt`.

## Google Drive layout

Create one private parent (Shared Drive or a My Drive folder owned by the business). Example:

```
Properties
  Listings
    BLR-PLT-01
      00-index.txt
      01-previews
      02-certified
      03-owner-supplied
      04-ready-to-share
```

File names:

`YYYY-MM-DD_portal_doctype_BLR-PLT-01.png`

Examples:

- `2026-09-13_bhoomi_rtc_BLR-PLT-01.png`
- `2026-09-13_kaveri_ec-index_BLR-PLT-01.pdf`

`00-index.txt` should list: public ID, village or ward, survey or PID (private), portals checked, date, what was captured, what was missing, who captured it.

## After a buyer enquiry

1. Open Demand desk, Recent leads, type `enquiry`.
2. Confirm the person and the property ID.
3. Copy only the files you are willing to share into `04-ready-to-share`. Watermark if the owner wants that.
4. Share that subfolder **view-only** to the buyer email. Do not share the whole listing folder.
5. Do not put the Drive URL on the public listing.

## Other states

If a later parcel is outside Karnataka, use that state's official IGR and land-records portals only. Same preview-only rule, same Drive folder shape, same ban on public survey numbers.

## Do not put on the website

Survey numbers, deed numbers, owner names, Aadhaar or PAN, raw title PDFs, or any Google Drive URL. Public pages keep the reference ID and a non-sensitive summary. Buyers use Contact.
