import { Bounds } from '../Screenshots/types'

function loadImage (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = url
  })
}

export async function cropImage (
  url: string,
  bounds: Bounds,
  width: number,
  height: number
): Promise<string> {
  const image = await loadImage(url)
  const rx = image.naturalWidth / width
  const ry = image.naturalHeight / height

  const canvas = document.createElement('canvas')
  canvas.width = bounds.width * rx
  canvas.height = bounds.height * ry
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('canvas context not found')
  }

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'low'
  ctx.drawImage(
    image,
    bounds.x * rx,
    bounds.y * ry,
    bounds.width * rx,
    bounds.height * ry,
    0,
    0,
    canvas.width,
    canvas.height
  )

  return canvas.toDataURL('image/png')
}

export async function stitchImages (parts: string[]): Promise<string> {
  const images = await Promise.all(parts.map(item => loadImage(item)))
  const width = Math.max(...images.map(image => image.naturalWidth))
  const height = images.reduce((total, image) => total + image.naturalHeight, 0)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')

  if (!ctx) {
    throw new Error('canvas context not found')
  }

  let offsetY = 0
  images.forEach(image => {
    ctx.drawImage(image, 0, offsetY, image.naturalWidth, image.naturalHeight)
    offsetY += image.naturalHeight
  })

  return canvas.toDataURL('image/png')
}
