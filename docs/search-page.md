# Search

The search bar in the navigation bar is available on every page. Use the dropdown on its left to choose the type of search, fill in the fields, then press `Enter` or click the search button (magnifying glass). The fields are cleared after each successful search.

| Search type                                 | Status      |
| ------------------------------------------- | ----------- |
| **Cone search (ra, dec, radius)**           | Available   |
| **Search by ID**                            | Available   |
| **Search by catalog via SIMBAD**            | Available   |
| **Search by flare strength and date range** | Coming soon |

Search types marked "Coming soon" appear in the dropdown but can't be selected yet.

## Cone search

A cone search finds every source within a given radius of a position on the sky. All three fields are required and are in degrees:

| Field      | Description                          |
| ---------- | ------------------------------------ |
| **ra**     | Right ascension of the cone's center |
| **dec**    | Declination of the cone's center     |
| **radius** | Radius of the cone                   |

### Results

Results open on their own page. The heading repeats the search parameters, for example:

> Cone search results for '`{ {ra: 83.633}, {dec: 22.014}, {radius: 0.5} }`'

The results table lists each matching source:

| Column        | Description                                                  |
| ------------- | ------------------------------------------------------------ |
| **Source ID** | The source's ID. Click it to open the source's page.         |
| **RA (deg)**  | Right ascension in degrees, rounded to three decimal places. |
| **Dec (deg)** | Declination in degrees, rounded to three decimal places.     |

- Hover over an **RA** or **Dec** value to see it at full precision.
- Click a column header to sort by that column. Click it again to change the sort direction.
- If nothing falls within the cone, the table shows _No results_.

### Linking to results

Every cone search has its own URL, so you can bookmark results or share them:

```text
/search/cone?ra=83.633&dec=22.014&radius=0.5
```

Opening that URL runs the search again.

## Search by ID

Enter a **Source ID** to go straight to that source's page. If no source has that ID, the source page shows an error.

## Search by catalog via SIMBAD

Enter the name of an astronomical object, for example `M 31`, `3C 273` or `Sgr A*`, to find it on the [all-sky map](sky-explorer.md). The name is looked up in [SIMBAD](https://simbad.cds.unistra.fr/simbad/) through the CDS [Sesame](https://cds.unistra.fr/cgi-bin/Sesame) name resolver, so any identifier SIMBAD recognizes will work. Spacing and capitalization are flexible, e.g. `M31` and `m 31` find the same object.

While the search runs, the search button shows a spinner. If you search from another page, LightView returns to the home page.

### Results

When SIMBAD finds the object, the map:

1. Centers on the object's position.
2. Zooms in to a 10° field of view.
3. Marks the position with an orange ring and opens a popup next to it.

The sources table below the map narrows to the sources in the new field of view, as it does when you pan or zoom yourself. See [Sources table](sky-explorer.md#sources-table).

The popup shows:

| Item                        | Description                                                                                    |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| **Name**                    | The object's main identifier in SIMBAD, which may differ from what you typed (`m31` → `M 31`). |
| **RA**                      | Right ascension in degrees (ICRS), rounded to three decimal places.                            |
| **Dec**                     | Declination in degrees (ICRS), rounded to three decimal places.                                |
| **SIMBAD cone search (5′)** | Opens SIMBAD in a new tab, listing every object within 5 arcminutes of the position.           |

The ring and popup stay attached to the object as you pan and zoom. They're hidden while the object is out of view and reappear when you pan back. Close the popup with its close button (✕). A new search replaces it.

### Errors

If the search fails, a red message appears below the search bar and the map doesn't move. Your search text is kept, so you can correct a typo and try again. Close the message with its close button (✕) or the `Escape` key. It also closes when you search again or change the search type.

| Message                                                        | What it means                                                                                                        |
| -------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| _SIMBAD couldn't find an object named …_                       | SIMBAD doesn't recognize the name. Check the spelling, or try another identifier for the same object.                |
| _SIMBAD found …, but it has no recorded position_              | The object exists in SIMBAD but has no coordinates, so there is nowhere on the map to go.                            |
| _Couldn't reach SIMBAD_                                        | Your browser couldn't connect to SIMBAD. Check your network connection.                                              |
| _SIMBAD took too long to respond_                              | SIMBAD didn't answer within 15 seconds.                                                                              |
| _SIMBAD had a temporary problem_ or _SIMBAD returned an error_ | SIMBAD failed on its side. LightView retries once automatically before showing this, so wait a moment and try again. |
