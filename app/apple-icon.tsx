import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#6aaa64',
          color: '#ffffff',
          fontSize: 120,
          fontWeight: 700,
          fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
          letterSpacing: '0.016em',
        }}
      >
        P
      </div>
    ),
    size,
  )
}
