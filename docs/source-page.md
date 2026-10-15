# Source Page

Each source has its own page at `/source/<source ID>`. You can reach it by:

- clicking **View source page** in the home page's light curve preview,
- clicking a source page link in the [Sky Explorer](sky-explorer.md) table or a [search](search.md) result, or
- entering the ID in [Search by ID](search.md#search-by-id).

From top to bottom, the page has:

- a header with the source's summary statistics,
- the light curve plot,
- cross-matches and nearby sources, next to a sky viewer, and
- a data table with a download option.

## Header

The header shows the source's name, followed by badges with its position and summary statistics:

| Badge              | Description                                      |
| ------------------ | ------------------------------------------------ |
| **RA**, **Dec**    | Position in degrees, to three decimal places     |
| **Measurements**   | Number of measurements in the selected frequency |
| **Min Flux**       | Minimum flux density (mJy)                       |
| **Max Flux**       | Maximum flux density (mJy)                       |
| **Mean Flux**      | Mean flux density (mJy)                          |
| **Std. Dev. Flux** | Standard deviation of the flux density (mJy)     |
| **Median Flux**    | Median flux density (mJy)                        |

Statistics are calculated separately for each frequency. Use the **Frequency** dropdown to switch between them. Flux values are shown to three significant figures.

## Light curve

The plot shows flux density (mJy) over time for every measurement of the source.

### Reading the plot

- **Color** shows the frequency band.
- **Marker shape** shows the instrument module (optics tube) that took the measurement.
- **Error bars** show the flux density uncertainty.
- **Red outlines** mark flagged observations (see [Flagged observations](#flagged-observations)).

The two legend rows above the plot list the frequencies (in GHz) and the modules. Click an entry to hide or show every point with that frequency or module. Hidden entries appear dimmed.

Hover over a point to see its time, flux density and uncertainty. The Plotly toolbar in the top-right corner of the plot has tools to zoom, pan, reset the axes and save the plot as a PNG.

### Measurement details and cutouts

Click a point to open a details panel for that measurement. Its header names the module and frequency, and the panel shows:

- **Time**, **Flux Density** (with uncertainty) and **Flags**.
- An image cutout of the map around the source for that measurement. _Cutout Not Found_ appears if there isn't one.
- A **Download as** control to download the cutout as PNG, FITS or HDF5.

The clicked point is outlined so you can see which measurement the panel describes. Close the panel with its **X** button or the `Escape` key. Zooming or panning the plot also closes it.

### Flagged observations

Flagged observations are hidden by default. Use the **Hide Flagged Observations / Show All Observations** toggle above the plot to show them. When they're shown, flagged points have a red outline, and their flags are listed in the details panel and the data table.

### Binned and unbinned data

The plot shows every individual measurement by default (**Unbinned**). To average measurements over time windows instead:

1. Switch the toggle above the plot to **Binned**.
2. Choose a **Start time** and **End time**.
3. Choose a **Binning strategy**: `1 day`, `7 days` (the default) or `30 days`.

The plot loads once both dates are set, and reloads whenever you change a date or the strategy. In binned mode:

- Each point is an average over one bin, colored by frequency.
- Points can't be clicked, since a bin has no single measurement, cutout or flags.
- If no measurements fall within the date range, the plot area says so.

Switch the toggle back to **Unbinned** to return to individual measurements.

## Cross-matches

Lists catalog objects that have been matched to this source. Each name opens that object in the [CDS portal](https://portal.cds.unistra.fr/) in a new tab. If the source has no cross-matches, the section shows _No results_.

## Nearby sources

Lists other sources within a cone around this source. Each entry shows the source's name, which opens its page in a new tab, and its angular distance from this source in arcminutes.

Use the **Cone search radius** slider to set the cone size, from 0.1 to 5 degrees (default 1.5). The list updates when you release the slider.

## Sky viewer

An [Aladin Lite](https://aladin.cds.unistra.fr/AladinLite/doc/) viewer, next to the cross-matches and nearby sources, shows a 2MASS color image centered on the source. The source and its nearby sources are circled. Click a circle to see that source's name, RA and Dec. Changing the nearby-source radius updates the circles.

## Data access

At the bottom of the page is a table of every measurement in the light curve:

| Column                       | Description                                      |
| ---------------------------- | ------------------------------------------------ |
| **ID**                       | The measurement ID                               |
| **Time**                     | Time of the measurement                          |
| **Frequency**                | Frequency band (GHz)                             |
| **RA**, **Dec**              | Measured position (degrees)                      |
| **Flux Density**             | Flux density (mJy), to three significant figures |
| **Flux Density Uncertainty** | Uncertainty (mJy), to three significant figures  |
| **Flags**                    | Any flags on the measurement, or `n/a`           |

- The table starts sorted by time, oldest first. Click any column header to sort by that column.
- Hover over a flux value to see it at full precision.
- The table shows 25 rows per page, with page controls above it.
- The table always lists every measurement, including flagged ones, whatever the plot is set to show.

To download the full light curve, choose a format from **Download as** (Parquet, HDF5 or CSV) and click the download button.
