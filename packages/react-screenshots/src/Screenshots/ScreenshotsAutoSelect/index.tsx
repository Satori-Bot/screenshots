import React, { useCallback, useEffect, useState } from 'react'
import useBounds from '../hooks/useBounds'
import useStore from '../hooks/useStore'
import { Bounds } from '../types'
import './index.less'

declare global {
  interface Window { cv: any }
}

function loadOpenCV (): Promise<any> {
  if (window.cv) {
    return Promise.resolve(window.cv)
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://docs.opencv.org/4.x/opencv.js'
    script.async = true
    script.onload = () => resolve(window.cv)
    script.onerror = reject
    document.body.appendChild(script)
  })
}

export default function ScreenshotsAutoSelect (): React.ReactElement | null {
  const { image, width, height } = useStore()
  const [, boundsDispatcher] = useBounds()
  const [minThreshold, setMinThreshold] = useState(50)
  const [maxThreshold, setMaxThreshold] = useState(100)
  const [rects, setRects] = useState<Bounds[]>([])
  const [hoverRect, setHoverRect] = useState<Bounds | null>(null)

  const computeRects = useCallback(
    async (cv: any) => {
      if (!image) {
        setRects([])
        return
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(image, 0, 0, width, height)
      const src = cv.imread(canvas)
      const gray = new cv.Mat()
      const edges = new cv.Mat()
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
      cv.Canny(gray, edges, minThreshold, maxThreshold)
      const contours = new cv.MatVector()
      const hierarchy = new cv.Mat()
      cv.findContours(edges, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
      const rs: Bounds[] = []
      for (let i = 0; i < contours.size(); i++) {
        const cnt = contours.get(i)
        const r = cv.boundingRect(cnt)
        rs.push({ x: r.x, y: r.y, width: r.width, height: r.height })
        cnt.delete()
      }
      src.delete()
      gray.delete()
      edges.delete()
      contours.delete()
      hierarchy.delete()
      setRects(rs)
    },
    [image, width, height, minThreshold, maxThreshold]
  )

  useEffect(() => {
    loadOpenCV().then(computeRects).catch(() => {})
  }, [image, minThreshold, maxThreshold, computeRects])

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const found = rects.find(r => x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height)
      setHoverRect(found || null)
    },
    [rects]
  )

  const onClick = useCallback(() => {
    if (hoverRect) {
      boundsDispatcher.set(hoverRect)
    }
  }, [hoverRect, boundsDispatcher])

  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      const delta = e.deltaY > 0 ? 5 : -5
      setMinThreshold(v => Math.max(0, v + delta))
      setMaxThreshold(v => Math.max(minThreshold + 10, v + delta))
    },
    [minThreshold]
  )

  if (!image) {
    return null
  }

  return (
    <div
      className='screenshots-auto-select'
      style={{ width, height }}
      onMouseMove={onMouseMove}
      onClick={onClick}
      onWheel={onWheel}
    >
      {hoverRect && (
        <div
          className='screenshots-auto-select-rect'
          style={{
            width: hoverRect.width,
            height: hoverRect.height,
            transform: `translate(${hoverRect.x}px, ${hoverRect.y}px)`
          }}
        />
      )}
    </div>
  )
}
