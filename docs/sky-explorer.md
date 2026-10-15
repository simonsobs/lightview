# Sky Explorer

The home page is built around the Sky Explorer: an all-sky map of every source, with a table of the sources currently in view below it. The map and table are linked. Panning, zooming and filtering the map changes which sources the table lists.

## All-sky map

The map plots every source by position on a full-sky Mollweide projection in equatorial coordinates. It is rendered with [Aladin Lite](https://aladin.cds.unistra.fr/AladinLite/doc/), so the usual Aladin controls work:

- **Pan** by clicking and dragging.
- **Zoom** with the scroll wheel or the zoom controls.
- **Fullscreen**: use Aladin's fullscreen button to expand the map to fill the window.

The map loads zoomed out far enough to show the whole sky.

### Inspecting a source

- **Hover** over a marker to see the source's name, RA and Dec.
- **Click** a marker to open a light curve preview for that source.

### Light curve preview

Clicking a marker opens a preview panel with the source's light curve, broken out by frequency band. From the preview you can:

- Click **View source page** to go to the source's full page, which has more plot options and data downloads.
- Click another marker to switch the preview to that source.
- Close the preview with the close button (✕) or the `Escape` key.

### Filtering by median flux

The header above the map shows how many sources are displayed, for example _Showing 1200 of 4500 sources_. To show only sources within a certain brightness range in one frequency band:

1. Click **Filter by median flux** to open the filter menu.
2. Choose a **Frequency band**. You can't apply a filter until you choose a band.
3. Set the **Median flux range (mJy)** by dragging the slider handles or typing values into the **Min** and **Max** boxes. The range runs from 0.001 to 5 mJy. Typed values outside it are clamped to the nearest limit.
4. While you adjust the range, the menu shows how many sources match, for example _250 of 4500 sources match_.
5. Click **Apply filter**.

Once a filter is applied:

- Sources outside the range are hidden from the map. Sources with no median flux in the chosen band are hidden too.
- The markers that remain are colored to match the chosen frequency band.
- The header shows the active filter, for example _Filtered on f090 from 0.5 to 2 mJy_.
- The table's **Median Flux** column shows each source's value in that band.

To remove the filter, click the ❌ next to the active-filter summary, or click **Clear filter** in the filter menu.

## Sources table

The table below the map lists the sources that are both:

- within the map's current field of view, and
- not hidden by an active median flux filter.

When the map is fully zoomed out, the table lists every source. As you zoom in or pan, it narrows to the part of the sky you're looking at. The table updates once the map stops moving.

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
