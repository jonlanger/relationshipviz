import { useCamera, useSigma } from '@react-sigma/core';
import { Download, Maximize, Minus, Plus } from 'lucide-react';
import { IconButton, Tooltip } from '../../atoms';
import styles from './NetworkGraph.module.css';

/** Zoom / fit / export — floating over the canvas. */
export function GraphControls({ background }: { background: string }) {
  const sigma = useSigma();
  const { zoomIn, zoomOut, reset } = useCamera({ duration: 300, factor: 1.6 });

  const exportPng = () => {
    // Render synchronously, then composite the layers while the WebGL buffers are still valid.
    sigma.refresh();
    const { width, height } = sigma.getDimensions();
    const ratio = window.devicePixelRatio || 1;
    const out = document.createElement('canvas');
    out.width = width * ratio;
    out.height = height * ratio;
    const ctx = out.getContext('2d')!;
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, out.width, out.height);
    const layers = sigma.getCanvases();
    for (const name of ['edges', 'nodes', 'edgeLabels', 'labels', 'hovers', 'hoverNodes']) {
      const c = layers[name];
      if (c) ctx.drawImage(c, 0, 0, out.width, out.height);
    }
    const a = document.createElement('a');
    a.download = `relationshipviz-${new Date().toISOString().slice(0, 10)}.png`;
    a.href = out.toDataURL('image/png');
    a.click();
  };

  return (
    <div className={styles.controls} role="toolbar" aria-label="Graph controls">
      <Tooltip content="Zoom in" side="left"><IconButton icon={Plus} label="Zoom in" onClick={() => zoomIn()} /></Tooltip>
      <Tooltip content="Zoom out" side="left"><IconButton icon={Minus} label="Zoom out" onClick={() => zoomOut()} /></Tooltip>
      <Tooltip content="Fit to screen" side="left"><IconButton icon={Maximize} label="Fit to screen" onClick={() => reset()} /></Tooltip>
      <span className={styles.controlsDivider} />
      <Tooltip content="Export PNG" side="left"><IconButton icon={Download} label="Export PNG" onClick={exportPng} /></Tooltip>
    </div>
  );
}
