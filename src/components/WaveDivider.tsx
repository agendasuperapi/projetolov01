interface WaveDividerProps {
  topColor?: string;
  bottomColor?: string;
  flip?: boolean;
  className?: string;
}

export default function WaveDivider({ 
  topColor = 'hsl(var(--background))', 
  bottomColor = 'hsl(var(--card))',
  flip = false,
  className = ''
}: WaveDividerProps) {
  return (
    <div 
      className={`w-full overflow-hidden leading-none ${flip ? 'rotate-180' : ''} ${className}`}
      style={{ marginTop: '-1px', marginBottom: '-1px' }}
    >
      <svg 
        viewBox="0 0 1200 120" 
        preserveAspectRatio="none" 
        className="w-full h-16 md:h-24"
        style={{ display: 'block' }}
      >
        <path 
          d="M0,0 C150,100 350,0 500,50 C650,100 750,20 900,60 C1050,100 1150,30 1200,60 L1200,120 L0,120 Z"
          fill={bottomColor}
        />
      </svg>
    </div>
  );
}
