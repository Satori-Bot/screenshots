import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react'
import useStore from '../../hooks/useStore'
import useCall from '../../hooks/useCall'
import useReset from '../../hooks/useReset'
import ScreenshotsButton from '../../ScreenshotsButton'
import { stitchSequence } from '../../longScreenshot'

function loadImage (url: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.src = url
  })
}

export default function Long (): ReactElement | null {
  const { bounds, width, height, lang, display } = useStore()
  const call = useCall()
  const reset = useReset()
  const [running, setRunning] = useState(false)
  const framesRef = useRef<string[]>([])

  const handleAdd = useCallback((url: string) => {
    framesRef.current.push(url)
  }, [])

  useEffect(() => {
    if (!running) return
    window.screenshots.on('long-add', handleAdd)
    return () => {
      window.screenshots.off('long-add', handleAdd)
    }
  }, [running, handleAdd])

  useEffect(() => {
    if (!running) return
    const handleEnd = () => {
      setRunning(false)
      finish()
    }
    window.screenshots.on('long-end', handleEnd)
    return () => {
      window.screenshots.off('long-end', handleEnd)
    }
  }, [running, finish])

  const cropImage = async (url: string): Promise<HTMLCanvasElement> => {
    const img = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = bounds!.width
    canvas.height = bounds!.height
    const ctx = canvas.getContext('2d')!
    const rx = img.naturalWidth / width
    const ry = img.naturalHeight / height
    ctx.drawImage(
      img,
      bounds!.x * rx,
      bounds!.y * ry,
      bounds!.width * rx,
      bounds!.height * ry,
      0,
      0,
      bounds!.width,
      bounds!.height,
    )
    return canvas
  }

  const finish = useCallback(async () => {
    const canvases = [] as HTMLCanvasElement[]
    for (const url of framesRef.current) {
      canvases.push(await cropImage(url))
    }
    if (!canvases.length) return
    const result = await stitchSequence(canvases)
    result.toBlob(async (blob) => {
      if (!blob) return
      call('onOk', blob, bounds!)
      reset()
    }, 'image/png')
  }, [call, bounds, reset])

  const onClick = useCallback(() => {
    if (!bounds || !display) return
    if (!running) {
      framesRef.current = []
      window.screenshots.longStart({ bounds, display })
      setRunning(true)
    } else {
      window.screenshots.longStop()
      setRunning(false)
      finish()
    }
  }, [bounds, display, running, finish])

  if (!bounds) return null

  return (
    <ScreenshotsButton
      title={lang.operation_long_title || 'Long'}
      icon='icon-rectangle'
      checked={running}
      onClick={onClick}
    />
  )
}
