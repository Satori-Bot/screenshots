import { EventEmitter } from 'events';
import { PNG } from 'pngjs';
import Screenshots from './index';
import getDisplay from './getDisplay';

interface LongCaptureOptions {
  interval?: number; // capture interval in ms
  maxOffset?: number; // template match search range
}

export default class LongCapture extends EventEmitter {
  private screenshots: Screenshots;
  private options: Required<LongCaptureOptions>;
  private timer: NodeJS.Timeout | null = null;
  private frames: PNG[] = [];

  constructor(screenshots: Screenshots, options?: LongCaptureOptions) {
    super();
    this.screenshots = screenshots;
    this.options = {
      interval: 1000,
      maxOffset: 200,
      ...options,
    } as Required<LongCaptureOptions>;
  }

  /** Start listening scroll capture */
  public async start() {
    const display = getDisplay();
    const dataURL = await (this.screenshots as any).capture(display);
    this.frames.push(this.loadPNG(dataURL));
    this.timer = setInterval(async () => {
      const url = await (this.screenshots as any).capture(display);
      this.frames.push(this.loadPNG(url));
    }, this.options.interval);
  }

  /** Stop capture and return stitched image buffer */
  public stop(): Buffer {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    const stitched = this.stitchFrames();
    const buffer = PNG.sync.write(stitched);
    this.frames = [];
    return buffer;
  }

  private loadPNG(dataURL: string): PNG {
    const b64 = dataURL.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(b64, 'base64');
    return PNG.sync.read(buffer);
  }

  private verticalOffset(a: PNG, b: PNG): number {
    const max = Math.min(this.options.maxOffset, b.height);
    let bestOffset = 0;
    let bestDiff = Number.POSITIVE_INFINITY;
    for (let off = 0; off <= max; off++) {
      let diff = 0;
      for (let y = 0; y < b.height - off; y++) {
        for (let x = 0; x < b.width; x++) {
          const idxA = ((off + y) * a.width + x) << 2;
          const idxB = (y * b.width + x) << 2;
          diff += Math.abs(a.data[idxA] - b.data[idxB]);
          diff += Math.abs(a.data[idxA + 1] - b.data[idxB + 1]);
          diff += Math.abs(a.data[idxA + 2] - b.data[idxB + 2]);
        }
      }
      if (diff < bestDiff) {
        bestDiff = diff;
        bestOffset = off;
      }
    }
    return bestOffset;
  }

  private stitchFrames(): PNG {
    if (this.frames.length === 0) {
      throw new Error('no frames captured');
    }
    let output = this.frames[0];
    let totalHeight = output.height;
    for (let i = 1; i < this.frames.length; i++) {
      const prev = output;
      const curr = this.frames[i];
      const offset = this.verticalOffset(prev, curr);
      const merged = new PNG({ width: prev.width, height: totalHeight + curr.height - offset });
      // copy previous image
      PNG.bitblt(prev, merged, 0, 0, prev.width, totalHeight, 0, 0);
      // copy non-overlap of current
      PNG.bitblt(curr, merged, 0, offset, curr.width, curr.height - offset, 0, totalHeight);
      totalHeight += curr.height - offset;
      output = merged;
    }
    return output;
  }
}

