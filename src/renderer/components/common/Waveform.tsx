interface WaveformProps {
  color?: string
  animate?: boolean
}

export function Waveform({ color = 'currentColor', animate = false }: WaveformProps) {
  return (
    <svg
      width="100%"
      height="60"
      viewBox="0 0 400 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ opacity: 0.6 }}
    >
      {animate && (
        <style>{`
          @keyframes wave-pulse {
            0%, 100% { transform: scaleY(0.6); opacity: 0.4; }
            50% { transform: scaleY(1); opacity: 0.8; }
          }
        `}</style>
      )}
      {[...Array(40)].map((_, i) => {
        const height = Math.random() * 40 + 10
        const delay = animate ? `${i * 0.05}s` : '0s'
        return (
          <rect
            key={i}
            x={i * 10}
            y={(60 - height) / 2}
            width="6"
            height={height}
            fill={color}
            rx="3"
            style={
              animate
                ? {
                    animation: `wave-pulse ${0.8 + Math.random() * 0.4}s ease-in-out infinite`,
                    animationDelay: delay,
                    transformOrigin: 'center',
                  }
                : undefined
            }
          />
        )
      })}
    </svg>
  )
}
