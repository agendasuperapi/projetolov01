import { UserPlus, CreditCard, Download, ArrowRight } from 'lucide-react';
const steps = [{
  number: '01',
  icon: UserPlus,
  title: 'Crie sua conta na Mais Créditos',
  description: 'Cadastre-se gratuitamente em poucos segundos. Basta informar seu e-mail e criar uma senha segura.',
  color: 'from-primary to-primary/80'
}, {
  number: '02',
  icon: CreditCard,
  title: 'Escolha seu plano',
  description: 'Garanta créditos para seus projetos com descontos progressivos: quanto mais créditos você comprar, menos você paga.',
  color: 'from-emerald-500 to-cyan-500'
}, {
  number: '03',
  icon: Download,
  title: 'Acesse seus créditos',
  description: 'Após o pagamento, seus créditos são liberados. Use quando e como quiser.',
  color: 'from-amber-500 to-orange-500'
}];
export default function HowItWorksSection() {
  return <section className="py-10 lg:py-14 bg-card relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-accent/5 rounded-full blur-3xl"></div>
      </div>
      
      <div className="container mx-auto px-4 relative z-10">
        {/* Section header */}
        <div className="text-center mb-10">
          <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-3">
            Simples e rápido
          </span>
          <h2 className="font-display text-2xl md:text-3xl lg:text-4xl font-bold mb-2">
            Como <span className="text-gradient">funciona</span>
          </h2>
          <p className="text-muted-foreground text-base max-w-2xl mx-auto">Em apenas 3 passos você já está pronto para usar seus créditos .
Ative seus projetos agora de forma rápida e segura.</p>
        </div>
        
        {/* Steps */}
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {steps.map((step, index) => <div key={step.number} className="relative group animate-fade-in" style={{
            animationDelay: `${index * 0.15}s`
          }}>
                {/* Step card */}
                <div className="bg-card rounded-2xl p-6 lg:p-8 border border-border/50 shadow-sm hover:shadow-lg transition-all duration-300 h-full">
                  {/* Step number */}
                  <span className="inline-block text-5xl lg:text-6xl font-display font-bold text-muted-foreground/20 mb-4 group-hover:text-primary/30 transition-colors duration-300">
                    {step.number}
                  </span>
                  
                  {/* Icon */}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <step.icon className="w-7 h-7 text-white" />
                  </div>
                  
                  {/* Content */}
                  <h3 className="font-display font-bold text-xl mb-3">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {step.description}
                  </p>
                </div>
                
                {/* Connector arrow (not on last item) */}
                {index < steps.length - 1 && <div className="hidden md:flex absolute top-1/2 -right-6 lg:-right-8 transform -translate-y-1/2 z-10">
                    <ArrowRight className="w-6 h-6 text-muted-foreground/30" />
                  </div>}
              </div>)}
          </div>
        </div>
      </div>
    </section>;
}