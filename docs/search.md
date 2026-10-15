# Search

The search bar in the navigation bar is available on every page. Use the dropdown on its left to choose the type of search, fill in the fields, then press `Enter` or click the search button (magnifying glass). The fields are cleared after each search.

| Search type                                 | Status      |
| ------------------------------------------- | ----------- |
| **Cone search (ra, dec, radius)**           | Available   |
| **Search by ID**                            | Available   |
| **Search by catalog via SIMBAD**            | Coming soon |
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
