import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Shield, Download, ArrowRight, User, Settings, Pencil, Star, LucideIcon, UserPlus, RefreshCw, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/AuthModal';
import PlanCard from '@/components/PlanCard';
const AdminEditButton = ({ section }: { section: string }) => (
  <Link 
    to={`/admin?edit=${section}`}
    className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity"
  >
    <Button variant="outline" size="sm" className="gap-2 bg-background/80 backdrop-blur-sm">
      <Pencil className="w-3 h-3" />
      Editar
    </Button>
  </Link>
);

// Icon mapping for dynamic features
const iconMap: Record<string, LucideIcon> = {
  Zap,
  Shield,
  Download,
  Star,
  Sparkles,
  Check,
};

interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  competitor_price_cents: number | null;
  plan_type: 'new_account' | 'recharge';
}

interface PlanWithAvailability extends CreditPlan {
  availableAccounts: number;
}

interface HeroContent {
  badge: string;
  title: string;
  titleHighlight: string;
  description: string;
  ctaButton: string;
  secondaryButton: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
}

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

interface FeaturesContent {
  items: FeatureItem[];
}

interface PlansContent {
  title: string;
  subtitle: string;
  features: string[];
  competitorLabel?: string;
}

interface FooterContent {
  copyright: string;
}

export default function Index() {
  const { user, profile, isAdmin, signOut, loading } = useAuth();
  const [newAccountPlans, setNewAccountPlans] = useState<PlanWithAvailability[]>([]);
  const [rechargePlans, setRechargePlans] = useState<PlanWithAvailability[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null);
  const [featuresContent, setFeaturesContent] = useState<FeaturesContent | null>(null);
  const [plansContent, setPlansContent] = useState<PlansContent | null>(null);
  const [footerContent, setFooterContent] = useState<FooterContent | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{ plan: PlanWithAvailability; type: 'recharge' | 'new_account' } | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    fetchContent();
  }, []);

  const fetchPlans = async () => {
    const { data: plansData } = await supabase
      .from('credit_plans')
      .select('*')
      .eq('active', true)
      .order('credits', { ascending: true });
    
    if (plansData) {
      // Fetch available accounts count for each plan using the SECURITY DEFINER function
      const plansWithAvailability = await Promise.all(
        (plansData as CreditPlan[]).map(async (plan) => {
          const { data: countData } = await supabase
            .rpc('get_available_accounts_count', { p_plan_id: plan.id });
          
          return {
            ...plan,
            availableAccounts: countData || 0,
          };
        })
      );
      
      setNewAccountPlans(plansWithAvailability.filter(p => p.plan_type === 'new_account'));
      setRechargePlans(plansWithAvailability.filter(p => p.plan_type === 'recharge'));
    }
  };

  const fetchContent = async () => {
    const { data } = await supabase.from('site_content').select('*');
    if (data) {
      data.forEach((item) => {
        const content = item.content as Record<string, unknown>;
        switch (item.section_key) {
          case 'hero':
            setHeroContent(content as unknown as HeroContent);
            break;
          case 'features':
            setFeaturesContent(content as unknown as FeaturesContent);
            break;
          case 'plans':
            setPlansContent(content as unknown as PlansContent);
            break;
          case 'footer':
            setFooterContent(content as unknown as FooterContent);
            break;
        }
      });
    }
  };

  const navigate = useNavigate();

  const handleBuyNewAccount = (plan: PlanWithAvailability) => {
    if (!plan.stripe_price_id || plan.price_cents === 0) {
      toast({ title: 'Indisponível', description: 'Este plano ainda não está configurado para venda.', variant: 'destructive' });
      return;
    }

    if (!user) {
      setPendingPurchase({ plan, type: 'new_account' });
      setIsAuthModalOpen(true);
      return;
    }

    processPurchase(plan, 'new_account');
  };

  const handleBuyRecharge = (plan: PlanWithAvailability) => {
    if (!plan.stripe_price_id || plan.price_cents === 0) {
      toast({ title: 'Indisponível', description: 'Este plano ainda não está configurado para venda.', variant: 'destructive' });
      return;
    }

    if (!user) {
      setPendingPurchase({ plan, type: 'recharge' });
      setIsAuthModalOpen(true);
      return;
    }

    processPurchase(plan, 'recharge');
  };


  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
  };

  // Verificar se há compra pendente após login
  useEffect(() => {
    if (user && (newAccountPlans.length > 0 || rechargePlans.length > 0) && pendingPurchase) {
      const { plan, type } = pendingPurchase;
      setPendingPurchase(null);
      processPurchase(plan, type);
    }
  }, [user, newAccountPlans, rechargePlans, pendingPurchase]);

  const processPurchase = async (plan: PlanWithAvailability, type: 'recharge' | 'new_account') => {
    setPurchaseLoading(plan.id);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId: plan.stripe_price_id, 
          planId: plan.id,
          purchaseType: type,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao processar pagamento.';
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setPurchaseLoading(null);
    }
  };

  // Default content fallbacks
  const hero = heroContent || {
    badge: 'Produtos digitais premium',
    title: 'Acesse produtos digitais',
    titleHighlight: 'com créditos',
    description: 'Compre créditos e tenha acesso à nossa biblioteca completa de produtos digitais exclusivos. Simples, rápido e seguro.',
    ctaButton: 'Ver Planos',
    secondaryButton: 'Criar Conta Grátis',
  };

  const featuresData = featuresContent?.items || [
    { icon: 'Zap', title: 'Acesso Instantâneo', description: 'Download imediato após a compra' },
    { icon: 'Shield', title: 'Pagamento Seguro', description: 'Transações protegidas por Stripe' },
    { icon: 'Download', title: 'Downloads Ilimitados', description: 'Baixe quantas vezes precisar' },
  ];

  const plansData = plansContent || {
    title: 'Escolha seu plano',
    subtitle: 'Quanto mais créditos, mais economia',
    features: ['Acesso à biblioteca completa', 'Download instantâneo', 'Suporte prioritário', 'Atualizações incluídas'],
  };

  const footer = footerContent || {
    copyright: `© ${new Date().getFullYear()} CreditsHub. Todos os direitos reservados.`,
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">CreditsHub</span>
          </Link>

          <nav className="flex items-center gap-4">
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="font-medium">{profile?.credits || 0} créditos</span>
                </div>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm">
                    <User className="w-4 h-4 mr-2" />
                    Minha Conta
                  </Button>
                </Link>
                {isAdmin && (
                  <Link to="/admin">
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      Admin
                    </Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={signOut}>
                  Sair
                </Button>
              </>
            ) : (
              <Link to="/auth">
                <Button className="gradient-primary">
                  Entrar
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            )}
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section 
        className="py-20 lg:py-32 relative group"
        style={{
          background: hero.gradientFrom || hero.gradientTo 
            ? `linear-gradient(${
                hero.gradientDirection === 'to-t' ? '0deg' :
                hero.gradientDirection === 'to-b' ? '180deg' :
                hero.gradientDirection === 'to-l' ? '270deg' :
                hero.gradientDirection === 'to-r' ? '90deg' :
                hero.gradientDirection === 'to-tl' ? '315deg' :
                hero.gradientDirection === 'to-tr' ? '45deg' :
                hero.gradientDirection === 'to-bl' ? '225deg' :
                '135deg'
              }, ${hero.gradientFrom || '#1a1a2e'}, ${hero.gradientTo || '#0f0f1a'})`
            : undefined
        }}
      >
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-2">
            <Sparkles className="w-4 h-4 mr-2" />
            {hero.badge}
          </Badge>
          
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in">
            {hero.title}
            <span className="block text-gradient">{hero.titleHighlight}</span>
          </h1>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in" style={{ animationDelay: '0.2s' }}>
            {hero.description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <a href="#plans">
              <Button size="lg" className="gradient-primary text-lg px-8 shadow-glow">
                {hero.ctaButton}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            {!user && (
              <Link to="/auth">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  {hero.secondaryButton}
                </Button>
              </Link>
            )}
          </div>
        </div>
        {isAdmin && <AdminEditButton section="hero" />}
      </section>

      {/* Features */}
      <section className="py-20 bg-card relative group">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 place-items-center">
            {featuresData.map((feature, index) => {
              const IconComponent = iconMap[feature.icon] || Zap;
              return (
                <div 
                  key={index} 
                  className="text-center p-8 rounded-2xl bg-background shadow-card animate-fade-in"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl gradient-primary mb-6">
                    <IconComponent className="w-8 h-8 text-primary-foreground" />
                  </div>
                  <h3 className="font-display text-xl font-bold mb-3">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
        {isAdmin && <AdminEditButton section="features" />}
      </section>

      {/* Seção Conta Nova */}
      <section 
        id="plans" 
        className="py-20 relative group"
        style={{
          background: 'linear-gradient(180deg, hsl(230, 50%, 10%) 0%, hsl(230, 70%, 25%) 25%, hsl(260, 60%, 50%) 50%, hsl(330, 80%, 55%) 75%, hsl(20, 90%, 55%) 100%)'
        }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <UserPlus className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold">Conta Nova</h2>
            </div>
            <p className="text-muted-foreground text-lg">Receba os dados de uma nova conta</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {newAccountPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                planType="new_account"
                planName={plan.name}
                credits={plan.credits}
                priceCents={plan.price_cents}
                competitorPriceCents={plan.competitor_price_cents}
                availableAccounts={plan.availableAccounts}
                isLoading={purchaseLoading === plan.id}
                onBuy={() => handleBuyNewAccount(plan)}
              />
            ))}
          </div>
        </div>
        {isAdmin && <AdminEditButton section="plans" />}
      </section>

      {/* Seção Recarregar */}
      <section 
        className="py-20 relative group"
        style={{
          background: 'linear-gradient(180deg, hsl(230, 50%, 10%) 0%, hsl(230, 70%, 25%) 25%, hsl(260, 60%, 50%) 50%, hsl(330, 80%, 55%) 75%, hsl(20, 90%, 55%) 100%)'
        }}
      >
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-3 mb-4">
              <div className="p-3 rounded-full bg-primary/10">
                <RefreshCw className="w-8 h-8 text-primary" />
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-bold">Recarregar Conta</h2>
            </div>
            <p className="text-muted-foreground text-lg">Adicione créditos a uma conta existente</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 max-w-6xl mx-auto">
            {rechargePlans.map((plan) => (
              <PlanCard
                key={plan.id}
                planType="recharge"
                planName={plan.name}
                credits={plan.credits}
                priceCents={plan.price_cents}
                competitorPriceCents={plan.competitor_price_cents}
                isLoading={purchaseLoading === plan.id}
                onBuy={() => handleBuyRecharge(plan)}
              />
            ))}
          </div>
        </div>
      </section>


      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingPurchase(null);
        }}
        onSuccess={handleAuthSuccess}
      />

      {/* Footer */}
      <footer className="bg-card border-t border-border py-12 relative group">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-display font-bold">CreditsHub</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {footer.copyright}
          </p>
        </div>
        {isAdmin && <AdminEditButton section="footer" />}
      </footer>
    </div>
  );
}