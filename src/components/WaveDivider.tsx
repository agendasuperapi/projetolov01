interface WaveDividerProps {
  topColor?: string;
  bottomColor?: string;
  flip?: boolean;
  className?: string;
  intensity?: 'low' | 'medium' | 'high';
}

export default function WaveDivider({ 
  topColor = 'hsl(var(--background))', 
  bottomColor = 'hsl(var(--card))',
  flip = false,
  className = '',
  intensity = 'medium'
}: WaveDividerProps) {
  const heights = {
    low: 'h-12 md:h-16',
    medium: 'h-20 md:h-32',
    high: 'h-28 md:h-44'
  };

  const paths = {
    low: "M0,40 C200,80 400,20 600,50 C800,80 1000,30 1200,60 L1200,120 L0,120 Z",
    medium: "M0,20 C150,100 300,10 500,70 C700,130 850,20 1000,80 C1100,110 1150,40 1200,50 L1200,120 L0,120 Z",
    high: "M0,10 C100,110 250,0 400,90 C550,180 650,10 800,100 C950,190 1050,30 1200,80 L1200,120 L0,120 Z"
  };

  return (
    <div 
      className={`w-full overflow-hidden leading-none ${flip ? 'rotate-180' : ''} ${className}`}
      style={{ marginTop: '-1px', marginBottom: '-1px' }}
    >
      <svg 
        viewBox="0 0 1200 120" 
        preserveAspectRatio="none" 
        className={`w-full ${heights[intensity]}`}
        style={{ display: 'block' }}
      >
        <path 
          d={paths[intensity]}
          fill={bottomColor}
        />
      </svg>
    </div>
  );
}
