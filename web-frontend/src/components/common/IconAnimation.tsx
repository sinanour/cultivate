import { useEffect, useRef, useState } from 'react';

interface IconAnimationProps {
  onComplete: () => void;
}

export default function IconAnimation({ onComplete }: IconAnimationProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [pathLength, setPathLength] = useState(0);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Calculate the total path length for the stroke animation
    if (svgRef.current) {
      const path = svgRef.current.querySelector('path');
      if (path) {
        const length = path.getTotalLength();
        setPathLength(length);
        // Mark as ready to start animation
        setIsReady(true);
      }
    }
  }, []);

  useEffect(() => {
    // Trigger onComplete after stroke animation (2000ms) + scale/fade animation (1000ms)
    const timer = setTimeout(() => {
      onComplete();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#0B1F3B',
        zIndex: 9999,
        animation: isReady ? 'fadeToWhite 1000ms ease-in-out 2000ms forwards' : 'none',
      }}
    >
      <svg
        ref={svgRef}
        width="256"
        height="256"
        viewBox="0 0 100 120"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: isReady ? 'scaleAndFade 1000ms ease-in-out 2000ms forwards' : 'none',
        }}
      >
        <path
          d="M50 50
             a8 8 0 1 1 0 -16
             a8 8 0 1 1 0 16
             a16 16 0 0 1 0 -32
             a32 32 0 1 1 0 64
             a32 32 0 1 1 0 -64
             a16 16 0 0 1 0 32"
          fill="none"
          stroke="#D4AF37"
          strokeWidth="4"
          style={{
            strokeDasharray: pathLength || 1000,
            strokeDashoffset: pathLength || 1000,
            animation: isReady ? 'drawStroke 2000ms ease-in-out forwards' : 'none',
          }}
        />
        <text
          x="50"
          y="105"
          textAnchor="middle"
          fill="#D4AF37"
          fontSize="14"
          fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          fontWeight="300"
          letterSpacing="0.5"
          style={{
            opacity: 0,
            animation: isReady ? 'fadeInText 800ms ease-in-out 1500ms forwards' : 'none',
          }}
        >
          Cultivate
        </text>
      </svg>
      <style>{`
        @keyframes drawStroke {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes scaleAndFade {
          to {
            transform: scale(3);
            opacity: 0;
          }
        }
        @keyframes fadeInText {
          to {
            opacity: 1;
          }
        }
        @keyframes fadeToWhite {
          to {
            background-color: #ffffff;
          }
        }
      `}</style>
    </div>
  );
}
