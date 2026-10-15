# Cross Matching

The Cross Matcher is where reviewers decide what to do with **unassigned sources**: detections in LightcurveDB that haven't been linked to a known source. Each unassigned source is reviewed and either merged with a nearby candidate, matched to a SIMBAD object, registered as a new source, or classified as noise.

Open it with the **Cross Matcher** button in the navigation bar, or go to `/unassigned`. The Cross Matcher is only available when `VITE_CROSSMATCH_ENABLED` is `true` (see [Configuration](configuration.md)). Otherwise the button is hidden and the `/unassigned` pages show _Page not found_.

## Review statuses

Every unassigned source has one of these statuses:

| Status             | Meaning                                                                          |
| ------------------ | -------------------------------------------------------------------------------- |
| **Unmatched**      | Not reviewed yet. This is the default, and the only status you can act on.       |
| **Merged**         | Merged into another unassigned source. Its detections now belong to that source. |
| **External match** | Matched to a SIMBAD object.                                                      |
| **Novel**          | Registered as a new source.                                                      |
| **Noise**          | Classified as noise.                                                             |

Merged, external match, novel and noise are all final. Once a source has one of these statuses, it can't be reviewed again.

## Unassigned sources list

The list page shows a table of unassigned sources:

| Column              | Description                                    |
| ------------------- | ---------------------------------------------- |
| **Source ID**       | The unassigned source's ID                     |
| **Position (ICRS)** | RA and Dec in degrees, to five decimal places  |
| **First Seen**      | Time of the source's earliest detection        |
| **Last Seen**       | Time of the source's latest detection          |
| **Status**          | The source's [review status](#review-statuses) |
| **Review**          | Opens the source's review page                 |

- Use the **Status** dropdown above the table to show only sources with one status. The count above the table updates to match.
- Click a column header to sort by that column.

## Reviewing a source

Click **Review** on a row to open that source's review page at `/unassigned/<source ID>`. Use **← All unassigned sources** to go back to the list.

The header shows the source ID, its position, the number of detections and the time range they cover. If the source has already been reviewed, a banner below the header says who reviewed it, when, and what they decided. For an external match, the banner also links to the SIMBAD object.

### Light curve

A flux (mJy) versus time plot of the source's detections. Color shows frequency and marker shape shows optics tube. It works like the [source page light curve](source-page.md#light-curve), with these differences:

- There's no flagged-observations toggle and no binned mode.
- Flags on unassigned detections usually record where the data came from, not a problem with the measurement. So every detection is plotted, and none get a red outline.
- Clicking a point shows its details, but cutouts aren't available for unassigned detections yet. The panel shows _Cutout Not Found_.

### Sky position

A plot of where each detection falls relative to the source's position, as RA and Dec offsets in arcminutes. Color shows frequency and marker shape shows optics tube.

- The source's position is the ✕ at the center.
- The dashed circle is the 2.0 arcminute beam radius.
- Hover over a detection to see its time, RA, Dec, frequency, optics tube and offsets.

Detections spread widely across the circle, or far outside it, can suggest the candidate is more than one object or is noise.

### Interactive sky map

An [Aladin Lite](https://aladin.cds.unistra.fr/AladinLite/doc/) map using the DSS2 color survey, centered on the source:

- **Blue markers**: this source's detections.
- **Orange markers**: other unassigned sources that are still unmatched.
- **Dashed orange circle**: the 2.0 arcminute search radius.
- **Large red triangles**: potential SIMBAD matches. Click one to see its identifier, object type and position.

### Nearby unassigned sources

Lists other **unmatched** sources within 2.0 arcminutes. Click an ID to open that source's review page.

### Potential SIMBAD matches

Your browser searches SIMBAD for objects within 2.0 arcminutes of the source. It returns up to 10 objects, ordered by how often each is cited in the literature, most-cited first. The time of the search is shown above the list. Each match shows:

- its identifier, which opens the object in the CDS portal in a new tab,
- its object type, and
- its distance from the source in arcminutes.

If the SIMBAD search fails, the section says so instead of showing an empty list. Reload the page to try again. An empty list means the search worked and found nothing.

This section is hidden for sources that are already merged, matched or novel.

## Making a review decision

The **Review decision** section only appears for **unmatched** sources. Leaving a source unmatched is a valid choice. If you need more detections before deciding, take no action.

### Enter your name

Every action records who made it. Enter your name in the **Reviewer** field at the top of the section before taking any action. Action buttons stay disabled until you do. Your name is saved in your browser, so you only need to enter it once per browser.

### Actions

Each action opens a confirmation dialog first. **Cancel** is selected by default, so pressing `Enter` won't confirm by accident. After you confirm, you're taken back to the unassigned sources list. If the action fails, the dialog stays open and shows the error, so you can try again or cancel.

#### Merge with a nearby source

Use this when a nearby unassigned source is the same object as the one you're reviewing. Click **Merge** next to that source in **Nearby unassigned sources**. All of the nearby source's detections move to the source you're reviewing.

The source you're reviewing stays **unmatched**, so you can keep merging or make another decision. The nearby source becomes **merged**, and its review page then only shows which source it was merged into, by whom and when.

#### Accept an external match

Use this when the source is a known object in SIMBAD:

1. Select the object's radio button in **Potential SIMBAD matches**. The selected object's name appears in the **Review decision** section.
2. Click **Accept external match**.

The source becomes an **external match**, and the SIMBAD object's identifier, type, position, separation and search time are saved with the decision. This decision is registered with SOCat.

#### Register a novel source

Use this when the source is real but doesn't match any known object:

1. Enter a name in **New source name**.
2. Click **Register novel source**.

The source becomes **novel** and is registered with SOCat under that name.

#### Classify as noise

Use this when the source isn't a real astrophysical object:

1. Check the box confirming the source is noise.
2. Click **Classify as noise**.

The source becomes **noise**. Its detections are kept as a record of the review.

```{warning}
External match, novel and noise decisions are final and can't be undone. A merge also can't be undone for the source that was merged away.
```
