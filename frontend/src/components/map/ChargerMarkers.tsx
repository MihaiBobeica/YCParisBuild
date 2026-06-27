import { memo } from 'react';
import type { StationPin } from '../../api/client';
import { StationCanvasLayerComponent } from './StationCanvasLayerComponent';

export { pinDisplayColor } from './StationCanvasLayer';

interface Props {
  stations: StationPin[];
  selectedId: string | null;
  zoom: number;
  onSelect: (station: StationPin) => void;
}

/** Canvas-based marker layer — only paints stations in the current viewport. */
export const ChargerMarkers = memo(function ChargerMarkers({
  stations,
  selectedId,
  onSelect,
}: Props) {
  return (
    <StationCanvasLayerComponent stations={stations} selectedId={selectedId} onSelect={onSelect} />
  );
});
