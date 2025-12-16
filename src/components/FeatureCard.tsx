import { LucideIcon } from 'lucide-react';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  index?: number;
}

export default function FeatureCard({ icon: Icon, title, description, index = 0 }: FeatureCardProps) {
  return (
    <div 
      className="group relative p-6 rounded-2xl glass-card hover:shadow-glow hover:border-primary/30 transition-all duration-500 animate-slide-up h-full flex flex-col overflow-hidden"
      style={{ animationDelay: `${index * 0.1}s` }}
    >
      {/* Modern corner decoration - top */}
      <div className="absolute top-0 left-0 w-14 h-14 bg-gradient-to-br from-primary to-primary/60 opacity-20 group-hover:opacity-40 transition-opacity duration-300" style={{ clipPath: 'polygon(0 0, 100% 0, 0 100%)' }} />
      
      {/* Icon container */}
      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 group-hover:shadow-glow-sm transition-all duration-300">
        <Icon className="w-6 h-6 text-primary-foreground" />
      </div>
      
      {/* Content */}
      <h3 className="font-display font-bold text-base mb-2 text-foreground">
        {title}
      </h3>
      <p className="text-muted-foreground text-sm leading-relaxed flex-grow line-clamp-2">
        {description}
      </p>
      
      {/* Hover accent line */}
      <div className="absolute bottom-0 left-6 right-6 h-0.5 bg-gradient-to-r from-primary to-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-full"></div>
    </div>
  );
}
