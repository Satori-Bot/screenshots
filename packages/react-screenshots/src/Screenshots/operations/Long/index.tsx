import React, { ReactElement, useCallback, useEffect, useState } from 'react'
import ScreenshotsButton from '../../ScreenshotsButton'
import useStore from '../../hooks/useStore'
import useCall from '../../hooks/useCall'
import useReset from '../../hooks/useReset'

export default function Long (): ReactElement {
  const { bounds, width, height, lang } = useStore()
  const call = useCall()
  const reset = useReset()
  const [capturing, setCapturing] = useState(false)
  const [segments, setSegments] = useState<string[]>([])

  const capture = useCallback(async () => {
    const url = (await window.screenshots.captureLong()) as string | null
    if (url) {
      setSegments((arr) => [...arr, url])
    }
  }, [])

  useEffect(() => {
    if (!capturing) return
    const id = window.setInterval(capture, 500)
    return () => window.clearInterval(id)
  }, [capturing, capture])

  const start = useCallback(async () => {
    setSegments([])
    await window.screenshots.startLong()
    await capture()
    setCapturing(true)
  }, [capture])

  const stop = useCallback(async () => {
    await capture()
    await window.screenshots.stopLong()
    if (!bounds) {
      setCapturing(false)
      setSegments([])
      return
    }
    const images = await Promise.all(
      segments.map(
        (u) =>
          new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image()
            img.onload = () => resolve(img)
            img.onerror = reject
            img.src = u
          })
      )
    )
    const canvas = document.createElement('canvas')
    canvas.width = bounds.width
    canvas.height = bounds.height * images.length
    const ctx = canvas.getContext('2d')
    if (ctx) {
      images.forEach((img, i) => {
        ctx.drawImage(
          img,
          bounds.x,
          bounds.y,
          bounds.width,
          bounds.height,
          0,
          i * bounds.height,
          bounds.width,
          bounds.height
        )
      })
    }
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), 'image/png')
    )
    if (blob) {
      const totalBounds = { ...bounds, height: bounds.height * images.length }
      call('onOk', blob, totalBounds)
      reset()
    }
    setCapturing(false)
    setSegments([])
  }, [bounds, capture, call, reset, segments])

  const onClick = useCallback(() => {
    if (capturing) {
      stop()
    } else {
      start()
    }
  }, [capturing, start, stop])

  return (
    <ScreenshotsButton
      title={lang.operation_long_title || '长截图'}
      icon='icon-rectangle'
      checked={capturing}
      onClick={onClick}
    />
  )
}
