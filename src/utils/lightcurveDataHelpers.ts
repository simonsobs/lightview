import { BaseScatterData } from '../components/Lightcurve';

/**
 * Returns a clean marker object used for setting/resetting marker styles in a scatterplot
 * @param arrayLength Length of the data array
 * @param baseMarkerSize Size of markers in plot
 * @param baseMarkerLineColor Color of marker lines in plot
 * @param baseMarkerLineWidth Width or thickness of marker lines in plot
 * @returns
 */
export function generateBaseMarkerConfig(
  data: BaseScatterData,
  baseMarkerSize: number = 5,
  baseMarkerLineColor: string = '#000',
  baseMarkerLineWidth: number = 0
) {
  const markerData = {
    marker: {
      size: baseMarkerSize,
      line: {
        width: [] as number[],
        color: [] as string[],
      },
    },
  };
  data.flags.forEach((flag, index) => {
    const isFlagged = flag === 1;
    if (isFlagged) {
      markerData.marker.line.color[index] = 'red';
      markerData.marker.line.width[index] = 1.5;
    } else {
      markerData.marker.line.color[index] = baseMarkerLineColor;
      markerData.marker.line.width[index] = baseMarkerLineWidth;
    }
  });
  return markerData;
}
