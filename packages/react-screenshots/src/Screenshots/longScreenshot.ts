// Long screenshot utilities inspired by eSearch
// This module provides simple helpers to stitch multiple screenshot
// canvases into a single long image using OpenCV.js template matching.

export type LongMode = 'y' | 'xy'

let cvReady: Promise<void> | null = null

/**
 * Dynamically load OpenCV.js only when required.
 */
export function loadOpenCV (): Promise<void> {
  if (!cvReady) {
    cvReady = new Promise((resolve) => {
      // biome-ignore lint: external library
      const cv = require('@techstark/opencv-js') as typeof import('@techstark/opencv-js')
      ;(cv as any).onRuntimeInitialized = () => resolve()
    })
  }
  return cvReady
}

/**
 * Match two canvases and calculate the offset of the second image
 * relative to the first one. The algorithm clips the centre area
 * of the second image then performs template matching against the
 * first image to find the best alignment.
 */
export function matchCanvas (
  img0: HTMLCanvasElement,
  img1: HTMLCanvasElement,
  mode: LongMode = 'y'
): { dx: number, dy: number, srcDX: number, srcDY: number, clipped: HTMLCanvasElement } {
  const cv = require('@techstark/opencv-js') as typeof import('@techstark/opencv-js')
  const clip = (v: number) => Math.floor(Math.max(v - Math.max((v / 3) * 1, 50), 0) / 2)
  const dw = mode === 'xy' ? clip(img1.width) : 0
  const dh = clip(img1.height)

  const clipCanvas = document.createElement('canvas')
  clipCanvas.width = img1.width - dw * 2
  clipCanvas.height = img1.height - dh * 2
  clipCanvas.getContext('2d')?.drawImage(img1, -dw, -dh)

  const src = cv.imread(img0)
  const templ = cv.imread(clipCanvas)
  const dst = new cv.Mat()
  const mask = new cv.Mat()
  cv.matchTemplate(src, templ, dst, cv.TM_CCOEFF, mask)
  const result = cv.minMaxLoc(dst, mask)
  const maxPoint = result.maxLoc
  const dx = maxPoint.x
  const dy = maxPoint.y
  src.delete(); dst.delete(); mask.delete(); templ.delete()

  const ndx = dx - dw
  const ndy = dy - dh

  const clip2 = document.createElement('canvas')
  clip2.width = ndx !== 0 ? img1.width - dw : img1.width
  clip2.height = ndy !== 0 ? img1.height - dh : img1.height
  clip2.getContext('2d')?.drawImage(img1, ndx > 0 ? -dw : 0, ndy > 0 ? -dh : 0)

  return { dx: ndx > 0 ? dx : ndx, dy: ndy > 0 ? dy : ndy, srcDX: ndx, srcDY: ndy, clipped: clip2 }
}

interface LongState {
  img: HTMLCanvasElement | null
  imgXY: { x: number, y: number }
  lastImg: HTMLCanvasElement | null
  lastXY: { x: number, y: number }
}

/**
 * Stitch a sequence of canvases into a single canvas.
 * Images should be provided in capture order.
 */
export async function stitchSequence (
  canvases: HTMLCanvasElement[],
  mode: LongMode = 'y'
): Promise<HTMLCanvasElement> {
  if (canvases.length === 0) throw new Error('no canvas to stitch')
  await loadOpenCV()

  const state: LongState = {
    img: canvases[0],
    imgXY: { x: 0, y: 0 },
    lastImg: canvases[0],
    lastXY: { x: 0, y: 0 }
  }

  for (let i = 1; i < canvases.length; i++) {
    const match = matchCanvas(state.lastImg!, canvases[i], mode)
    const dx = mode === 'xy' ? match.dx : 0
    const dy = match.dy
    state.img = putCanvas(state.img!, match.clipped, dx + state.lastXY.x, dy + state.lastXY.y, state.imgXY)
    state.lastImg = canvases[i]
    state.lastXY.x += mode === 'xy' ? match.srcDX : 0
    state.lastXY.y += match.srcDY
  }

  return state.img!
}

function putCanvas (
  base: HTMLCanvasElement,
  img: HTMLCanvasElement,
  x: number,
  y: number,
  state: { x: number, y: number } = { x: 0, y: 0 }
): HTMLCanvasElement {
  const newCanvas = document.createElement('canvas')
  const ctx = newCanvas.getContext('2d') as CanvasRenderingContext2D

  const srcW = base.width
  const srcH = base.height
  const minX = state.x
  const minY = state.y
  const maxX = minX + srcW
  const maxY = minY + srcH

  let srcDx = 0
  let srcDy = 0

  if (x < minX) {
    srcDx = minX - x
    newCanvas.width = srcDx + srcW
    state.x -= srcDx
  } else if (x + img.width > maxX) {
    newCanvas.width = x + img.width - maxX + srcW
  } else {
    newCanvas.width = srcW
  }

  if (y < minY) {
    srcDy = minY - y
    newCanvas.height = srcDy + srcH
    state.y -= srcDy
  } else if (y + img.height > maxY) {
    newCanvas.height = y + img.height - maxY + srcH
  } else {
    newCanvas.height = srcH
  }

  ctx.drawImage(base, srcDx, srcDy)
  const nx = x - state.x
  const ny = y - state.y
  ctx.drawImage(img, nx, ny)

  return newCanvas
}
