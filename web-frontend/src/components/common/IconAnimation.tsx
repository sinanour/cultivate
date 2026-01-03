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
    // Trigger onComplete after stroke animation (2000ms) + scale/fade animation (800ms)
    const timer = setTimeout(() => {
      onComplete();
    }, 2800);

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
      }}
    >
      <svg
        ref={svgRef}
        width="256"
        height="256"
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
        style={{
          animation: isReady ? 'scaleAndFade 800ms ease-in-out 2000ms forwards' : 'none',
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
      `}</style>
    </div>
  );
}
