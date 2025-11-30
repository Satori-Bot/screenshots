import React, { ReactElement, useCallback } from 'react'
import useStore from '../../hooks/useStore'
import useCall from '../../hooks/useCall'
import ScreenshotsButton from '../../ScreenshotsButton'

export default function Scroll (): ReactElement {
  const { url, bounds, width, height, lang } = useStore()
  const call = useCall()

  const onClick = useCallback(() => {
    if (!url || !bounds) {
      return
    }
    call('onScrollCapture', bounds, { url, width, height })
  }, [bounds, call, height, url, width])

  return (
    <ScreenshotsButton
      title={lang.operation_scroll_title}
      icon='icon-arrow'
      disabled={!bounds}
      onClick={onClick}
    />
  )
}
