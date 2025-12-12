import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, Zap, Shield, Download, ArrowRight, User, Settings, Pencil, Star, LucideIcon, UserPlus, RefreshCw, Check, Tag, X, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/AuthModal';
import PlanCard from '@/components/PlanCard';
import WaveDivider from '@/components/WaveDivider';
import confetti from 'canvas-confetti';

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

interface CouponData {
  coupon_id: string;
  code: string;
  name: string;
  description: string;
  type: 'percentage' | 'fixed';
  value: number;
  is_active: boolean;
  product_id: string;
  affiliate_id: string;
  affiliate_name: string;
  affiliate_username: string;
  affiliate_avatar_url: string;
  custom_code: string;
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
  const location = useLocation();
  const navigate = useNavigate();
  const [newAccountPlans, setNewAccountPlans] = useState<PlanWithAvailability[]>([]);
  const [rechargePlans, setRechargePlans] = useState<PlanWithAvailability[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null);
  const [featuresContent, setFeaturesContent] = useState<FeaturesContent | null>(null);
  const [plansContent, setPlansContent] = useState<PlansContent | null>(null);
  const [footerContent, setFooterContent] = useState<FooterContent | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState<{ plan: PlanWithAvailability; type: 'recharge' | 'new_account' } | null>(null);
  
