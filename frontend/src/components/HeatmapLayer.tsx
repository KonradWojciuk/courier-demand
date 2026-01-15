'use client';

import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';

interface HeatmapLayerProps {
  positions: Array<[number, number, number]>; // [lat, lng, intensity]
  options?: {
    radius?: number;
    blur?: number;
    maxZoom?: number;
    minOpacity?: number;
    gradient?: Record<number, string>;
  };
}

// Simple Canvas-based Heat Layer implementation
// Will be initialized when Leaflet is available
let SimpleHeatLayerClass: any = null;

function createSimpleHeatLayerClass(L: any) {
  if (SimpleHeatLayerClass) return SimpleHeatLayerClass;
  
  class SimpleHeatLayerImpl extends L.Layer {
    private _canvas: HTMLCanvasElement | null = null;
    private _frame: number | null = null;
    private _redraw: () => void;
    private _gradient: CanvasGradient | null = null;

    private positions: Array<[number, number, number]>;
    public options: L.LayerOptions & {
      radius: number;
      blur: number;
      maxZoom: number;
      minOpacity: number;
      gradient: Record<number, string>;
    };

    constructor(
      positions: Array<[number, number, number]>,
      options: {
        radius: number;
        blur: number;
        maxZoom: number;
        minOpacity: number;
        gradient: Record<number, string>;
      }
    ) {
      super();
      this.positions = positions;
      this.options = {
        ...options,
        pane: 'overlayPane'
      } as L.LayerOptions & typeof options;
      this._redraw = this._redrawBound.bind(this);
    }

    onAdd(map: L.Map): this {
      this._map = map;
      if (!this._canvas) {
        this._initCanvas();
      }
      const pane = map.getPane('overlayPane') || map.getPane('mapPane');
      if (pane && this._canvas) {
        pane.appendChild(this._canvas);
      }
      this._reset();
      map.on('moveend', this._reset, this);
      map.on('move', this._draw, this);
      map.on('resize', this._reset, this);
      map.on('zoom', this._reset, this);
      map.on('viewreset', this._reset, this);
      if (map.options.zoomAnimation && (L as any).Browser?.any3d) {
        map.on('zoomanim', this._animateZoom, this);
        map.on('zoomend', this._reset, this);
      }
      this._draw();
      return this;
    }

    onRemove(map: L.Map): this {
      if (this._canvas) {
        const pane = map.getPane('overlayPane') || map.getPane('mapPane');
        if (pane && pane.contains(this._canvas)) {
          pane.removeChild(this._canvas);
        }
      }
      map.off('moveend', this._reset, this);
      map.off('move', this._draw, this);
      map.off('resize', this._reset, this);
      map.off('zoom', this._reset, this);
      map.off('viewreset', this._reset, this);
      if (map.options.zoomAnimation) {
        map.off('zoomanim', this._animateZoom, this);
        map.off('zoomend', this._reset, this);
      }
      return this;
    }

    _initCanvas(): void {
      const canvas = (this._canvas = document.createElement('canvas'));
      const size = this._map!.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
      canvas.className = 'leaflet-heatmap-layer';
      const originProp = L.DomUtil.testProp(['transformOrigin', 'WebkitTransformOrigin', 'msTransformOrigin']);
      canvas.style[originProp as any] = '50% 50%';
      this._updateOptions();
    }

    _updateOptions(): void {
      if (!this._canvas) return;
      const ctx = this._canvas.getContext('2d')!;
      this._gradient = this._createGradient(ctx);
    }

    _createGradient(ctx: CanvasRenderingContext2D): CanvasGradient {
      // Create a small gradient for the heat point
      const size = 100;
      const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      for (const i in this.options.gradient) {
        gradient.addColorStop(parseFloat(i), this.options.gradient[i]);
      }
      return gradient;
    }

    _reset(): void {
      if (!this._map || !this._canvas) return;
      
      // Position canvas at origin of the pane (Leaflet handles pane positioning)
      L.DomUtil.setPosition(this._canvas, L.point(0, 0));
      
      const size = this._map.getSize();
      if (this._canvas.width !== size.x) {
        this._canvas.width = size.x;
      }
      if (this._canvas.height !== size.y) {
        this._canvas.height = size.y;
      }
      this._updateOptions();
      
      // Redraw after reset
      this._draw();
    }

    _draw(): void {
      if (!this._canvas || !this._map) return;

      if (this._frame !== null) {
        cancelAnimationFrame(this._frame);
      }

      this._frame = requestAnimationFrame(() => {
        if (!this._canvas || !this._map) {
          this._frame = null;
          return;
        }

        const ctx = this._canvas.getContext('2d', { willReadFrequently: false })!;
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const bounds = this._map.getBounds();
        if (!bounds) {
          this._frame = null;
          return;
        }

        const zoom = this._map.getZoom();
        const maxZoom = this.options.maxZoom || 18;
        let radius = this.options.radius;
        if (zoom > maxZoom) {
          radius = radius * Math.pow(2, maxZoom - zoom);
        }

        // Create a temporary canvas for blur effect
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this._canvas.width;
        tempCanvas.height = this._canvas.height;
        const tempCtx = tempCanvas.getContext('2d')!;

        // Draw heat points
        for (const pos of this.positions) {
          if (!bounds.contains([pos[0], pos[1]])) continue;

          // Convert lat/lng to layer point (relative to the overlay pane)
          // This gives us coordinates relative to the canvas since canvas is at [0,0] in the pane
          const layerPoint = this._map.latLngToLayerPoint([pos[0], pos[1]]);
          
          const point = {
            x: layerPoint.x,
            y: layerPoint.y
          };

          // Only draw if point is within canvas bounds
          if (point.x < -radius || point.x > this._canvas.width + radius ||
              point.y < -radius || point.y > this._canvas.height + radius) {
            continue;
          }

          const intensity = pos[2] || 1;

          // Create gradient for this point
          const gradient = tempCtx.createRadialGradient(
            point.x, point.y, 0,
            point.x, point.y, radius
          );
          
          // Add color stops based on intensity
          for (const stop in this.options.gradient) {
            const stopValue = parseFloat(stop);
            gradient.addColorStop(stopValue, this.options.gradient[stop]);
          }

          tempCtx.globalAlpha = intensity * this.options.minOpacity;
          tempCtx.fillStyle = gradient;
          tempCtx.beginPath();
          tempCtx.arc(point.x, point.y, radius, 0, Math.PI * 2);
          tempCtx.fill();
        }

        // Apply blur if needed
        if (this.options.blur > 0) {
          ctx.filter = `blur(${this.options.blur}px)`;
        } else {
          ctx.filter = 'none';
        }

        // Draw the blurred canvas to main canvas
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.filter = 'none';

        this._frame = null;
      });
    }

    _redrawBound(): void {
      this._draw();
    }

    _animateZoom(e: L.ZoomAnimEvent): void {
      // During zoom animation, we don't transform the canvas
      // Instead, we redraw with the new zoom level
      // The canvas stays at [0,0] and we recalculate all points
      this._draw();
    }

    getEvents(): { [name: string]: L.LeafletEventHandlerFn } {
      // Events are handled in onAdd/onRemove
      return {};
    }

    setLatLngs(latlngs: Array<[number, number, number]>): this {
      this.positions = latlngs;
      this._draw();
      return this;
    }

    addLatLng(latlng: [number, number, number]): this {
      this.positions.push(latlng);
      this._draw();
      return this;
    }

    setOptions(options: Partial<typeof this.options>): this {
      this.options = { ...this.options, ...options };
      this._updateOptions();
      this._draw();
      return this;
    }
  }
  
  SimpleHeatLayerClass = SimpleHeatLayerImpl;
  return SimpleHeatLayerImpl;
}

