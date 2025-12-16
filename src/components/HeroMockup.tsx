import { Zap, CreditCard, Shield, Star } from 'lucide-react';
import logoImage from '@/assets/logo.png';
export default function HeroMockup() {
  return <div className="relative w-full max-w-xs mx-auto scale-90">
      {/* Phone mockup */}
      <div className="relative z-10">
        <div className="bg-gradient-to-br from-card to-background rounded-[2.5rem] p-3 shadow-2xl border border-border/50">
          <div className="bg-card rounded-[2rem] overflow-hidden aspect-[9/16] relative">
            {/* Phone screen content */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 p-6 flex flex-col">
              {/* Status bar mockup */}
              <div className="flex justify-between items-center mb-8">
                <span className="text-xs text-muted-foreground">9:41</span>
                <div className="flex gap-1">
                  <div className="w-4 h-2 bg-foreground/30 rounded-sm"></div>
                  <div className="w-2 h-2 bg-foreground/30 rounded-full"></div>
                </div>
              </div>
              
              {/* App content */}
              <div className="flex-1 flex flex-col gap-4">
                <div className="text-center mb-4">
                  <div className="w-12 h-12 mx-auto rounded-xl flex items-center justify-center mb-2">
                    <img src={logoImage} alt="Mais Créditos" className="w-12 h-12 object-contain" />
                  </div>
                  <h3 className="font-display font-bold text-lg">Mais Créditos </h3>
                </div>
                
                {/* Credit cards mockup */}
                <div className="space-y-3">
                  <div className="bg-gradient-to-r from-emerald-500 to-cyan-500 rounded-xl p-4 text-white">
                    <div className="flex justify-between items-start mb-6">
                      <span className="text-xs opacity-80">Saldo disponível</span>
                      <CreditCard className="w-5 h-5 opacity-80" />
                    </div>
                    <span className="text-2xl font-bold">250 créditos</span>
                  </div>
                  
                  <div className="bg-card border border-border rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Star className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">Plano Premium</p>
                        <p className="text-xs text-muted-foreground">500 créditos</p>
                      </div>
                      <span className="text-emerald-500 font-bold text-sm">R$ 49,90</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Phone notch */}
        <div className="absolute top-5 left-1/2 -translate-x-1/2 w-24 h-6 bg-foreground/90 rounded-full"></div>
      </div>
      
      {/* Floating cards */}
      <div className="absolute -left-8 top-20 glass-card shadow-glow-sm rounded-xl p-3 border border-border animate-float z-20 hover:scale-105 transition-transform duration-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <p className="font-bold text-sm">+250</p>
            <p className="text-xs text-muted-foreground">Créditos</p>
          </div>
        </div>
      </div>
      
      <div className="absolute -right-8 top-40 glass-card shadow-glow-sm rounded-xl p-3 border border-border animate-float-delayed z-20 hover:scale-105 transition-transform duration-300">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="font-bold text-sm">Seguro</p>
            <p className="text-xs text-muted-foreground">100%</p>
          </div>
        </div>
      </div>
      
      <div className="absolute -left-4 bottom-32 glass-card shadow-glow-sm rounded-xl p-3 border border-border animate-float z-20 hover:scale-105 transition-transform duration-300" style={{
      animationDelay: '0.5s'
    }}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Star className="w-4 h-4 text-amber-500" />
          </div>
          <div>
            <p className="font-bold text-sm">Conta Nova</p>
            <p className="text-xs text-muted-foreground">Imediata</p>
          </div>
        </div>
      </div>
      
      {/* Glow effects */}
      <div className="absolute top-1/4 -left-20 w-40 h-40 bg-primary/20 rounded-full blur-3xl"></div>
      <div className="absolute bottom-1/4 -right-20 w-40 h-40 bg-accent/20 rounded-full blur-3xl"></div>
    </div>;
}