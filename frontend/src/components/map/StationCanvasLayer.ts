import L from 'leaflet';
import type { StationPin } from '../../api/client';
import { PIN_COLORS } from './mapConfig';
import {
  buildStationGrid,
  queryView,
  resolvePinKind,
  type GridStation,
  type StationGrid,
} from '../../utils/stationGrid';

const TAU = Math.PI * 2;
const GREEN_HALO = 'rgba(34, 197, 94, 0.20)';
const SELECT_RING = '#0F172A';
/** Extra ring of off-screen pins kept ready so small pans need no repaint. */
const PADDING = 0.15;

/** Public helper kept for callers that only need the display color. */
export function pinDisplayColor(station: StationPin): string {
  const kind = resolvePinKind(station);
  return PIN_COLORS[kind];
}

type SelectHandler = (station: StationPin) => void;

interface LayerRefs {
  stations: StationPin[];
  selectedId: string | null;
  onSelect: SelectHandler;
}

interface PlacedPin {
  gs: GridStation;
  x: number;
  y: number;
}

type MapInternals = L.Map & {
  _zoomAnimated: boolean;
  _animatingZoom: boolean;
  _getNewPixelOrigin(center: L.LatLng, zoom: number): L.Point;
};

/**
 * Single canvas layer for all station pins, built like Leaflet's own renderer.
 *
 * The canvas lives in the overlay pane and is drawn in layer-point coordinates,
 * so while the user pans Leaflet's pane transform slides it on the GPU with zero
 * JavaScript per frame. We only re-query the spatial grid and repaint when the
 * view settles (moveend / zoomend); during a zoom we apply a single scale
 * transform and repaint crisp at the end.
 */
export class StationCanvasLayer extends L.Layer {
  private _canvas!: HTMLCanvasElement;
  private _ctx!: CanvasRenderingContext2D;
  private _refs: LayerRefs = { stations: [], selectedId: null, onSelect: () => {} };
  private _grid: StationGrid = buildStationGrid([]);
  private _visible: GridStation[] = [];
  private _placed: PlacedPin[] = [];
  private _min: L.Point = L.point(0, 0);
  private _max: L.Point = L.point(0, 0);
  private _center: L.LatLng = L.latLng(0, 0);
  private _zoom = 0;
  private _zoomAnimated = false;
  private _dpr = 1;

  setData(stations: StationPin[], selectedId: string | null, onSelect: SelectHandler) {
    const dataChanged = stations !== this._refs.stations;
    this._refs = { stations, selectedId, onSelect };
    if (dataChanged) this._grid = buildStationGrid(stations);
    this._update();
  }

  onAdd(map: L.Map): this {
    const canvas = L.DomUtil.create('canvas', 'station-canvas-layer leaflet-layer');
    this._canvas = canvas as HTMLCanvasElement;
    this._ctx = this._canvas.getContext('2d')!;
    // Let drags/clicks fall through to the map; selection uses the map click event.
    this._canvas.style.pointerEvents = 'none';

    this._zoomAnimated = (map as MapInternals)._zoomAnimated;
    if (this._zoomAnimated) L.DomUtil.addClass(this._canvas, 'leaflet-zoom-animated');

    map.getPanes().overlayPane.appendChild(this._canvas);
    this._update();
    return this;
  }

  onRemove(): this {
    L.DomUtil.remove(this._canvas);
    return this;
  }

  getEvents(): Record<string, L.LeafletEventHandlerFn> {
    const events: Record<string, L.LeafletEventHandlerFn> = {
      viewreset: this._reset,
      zoom: this._onZoom,
      moveend: this._update,
      resize: this._update,
      click: this._onMapClick as L.LeafletEventHandlerFn,
    };
    if (this._zoomAnimated) {
      events.zoomanim = this._onAnimZoom as L.LeafletEventHandlerFn;
    }
    return events;
  }

  private _reset = () => {
    this._update();
    this._updateTransform(this._center, this._zoom);
  };

  private _onZoom = () => {
    if (!this._map) return;
    this._updateTransform(this._map.getCenter(), this._map.getZoom());
  };

  private _onAnimZoom = (e: L.ZoomAnimEvent) => {
    this._updateTransform(e.center, e.zoom);
  };

  /** Scale + offset the existing bitmap during a zoom (mirrors L.Renderer). */
  private _updateTransform(center: L.LatLng, zoom: number) {
    if (!this._map) return;
    const map = this._map as MapInternals;
    const scale = map.getZoomScale(zoom, this._zoom);
    const viewHalf = map.getSize().multiplyBy(0.5 + PADDING);
    // Project the reference center at the TARGET zoom (matches L.Renderer);
    // using the old zoom here pushes the canvas off-screen mid-animation.
    const currentCenterPoint = map.project(this._center, zoom);
    const topLeftOffset = viewHalf
      .multiplyBy(-scale)
      .add(currentCenterPoint)
      .subtract(map._getNewPixelOrigin(center, zoom));

    if (L.Browser.any3d) {
      L.DomUtil.setTransform(this._canvas, topLeftOffset, scale);
    } else {
      L.DomUtil.setPosition(this._canvas, topLeftOffset);
    }
  }

  /** Reposition + resize the padded canvas, then re-query the grid and repaint. */
  private _update = () => {
    if (!this._map || (this._map as MapInternals)._animatingZoom) return;
    const map = this._map;
    const size = map.getSize();
    const min = map.containerPointToLayerPoint(size.multiplyBy(-PADDING)).round();
    const max = min.add(size.multiplyBy(1 + PADDING * 2)).round();
    this._min = min;
    this._max = max;
    this._center = map.getCenter();
    this._zoom = map.getZoom();

    const bSize = max.subtract(min);
    const dpr = window.devicePixelRatio || 1;
    this._dpr = dpr;

    L.DomUtil.setPosition(this._canvas, min);
    this._canvas.width = Math.round(bSize.x * dpr);
    this._canvas.height = Math.round(bSize.y * dpr);
    this._canvas.style.width = `${bSize.x}px`;
    this._canvas.style.height = `${bSize.y}px`;

    this._updateVisible();
    this._paint();
  };

