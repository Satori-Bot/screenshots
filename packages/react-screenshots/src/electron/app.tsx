import React, { useCallback, useEffect, useState } from 'react'
import Screenshots from '../Screenshots'
import { Bounds } from '../Screenshots/types'
import { Lang } from '../Screenshots/zh_CN'
import { cropImage, stitchImages } from './scrollCapture'
import './app.less'

export interface Display {
  id: number
  x: number
  y: number
  width: number
  height: number
}

export default function App (): JSX.Element {
  const [url, setUrl] = useState<string | undefined>(undefined)
  const [width, setWidth] = useState(window.innerWidth)
  const [height, setHeight] = useState(window.innerHeight)
  const [display, setDisplay] = useState<Display | undefined>(undefined)
  const [lang, setLang] = useState<Lang | undefined>(undefined)
  const [scrolling, setScrolling] = useState(false)
  const scrollBoundsRef = React.useRef<Bounds | null>(null)
  const scrollImagesRef = React.useRef<string[]>([])

  const onSave = useCallback(
    async (blob: Blob | null, bounds: Bounds) => {
      if (!display || !blob) {
        return
      }
      window.screenshots.save(await blob.arrayBuffer(), { bounds, display })
    },
    [display]
  )

  const onCancel = useCallback(() => {
    window.screenshots.cancel()
  }, [])

  const onOk = useCallback(
    async (blob: Blob | null, bounds: Bounds) => {
      if (!display || !blob) {
        return
      }
      window.screenshots.ok(await blob.arrayBuffer(), { bounds, display })
    },
    [display]
  )

  const onScrollCapture = useCallback(
    async (bounds: Bounds, payload?: { url: string, width: number, height: number }) => {
      if (!display || !url || scrolling) {
        return
      }

      const shouldStart = window.confirm(
        `${lang?.operation_scroll_title ?? '滚动截图'}: ` +
          '使用 Ctrl+Alt+S 追加截图，Ctrl+Alt+X 结束拼接'
      )

      if (!shouldStart) {
        return
      }

      try {
        const firstImage = await cropImage(
          payload?.url ?? url,
          bounds,
          payload?.width ?? width,
          payload?.height ?? height
        )
        scrollBoundsRef.current = bounds
        scrollImagesRef.current = [firstImage]
        setScrolling(true)
        window.screenshots.startScroll(display)
      } catch (err) {
        console.error('start scroll capture fail', err)
      }
    },
    [display, height, lang?.operation_scroll_title, scrolling, url, width]
  )

  useEffect(() => {
    const onSetLang = (lang: Lang) => {
      setLang(lang)
    }

    const onCapture = (display: Display, dataURL: string) => {
      setDisplay(display)
      setUrl(dataURL)
      setScrolling(false)
      scrollBoundsRef.current = null
      scrollImagesRef.current = []
    }

    const onReset = () => {
      setUrl(undefined)
      setDisplay(undefined)
      setScrolling(false)
      scrollBoundsRef.current = null
      scrollImagesRef.current = []
      // 确保截图区域被重置
      requestAnimationFrame(() => window.screenshots.reset())
    }

    const onScrollCaptureData = async (dataURL: string) => {
      if (!scrollBoundsRef.current) {
        return
      }
      try {
        const nextImage = await cropImage(
          dataURL,
          scrollBoundsRef.current,
          width,
          height
        )
        scrollImagesRef.current.push(nextImage)
      } catch (err) {
        console.error('append scroll capture fail', err)
      }
    }

    const onScrollEnd = async () => {
      setScrolling(false)
      if (!scrollImagesRef.current.length) {
        scrollBoundsRef.current = null
        return
      }
      try {
        const stitched = await stitchImages(scrollImagesRef.current)
        scrollImagesRef.current = []
        scrollBoundsRef.current = null
        setUrl(stitched)
      } catch (err) {
        scrollImagesRef.current = []
        scrollBoundsRef.current = null
        console.error('stitch scroll capture fail', err)
      }
    }

    window.screenshots.on('setLang', onSetLang)
    window.screenshots.on('capture', onCapture)
    window.screenshots.on('reset', onReset)
    window.screenshots.on('scrollCapture', onScrollCaptureData)
    window.screenshots.on('scrollEnd', onScrollEnd)
    // 告诉主进程页面准备完成
    window.screenshots.ready()
    return () => {
      window.screenshots.off('capture', onCapture)
      window.screenshots.off('setLang', onSetLang)
      window.screenshots.off('reset', onReset)
      window.screenshots.off('scrollCapture', onScrollCaptureData)
      window.screenshots.off('scrollEnd', onScrollEnd)
    }
  }, [height, width])

  useEffect(() => {
    const onResize = () => {
      setWidth(window.innerWidth)
      setHeight(window.innerHeight)
    }

    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
    }
  }, [onCancel])

  return (
    <div className='body'>
      <Screenshots
        url={url}
        width={width}
        height={height}
        lang={lang}
        onSave={onSave}
        onCancel={onCancel}
        onOk={onOk}
        onScrollCapture={onScrollCapture}
      />
    </div>
  )
}
