import cv from 'opencv-ts'

export interface LongMatchResult {
  dx: number
  dy: number
  srcDX: number
  srcDY: number
  clipedImg: HTMLCanvasElement
}

function clipValue(v: number): number {
  const x = v - Math.max((v / 3) * 1, 50)
  return Math.floor(Math.max(x, 0) / 2)
}

export function longMatch(img0: HTMLCanvasElement, img1: HTMLCanvasElement, mode: 'y' | 'xy' = 'y'): LongMatchResult {
  const dw = mode === 'xy' ? clipValue(img1.width) : 0
  const dh = clipValue(img1.height)

  const clip1 = document.createElement('canvas')
  clip1.width = img1.width - dw * 2
  clip1.height = img1.height - dh * 2
  const c1ctx = clip1.getContext('2d')!
  c1ctx.drawImage(img1, -dw, -dh)

  const src = cv.imread(img0)
  const templ = cv.imread(clip1)
  const dst = new cv.Mat()
  const mask = new cv.Mat()
  cv.matchTemplate(src, templ, dst, cv.TM_CCOEFF, mask)
  const result = cv.minMaxLoc(dst, mask)
  const maxPoint = result.maxLoc
  const dx = maxPoint.x
  const dy = maxPoint.y
  src.delete()
  dst.delete()
  mask.delete()

  const ndx = dx - dw
  const ndy = dy - dh

  const clip2 = document.createElement('canvas')
  clip2.width = ndx !== 0 ? img1.width - dw : img1.width
  clip2.height = ndy !== 0 ? img1.height - dh : img1.height
  const c2ctx = clip2.getContext('2d')!
  c2ctx.drawImage(img1, ndx > 0 ? -dw : 0, ndy > 0 ? -dh : 0)

  return {
    dx: ndx > 0 ? dx : ndx,
    dy: ndy > 0 ? dy : ndy,
    srcDX: ndx,
    srcDY: ndy,
    clipedImg: clip2
  }
}

export function longPutImg(
  base: HTMLCanvasElement | null,
  img: HTMLCanvasElement,
  xy: { x: number; y: number },
  x: number,
  y: number
): { canvas: HTMLCanvasElement; xy: { x: number; y: number } } {
  const newCanvas = document.createElement('canvas')
  const newCtx = newCanvas.getContext('2d')!

  const srcW = base?.width || 0
  const srcH = base?.height || 0
  const minX = xy.x
  const minY = xy.y
  const maxX = minX + srcW
  const maxY = minY + srcH

  let srcDx = 0
  let srcDy = 0

  if (x < minX) {
    srcDx = minX - x
    newCanvas.width = srcDx + srcW
    xy.x -= srcDx
  } else if (x + img.width > maxX) {
    newCanvas.width = x + img.width - maxX + srcW
  } else {
    newCanvas.width = srcW
  }

  if (y < minY) {
    srcDy = minY - y
    newCanvas.height = srcDy + srcH
    xy.y -= srcDy
  } else if (y + img.height > maxY) {
    newCanvas.height = y + img.height - maxY + srcH
  } else {
    newCanvas.height = srcH
  }

  if (base) newCtx.drawImage(base, srcDx, srcDy)

  const nx = x - xy.x
  const ny = y - xy.y
  newCtx.drawImage(img, nx, ny)

  return { canvas: newCanvas, xy: { x: xy.x, y: xy.y } }
}

export interface StitchOpts {
  images: ImageData[]
  rect: { x: number; y: number; width: number; height: number }
  mode?: 'y' | 'xy'
}

export function stitchLongScreenshot({ images, rect, mode = 'y' }: StitchOpts): HTMLCanvasElement {
  let base: HTMLCanvasElement | null = null
  const pos = { x: 0, y: 0 }

  for (let i = 0; i < images.length; i++) {
    const d = images[i]
    const canvas = document.createElement('canvas')
    canvas.width = rect.width
    canvas.height = rect.height
    canvas.getContext('2d')!.putImageData(d, -rect.x, -rect.y)

    if (!base) {
      base = canvas
      continue
    }

    const match = longMatch(base, canvas, mode)
    const dx = mode === 'xy' ? match.dx : 0
    const dy = match.dy
    const put = longPutImg(base, match.clipedImg, pos, pos.x + dx, pos.y + dy)
    base = put.canvas
    pos.x += mode === 'xy' ? match.srcDX : 0
    pos.y += match.srcDY
  }

  return base || document.createElement('canvas')
}