  private _updateVisible() {
    if (!this._map) return;
    const map = this._map;
    const nw = map.layerPointToLatLng(this._min);
    const se = map.layerPointToLatLng(this._max);
    this._visible = queryView(
      this._grid,
      { south: se.lat, west: nw.lng, north: nw.lat, east: se.lng },
      this._zoom,
      0,
    );
  }

  private _paint() {
    if (!this._map) return;
    const map = this._map;
    const ctx = this._ctx;
    const min = this._min;
    const dpr = this._dpr;
    const zoom = this._zoom;
    const sel = this._refs.selectedId;

    // Clear in device space, then draw in layer-point space.
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, -min.x * dpr, -min.y * dpr);

    this._placed = [];
    let selected: PlacedPin | null = null;

    // Draw lowest priority first so available (green) pins sit on top.
    for (let i = this._visible.length - 1; i >= 0; i--) {
      const gs = this._visible[i];
      const lp = map.latLngToLayerPoint([gs.s.latitude, gs.s.longitude]);
      const placed = { gs, x: lp.x, y: lp.y };
      this._placed.push(placed);
      if (gs.s.id === sel) {
        selected = placed;
        continue;
      }
      this._drawPin(ctx, gs, lp.x, lp.y, zoom, false);
    }

    if (selected) {
      this._drawPin(ctx, selected.gs, selected.x, selected.y, zoom, true);
      drawPinChip(ctx, selected.x, selected.y, selected.gs);
    }
  }

  private _drawPin(
    ctx: CanvasRenderingContext2D,
    gs: GridStation,
    x: number,
    y: number,
    zoom: number,
    selected: boolean,
  ) {
    const isGreen = gs.kind === 'green';
    const base = isGreen ? (zoom >= 13 ? 8 : 6.5) : zoom >= 13 ? 6 : 5;
    const r = selected ? base + 2.5 : base;

    // Soft halo emphasises available chargers (cheap fill, no blur).
    if (isGreen) {
      ctx.beginPath();
      ctx.arc(x, y, r + (selected ? 7 : 5), 0, TAU);
      ctx.fillStyle = GREEN_HALO;
      ctx.fill();
    }

    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fillStyle = PIN_COLORS[gs.kind];
    if (!isGreen && !selected) ctx.globalAlpha = 0.9;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = selected ? 3 : 2;
    ctx.strokeStyle = selected ? SELECT_RING : '#fff';
    ctx.stroke();
  }

  private _onMapClick = (e: L.LeafletMouseEvent) => {
    if (!this._map) return;
    const hit = this._hitTest(e.layerPoint.x, e.layerPoint.y);
    if (hit) this._refs.onSelect(hit);
  };

  /** Hit-test only the rendered (capped) pins in layer-point space. */
  private _hitTest(x: number, y: number): StationPin | null {
    const hitRadius = 18;
    let best: StationPin | null = null;
    let bestD = hitRadius;

    for (const p of this._placed) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bestD) {
        bestD = d;
        best = p.gs.s;
      }
    }
    return best;
  }
}

/**
 * Clean rounded "price card" anchored above the selected pin, with a pointer
 * notch and a colored availability accent. This is the on-map detail surface
 * for the tapped station; the full breakdown lives in the detail sheet.
 */
function drawPinChip(ctx: CanvasRenderingContext2D, x: number, y: number, gs: GridStation) {
  const { line1, line2 } = gs.chip;
  const accent = PIN_COLORS[gs.kind];

  const fontTitle = '700 12px system-ui, -apple-system, sans-serif';
  const fontSub = '500 11px system-ui, -apple-system, sans-serif';
  const padX = 11;
  const padY = 8;
  const gap = 4;
  const accentW = 4;
  const titleH = 13;
  const subH = 12;

  ctx.font = fontTitle;
  const w1 = ctx.measureText(line1).width;
  ctx.font = fontSub;
  const w2 = ctx.measureText(line2).width;

  const contentW = Math.max(w1, w2);
  const w = accentW + 8 + contentW + padX * 2;
  const h = titleH + gap + subH + padY * 2;
  const notch = 6;
  const left = Math.round(x - w / 2);
  const top = Math.round(y - 13 - notch - h);
  const radius = 10;

  ctx.save();

  // Card with soft shadow.
  ctx.shadowColor = 'rgba(15, 23, 42, 0.18)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(left, top, w, h, radius);
  ctx.fill();

  // Pointer notch (drawn within the same shadow pass).
  ctx.beginPath();
  ctx.moveTo(x - notch, top + h - 0.5);
  ctx.lineTo(x + notch, top + h - 0.5);
  ctx.lineTo(x, top + h + notch);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Availability accent strip.
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.roundRect(left + padX, top + padY, accentW, h - padY * 2, accentW / 2);
  ctx.fill();

  const textX = left + padX + accentW + 8;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  ctx.font = fontTitle;
  ctx.fillStyle = '#0F172A';
  ctx.fillText(line1, textX, top + padY + titleH / 2);

  ctx.font = fontSub;
  ctx.fillStyle = '#64748B';
  ctx.fillText(line2, textX, top + padY + titleH + gap + subH / 2);

  ctx.restore();
}