  // Coupon states
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponInitialized, setCouponInitialized] = useState(false);
  
  const { toast } = useToast();

  const COUPON_STORAGE_KEY = 'creditshub_last_coupon';

  // Save coupon to localStorage only - profile is updated only after purchase via webhook
  const saveCouponToStorage = (couponData: CouponData) => {
    // Only save if we have valid coupon data
    const hasValidData = couponData.custom_code || couponData.affiliate_id || couponData.coupon_id;
    
    if (!hasValidData) {
      console.log('[COUPON] saveCouponToStorage: No valid data to save, skipping');
      return;
    }

    console.log('[COUPON] saveCouponToStorage: Saving to localStorage only', {
      custom_code: couponData.custom_code,
      affiliate_id: couponData.affiliate_id,
      coupon_id: couponData.coupon_id
    });

    // Save to localStorage only - profile will be updated after purchase via webhook
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify({
      custom_code: couponData.custom_code,
      affiliate_id: couponData.affiliate_id,
      affiliate_coupon_id: couponData.coupon_id,
      full_data: couponData
    }));
  };

  // Load saved coupon from localStorage or profile
  const loadSavedCoupon = async () => {
    // First check localStorage
    const storedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
    if (storedCoupon) {
      try {
        const parsed = JSON.parse(storedCoupon);
        if (parsed.full_data) {
          return parsed.full_data as CouponData;
        }
        // If we only have the code, validate it
        if (parsed.custom_code) {
          const validated = await validateCouponCode(parsed.custom_code);
          if (validated) return validated;
        }
      } catch (e) {
        console.error('Error parsing stored coupon:', e);
      }
    }

    // If user is logged in, check profile
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('last_coupon_code')
        .eq('id', user.id)
        .maybeSingle();

      if (profileData?.last_coupon_code) {
        const validated = await validateCouponCode(profileData.last_coupon_code);
        if (validated) return validated;
      }
    }

    return null;
  };

  // Validate coupon code and return data
  const validateCouponCode = async (code: string): Promise<CouponData | null> => {
    try {
      const response = await fetch(
        'https://adpnzkvzvjbervzrqhhx.supabase.co/rest/v1/rpc/validate_coupon',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG56a3Z6dmpiZXJ2enJxaGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDAzODYsImV4cCI6MjA3OTA3NjM4Nn0.N7gETUDWj95yDCYdZTYWPoMJQcdx_Yjl51jxK-O1vrE',
          },
          body: JSON.stringify({ 
            p_coupon_code: code,
            p_product_id: '9453f6dc-5257-43d9-9b04-3bdfd5188ed1'
          }),
        }
      );
      const responseData = await response.json();
      const data: CouponData | null = Array.isArray(responseData) ? responseData[0] : responseData;
      
      if (data && data.coupon_id && data.is_active) {
        return data;
      }
    } catch (e) {
      console.error('Error validating coupon:', e);
    }
    return null;
  };

  useEffect(() => {
    fetchPlans();
    fetchContent();
  }, []);

  // Initialize coupon: URL priority > saved coupon
  useEffect(() => {
    const initializeCoupon = async () => {
      if (couponInitialized) return;
      
      const state = location.state as { couponData?: CouponData } | null;
      
      // URL coupon has priority
      if (state?.couponData) {
        setAppliedCoupon(state.couponData);
        saveCouponToStorage(state.couponData);
        setCouponInitialized(true);
        
        // Trigger confetti animation
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#06b6d4', '#22c55e', '#14b8a6']
        });
        
        toast({ 
          title: 'Cupom aplicado!', 
          description: `${state.couponData.name} - ${state.couponData.type === 'percentage' ? `${state.couponData.value}% OFF` : `R$ ${state.couponData.value.toFixed(2)} OFF`}` 
        });
        
        // Clear the state to prevent re-applying on refresh
        navigate('/', { replace: true, state: {} });
        return;
      }

      // No URL coupon, try to load saved coupon
      const savedCoupon = await loadSavedCoupon();
      if (savedCoupon) {
        setAppliedCoupon(savedCoupon);
        toast({ 
          title: 'Cupom restaurado', 
          description: `${savedCoupon.name} foi aplicado automaticamente` 
        });
      }
      setCouponInitialized(true);
    };

    initializeCoupon();
  }, [location.state, couponInitialized]);

  // NOTE: Coupon is NO LONGER synced to profile on login
  // Profile coupon fields are only updated after a successful purchase via webhook

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

  const validateCoupon = async () => {
    if (!couponInput.trim()) {
      toast({ title: 'Digite um código de cupom', variant: 'destructive' });
      return;
    }

    setCouponLoading(true);
    try {
      const data = await validateCouponCode(couponInput.trim());

      if (data) {
        setAppliedCoupon(data);
        saveCouponToStorage(data);
        setCouponInput('');
        
        // Trigger confetti animation
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#10b981', '#06b6d4', '#22c55e', '#14b8a6']
        });
        
        toast({ 
          title: 'Cupom aplicado!', 
          description: `${data.name} - ${data.type === 'percentage' ? `${data.value}% OFF` : `R$ ${(data.value).toFixed(2)} OFF`}` 
        });
      } else {
        toast({ title: 'Cupom inválido ou expirado', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Erro ao validar cupom', variant: 'destructive' });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    // Clear from localStorage only - profile is NOT updated here
    // Profile coupon fields are only managed after purchases via webhook
    localStorage.removeItem(COUPON_STORAGE_KEY);
    console.log('[COUPON] removeCoupon: Cleared from localStorage only, profile untouched');
    toast({ title: 'Cupom removido' });
  };

  const processPurchase = async (plan: PlanWithAvailability, type: 'recharge' | 'new_account') => {
    setPurchaseLoading(plan.id);

    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { 
          priceId: plan.stripe_price_id, 
          planId: plan.id,
          purchaseType: type,
          couponCode: appliedCoupon?.custom_code || appliedCoupon?.code || null,
        },
      });

      if (error) throw error;
      if (data?.url) {
        const isDevelopment = window.location.hostname.includes('lovableproject.com') || window.location.hostname.includes('lovable.dev') || window.location.hostname === 'localhost';
        if (isDevelopment) {
          window.open(data.url, '_blank');
        } else {
          window.location.href = data.url;
        }
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
          background: 'linear-gradient(180deg, hsl(220, 60%, 15%) 0%, hsl(240, 50%, 30%) 25%, hsl(270, 60%, 45%) 50%, hsl(330, 70%, 55%) 75%, hsl(15, 85%, 55%) 100%)'
        }}
      >
        <div className="container mx-auto px-4 text-center">
          <Badge variant="secondary" className="mb-6 px-4 py-2 bg-white/20 text-white border-white/30 backdrop-blur-sm animate-fade-in">
            <Sparkles className="w-4 h-4 mr-2" />
            {hero.badge}
          </Badge>
          
          <h1 className="font-display text-4xl md:text-6xl lg:text-7xl font-bold mb-6 animate-fade-in text-white drop-shadow-lg">
            {hero.title}
            <span className="block text-white/90 drop-shadow-md">{hero.titleHighlight}</span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto mb-10 animate-fade-in drop-shadow-sm" style={{ animationDelay: '0.2s' }}>
            {hero.description}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <a href="#plans">
              <Button size="lg" className="bg-white text-purple-600 hover:bg-white/90 text-lg px-8 shadow-xl transition-all duration-300 hover:scale-105">
                {hero.ctaButton}
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
            {!user && (
              <Link to="/auth">
                <Button size="lg" variant="outline" className="text-lg px-8 bg-white/10 text-white border-white/30 hover:bg-white/20 backdrop-blur-sm transition-all duration-300 hover:scale-105">
                  {hero.secondaryButton}
                </Button>
              </Link>
            )}
          </div>
        </div>
        {isAdmin && <AdminEditButton section="hero" />}
        <WaveDivider 
          topColor="transparent" 
          bottomColor="hsl(var(--card))" 
          intensity="high"
        />
      </section>

      {/* Features */}
      <section className="py-20 bg-card relative group transition-all duration-500" style={{ marginTop: '-1px' }}>
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
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

      {/* Seção Cupom */}
      <section className="py-12 bg-gradient-to-b from-card to-primary/20 relative">
        <div className="container mx-auto px-4">
          <div className="text-center mb-6">
            <div className="inline-flex items-center gap-2 mb-2">
              <Tag className="w-6 h-6 text-primary" />
              <h2 className="font-display text-2xl font-bold">Tem cupom de desconto?</h2>
            </div>
            <p className="text-muted-foreground">Aplique seu código e economize ainda mais!</p>
          </div>
          
          <div className="max-w-lg mx-auto">
            {appliedCoupon ? (
              <div className="bg-primary/10 rounded-2xl p-6 border-2 border-primary/30 shadow-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {appliedCoupon.affiliate_avatar_url && (
                      <img 
                        src={appliedCoupon.affiliate_avatar_url} 
                        alt={appliedCoupon.affiliate_name}
                        className="w-16 h-16 rounded-full border-2 border-primary/50"
                      />
                    )}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500 text-white">
                          {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% OFF` : `R$ ${appliedCoupon.value.toFixed(2)} OFF`}
                        </Badge>
                      </div>
                      <p className="font-bold text-lg">{appliedCoupon.custom_code}</p>
                      <p className="text-sm text-muted-foreground">por @{appliedCoupon.affiliate_username}</p>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={removeCoupon}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    placeholder="Digite o código do cupom"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && validateCoupon()}
                    className="pl-12 h-14 text-lg bg-background border-2 border-border focus:border-primary"
                  />
                </div>
                <Button 
                  onClick={validateCoupon}
                  disabled={couponLoading}
                  size="lg"
                  className="h-14 px-8"
                >
                  {couponLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Aplicar'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Seção Planos */}
      <section 
        id="plans" 
        className="py-20 relative group"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--primary) / 0.2) 0%, hsl(230, 70%, 25%) 15%, hsl(260, 60%, 50%) 50%, hsl(330, 80%, 55%) 75%, hsl(20, 90%, 55%) 100%)'
        }}
      >
        <div className="container mx-auto px-4">
          {/* Botões de navegação */}
          <div className="flex justify-center gap-4 mb-12">
            <a href="#new-account-plans">
              <Button size="lg" className="gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20">
                <UserPlus className="w-5 h-5" />
                Conta Nova
              </Button>
            </a>
            <a href="#recharge-plans">
              <Button size="lg" className="gap-2 bg-white/10 hover:bg-white/20 text-white border border-white/20">
                <RefreshCw className="w-5 h-5" />
                Recarregar Conta
              </Button>
            </a>
          </div>

          {/* Conta Nova */}
          <div id="new-account-plans" className="mb-16">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-white/10">
                  <UserPlus className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white">Conta Nova</h2>
              </div>
              <p className="text-white/80 text-lg">Receba os dados de uma nova conta</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 max-w-6xl mx-auto">
              {newAccountPlans.filter(plan => plan.availableAccounts > 0).map((plan) => (
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
                  couponDiscount={appliedCoupon ? { type: appliedCoupon.type, value: appliedCoupon.value, name: appliedCoupon.name } : null}
                />
              ))}
            </div>
          </div>

          {/* Separador visual */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-8" />

          {/* Recarregar Conta */}
          <div id="recharge-plans">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-3 mb-4">
                <div className="p-3 rounded-full bg-white/10">
                  <RefreshCw className="w-8 h-8 text-white" />
                </div>
                <h2 className="font-display text-3xl md:text-4xl font-bold text-white">Recarregar Conta</h2>
              </div>
              <p className="text-white/80 text-lg">Adicione créditos a uma conta existente</p>
            </div>

            <div className="flex flex-wrap justify-center gap-4 max-w-6xl mx-auto">
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
                  couponDiscount={appliedCoupon ? { type: appliedCoupon.type, value: appliedCoupon.value, name: appliedCoupon.name } : null}
                />
              ))}
            </div>
          </div>
        </div>
        {isAdmin && <AdminEditButton section="plans" />}
        <WaveDivider 
          topColor="transparent" 
          bottomColor="hsl(var(--card))" 
          intensity="high"
        />
      </section>


      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => {
          setIsAuthModalOpen(false);
          setPendingPurchase(null);
        }}
        onSuccess={handleAuthSuccess}
        planId={pendingPurchase?.plan?.id}
        priceId={pendingPurchase?.plan?.stripe_price_id || undefined}
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