# Sky Explorer

The home page is built around the Sky Explorer: an all-sky map of every source, with a table of the sources currently in view below it. The map and table are linked. Panning, zooming and filtering the map changes which sources the table lists.

## All-sky map

The map plots every source by position on a full-sky Mollweide projection in equatorial coordinates. It is rendered with [Aladin Lite](https://aladin.cds.unistra.fr/AladinLite/doc/), so the usual Aladin controls work:

- **Pan** by clicking and dragging.
- **Zoom** with the scroll wheel or the zoom controls.
- **Fullscreen**: use Aladin's fullscreen button to expand the map to fill the window.

The map loads zoomed out far enough to show the whole sky.

To jump to a named object such as `M 31`, use [Search by catalog via SIMBAD](search-page.md#search-by-catalog-via-simbad) in the navigation bar. To jump to a position, use a [Cone search](search-page.md#cone-search), which also draws the cone on the map. Either way, the map centers and zooms on the result and marks it with a popup.

### When the map is unavailable

Aladin Lite is loaded from the CDS servers, so the map depends on them being up. While it loads, the map area shows _Loading sky map..._. If it hasn't loaded after 15 seconds, or fails to load, the map area shrinks to a short message:

> The sky map couldn't be loaded. The Aladin sky atlas service may be temporarily unavailable.

Click **Reload page** to try again.

The rest of the home page still works without the map:

- The [sources table](#sources-table) lists every source.
- The [median flux filter](#filtering-by-median-flux) still filters the table.
- Clicking a source's name in the table opens its [light curve preview](#light-curve-preview).
- A [cone search](search-page.md#if-the-sky-map-is-unavailable) filters the table to the sources inside the cone, since the map can't show it.

If the map finishes loading later, it appears without a reload.

### Inspecting a source

- **Hover** over a marker to see the source's name, RA and Dec.
- **Click** a marker to open a light curve preview for that source.

### Light curve preview

Clicking a marker opens a preview panel with the source's light curve, broken out by frequency band. From the preview you can:

- Click **View source page** to go to the source's full page, which has more plot options and data downloads.
- Click another marker to switch the preview to that source.
- Close the preview with the close button (✕) or the `Escape` key.

### Filtering by median flux

The header above the map shows the total number of sources, for example _4,500 sources_, with _No filter applied_ below it. This count covers the whole sky, so it doesn't change as you pan or zoom. To show only sources within a certain brightness range in one frequency band:

1. Click **Filter by median flux** to open the filter menu.
2. Choose a **Frequency band**. You can't apply a filter until you choose a band.
3. Set the **Median flux range (mJy)** by dragging the slider handles or typing values into the **Min** and **Max** boxes. The range runs from 0.001 to 5 mJy. Typed values outside it are clamped to the nearest limit.
4. While you adjust the range, the menu shows how many sources match, for example _250 of 4500 sources match_.
5. Click **Apply filter**.

Once a filter is applied:

- Sources outside the range are hidden from the map. Sources with no median flux in the chosen band are hidden too.
- The markers that remain are colored to match the chosen frequency band.
- The header shows how many sources match, for example _250 of 4,500 sources match_, and the active filter below it, for example _Filtered on f090 from 0.5 to 2 mJy_.
- The table's **Median Flux** column shows each source's value in that band.

To remove the filter, click the ❌ next to the active-filter summary, or click **Clear filter** in the filter menu.

## Sources table

The table below the map lists the sources that are both:

- within the map's current field of view, and
- not hidden by an active median flux filter.

When the map is fully zoomed out, the table lists every source. As you zoom in or pan, it narrows to the part of the sky you're looking at. The table updates once the map stops moving.

The line above the table shows how many sources it lists, for example _Sources in view: 10_. While a flux filter is applied, it adds _(matching filter)_.

If the [map is unavailable](#when-the-map-is-unavailable), there's no field of view, so the table lists every source that isn't hidden by a flux filter. After a cone search, it lists only the sources inside the cone, and the line above it reads _Sources in cone_ instead. See [Cone search: If the sky map is unavailable](search-page.md#if-the-sky-map-is-unavailable).

### Columns

| Column          | Description                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Name**        | The source name. Click it to open the light curve preview. The page scrolls back up to the map so you can see it.                            |
| **RA (deg)**    | Right ascension, rounded to three decimal places.                                                                                            |
| **Dec (deg)**   | Declination, rounded to three decimal places.                                                                                                |
| **Median Flux** | Median flux in mJy for the band chosen in the flux filter. Shows _(unselected)_ in the header and `-` in each row until a filter is applied. |
| **Source Page** | Opens the source's full page in a new tab.                                                                                                   |
| **Download as** | Downloads the source's light curve data. Choose a format in the column header (Parquet, HDF5 or CSV), then click a row's download button.    |

Hover over an RA, Dec or Median Flux value to see it at full precision.

### Sorting

Click the **RA**, **Dec** or **Median Flux** column header to sort by that column. Click it again to cycle through descending, ascending and unsorted. A ▲ or ▼ next to the header shows the current sort direction. You can only sort by **Median Flux** while a flux filter is applied.

### Pagination

The table shows 25 sources per page. Page controls appear above and below the table and show which rows are on screen, for example _Displaying 1 - 25 of 480_. Use the buttons to go to the first (`<<`), previous (`<`), next (`>`) or last (`>>`) page.

If no sources are in view, the table shows _No sources detected in the map's field of view_ and the page controls read _Displaying 0 - 0 of 0_ and _Page 1 of 1_, with every button disabled. Zoom out or pan to bring sources back into view. If the table is filtered to a cone search because the map is unavailable, the message reads _No sources within the cone search_ instead.