export default function HeatmapLayer({ positions, options }: HeatmapLayerProps) {
  const map = useMap();
  const heatLayerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !map) {
      return;
    }

    // Load Leaflet dynamically
    let L: any;
    try {
      L = require('leaflet');
    } catch (e) {
      console.error('HeatmapLayer: Failed to load Leaflet:', e);
      return;
    }

    // Initialize SimpleHeatLayer class if not already done
    const HeatLayerClass = SimpleHeatLayerClass || createSimpleHeatLayerClass(L);

    if (!positions || positions.length === 0) {
      return;
    }

    // Cleanup previous layer
    if (heatLayerRef.current) {
      try {
        map.removeLayer(heatLayerRef.current);
      } catch (e) {
        // Ignore cleanup errors
      }
      heatLayerRef.current = null;
    }

    // Validate positions
    const validPositions = positions
      .filter(pos => 
        Array.isArray(pos) && 
        pos.length >= 2 && 
        typeof pos[0] === 'number' && 
        typeof pos[1] === 'number' &&
        !isNaN(pos[0]) && 
        !isNaN(pos[1]) &&
        pos[0] >= -90 && pos[0] <= 90 &&
        pos[1] >= -180 && pos[1] <= 180
      )
      .map(pos => {
        const intensity = pos.length >= 3 && typeof pos[2] === 'number' && !isNaN(pos[2])
          ? Math.max(0.1, Math.min(1, pos[2]))
          : 0.5;
        return [pos[0], pos[1], intensity] as [number, number, number];
      });

    if (validPositions.length === 0) {
      return;
    }

    // Default options
    const heatOptions = {
      radius: options?.radius ?? 25,
      blur: options?.blur ?? 15,
      maxZoom: options?.maxZoom ?? 17,
      minOpacity: options?.minOpacity ?? 0.6,
      gradient: options?.gradient ?? {
        0.0: '#0066ff', // bright blue (low intensity)
        0.2: '#00aaff', // light blue
        0.4: '#00ffff', // cyan
        0.6: '#ffff00', // yellow
        0.8: '#ff8800', // orange
        1.0: '#ff0000'  // red (high intensity)
      }
    };

    // Create and add heat layer
    try {
      const heatLayer = new HeatLayerClass(validPositions, heatOptions);
      heatLayer.addTo(map);
      heatLayerRef.current = heatLayer;
      
      // Force map update
      map.invalidateSize();
    } catch (err) {
      console.error('HeatmapLayer: Error creating heat layer:', err);
    }

    // Cleanup
    return () => {
      if (heatLayerRef.current && map) {
        try {
          map.removeLayer(heatLayerRef.current);
        } catch (e) {
          // Ignore cleanup errors
        }
        heatLayerRef.current = null;
      }
    };
  }, [map, JSON.stringify(positions), JSON.stringify(options)]);

  return null;
}
