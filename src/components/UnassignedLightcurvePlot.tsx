import { useMemo } from 'react';
import { UnassignedFluxMeasurement } from '../types';
import { Lightcurve } from './Lightcurve';
import { toInstrumentLightcurveData } from '../utils/unassignedPlotHelpers';
import { DEFAULT_PLOT_LAYOUT } from '../configs/constants';

type UnassignedLightcurvePlotProps = {
  sourceId: string;
  measurements: UnassignedFluxMeasurement[];
  height?: number;
};

/** Interactive flux-versus-time plot for an unassigned source, rendered through the same
 * Lightcurve component an assigned source's plot uses. There are no cutout images for
 * unassigned measurements yet, so a clicked marker's tooltip will show "Cutout Not Found"
 * for now. */
export function UnassignedLightcurvePlot({
  sourceId,
  measurements,
  height = 400,
}: UnassignedLightcurvePlotProps) {
  const lightcurveData = useMemo(
    () => toInstrumentLightcurveData(sourceId, measurements),
    [sourceId, measurements]
  );

  if (!measurements.length) {
    return <p className="small-text">No detections to plot.</p>;
  }

  return (
    <Lightcurve
      lightcurveData={lightcurveData}
      plotLayout={{ width: DEFAULT_PLOT_LAYOUT.width, height }}
      legendMarginTop={120}
      legendBottomRowYOffset={1.1}
      hideStrategyToggle
      hideFlaggedObsToggle
      // Unlike an assigned source's review flags, an unassigned measurement's extra.flags can
      // carry simulation/provenance tags (see toInstrumentLightcurveData) rather than "this point
      // is bad"; in practice nearly every point ends up flagged, so there's neither a toggle to
      // hide them nor a red outline calling them out; both would be meaningless here.
      defaultHideFlaggedData={false}
      showFlaggedMarkerStyling={false}
    />
  );
}
