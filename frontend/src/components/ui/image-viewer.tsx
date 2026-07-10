'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

interface ImageViewerProps {
  src: string;
  alt?: string;
  onClose: () => void;
}

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const ZOOM_STEP = 0.5;

export function ImageViewer({ src, alt, onClose }: ImageViewerProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  // Track drag state in refs — avoids stale closures in pointer handlers
  const dragging = useRef(false);
  const lastPointer = useRef({ x: 0, y: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Reset pan when zoom returns to 1
  const resetView = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  // Clamp pan so the image edge never goes past the viewport centre
  const clampOffset = useCallback((ox: number, oy: number, s: number) => {
    const img = imgRef.current;
    if (!img) return { x: ox, y: oy };
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const iw = img.naturalWidth || img.offsetWidth;
    const ih = img.naturalHeight || img.offsetHeight;
    // Rendered size before scale
    const rw = Math.min(iw, vw * 0.92);
    const rh = Math.min(ih, vh * 0.9);
    const maxX = Math.max(0, (rw * s - vw) / 2);
    const maxY = Math.max(0, (rh * s - vh) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, ox)),
      y: Math.max(-maxY, Math.min(maxY, oy)),
    };
  }, []);

  const zoomBy = useCallback((delta: number) => {
    setScale((prev) => {
      const next = Math.max(MIN_SCALE, Math.min(MAX_SCALE, prev + delta));
      if (next === MIN_SCALE) setOffset({ x: 0, y: 0 });
      else setOffset((o) => clampOffset(o.x, o.y, next));
      return next;
    });
  }, [clampOffset]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === '+' || e.key === '=') zoomBy(ZOOM_STEP);
    if (e.key === '-') zoomBy(-ZOOM_STEP);
    if (e.key === '0') resetView();
  }, [onClose, zoomBy, resetView]);

  // Wheel zoom
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
    zoomBy(delta);
  }, [zoomBy]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    const el = containerRef.current;
    el?.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
      el?.removeEventListener('wheel', handleWheel);
    };
  }, [handleKeyDown, handleWheel]);

  // --- Pointer drag handlers ---
  const onPointerDown = (e: React.PointerEvent) => {
    if (scale <= 1) return; // no drag at base zoom
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = true;
    lastPointer.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastPointer.current.x;
    const dy = e.clientY - lastPointer.current.y;
    lastPointer.current = { x: e.clientX, y: e.clientY };
    setOffset((prev) => clampOffset(prev.x + dx, prev.y + dy, scale));
  };

  const onPointerUp = () => { dragging.current = false; };

  // Double-click toggles 2× zoom
  const onDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (scale > 1) { resetView(); } else { zoomBy(2); }
  };

  const isZoomed = scale > 1;

  return (
    <AnimatePresence>
      <motion.div
        ref={containerRef}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
        onClick={isZoomed ? undefined : onClose}
      >
        {/* Controls */}
        <div
          className="absolute right-3 top-3 z-10 flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => zoomBy(ZOOM_STEP)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => zoomBy(-ZOOM_STEP)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={resetView}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            aria-label="Reset zoom">
            <RotateCcw className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80"
            aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Image — overflow visible so panned areas can show */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative"
          onClick={(e) => e.stopPropagation()}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onDoubleClick={onDoubleClick}
          style={{ cursor: isZoomed ? (dragging.current ? 'grabbing' : 'grab') : 'zoom-in' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt={alt ?? ''}
            draggable={false}
            className="block rounded-xl object-contain shadow-2xl select-none"
            style={{
              maxHeight: '90dvh',
              maxWidth: '92vw',
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: dragging.current ? 'none' : 'transform 0.15s ease',
              willChange: 'transform',
            }}
          />
        </motion.div>

        {/* Hint */}
        <p className="absolute bottom-4 left-0 right-0 text-center text-xs text-white/40 pointer-events-none">
          {isZoomed ? 'Drag to pan · double-click or Reset to fit' : 'Click outside or press Esc to close · scroll or double-click to zoom'}
        </p>
      </motion.div>
    </AnimatePresence>
  );
}
