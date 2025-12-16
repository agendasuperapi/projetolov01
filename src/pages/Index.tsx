import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Sparkles, Zap, Shield, Download, ArrowRight, User, Settings, Pencil, Star, LucideIcon, UserPlus, RefreshCw, Check, Tag, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/AuthModal';
import PlanCard from '@/components/PlanCard';
import HeroMockup from '@/components/HeroMockup';
import FeatureCard from '@/components/FeatureCard';
import HowItWorksSection from '@/components/HowItWorksSection';
import confetti from 'canvas-confetti';
import logoImage from '@/assets/logo.png';
const AdminEditButton = ({
  section
}: {
  section: string;
}) => <Link to={`/admin?edit=${section}`} className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
    <Button variant="outline" size="sm" className="gap-2 bg-background/80 backdrop-blur-sm">
      <Pencil className="w-3 h-3" />
      Editar
    </Button>
  </Link>;

// Icon mapping for dynamic features
const iconMap: Record<string, LucideIcon> = {
  Zap,
  Shield,
  Download,
  Star,
  Sparkles,
  Check
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
  const {
    user,
    profile,
    isAdmin,
    signOut,
    loading
  } = useAuth();
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
  const [authModalDefaultTab, setAuthModalDefaultTab] = useState<'login' | 'signup'>('login');
  const [pendingPurchase, setPendingPurchase] = useState<{
    plan: PlanWithAvailability;
    type: 'recharge' | 'new_account';
  } | null>(null);

  // Coupon states
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponData | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [couponInitialized, setCouponInitialized] = useState(false);

  // Flash animation state for plan sections
  const [flashingSection, setFlashingSection] = useState<'new_account' | 'recharge' | null>(null);
  const {
    toast
  } = useToast();
  const COUPON_STORAGE_KEY = 'creditshub_last_coupon';

  // Save coupon to localStorage only - profile is updated only after purchase via webhook
  const saveCouponToStorage = (couponData: CouponData) => {
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
    localStorage.setItem(COUPON_STORAGE_KEY, JSON.stringify({
      custom_code: couponData.custom_code,
      affiliate_id: couponData.affiliate_id,
      affiliate_coupon_id: couponData.coupon_id,
      full_data: couponData
    }));
  };

  // Load saved coupon from localStorage or profile
  const loadSavedCoupon = async () => {
    const storedCoupon = localStorage.getItem(COUPON_STORAGE_KEY);
    if (storedCoupon) {
      try {
        const parsed = JSON.parse(storedCoupon);
        if (parsed.full_data) {
          return parsed.full_data as CouponData;
        }
        if (parsed.custom_code) {
          const validated = await validateCouponCode(parsed.custom_code);
          if (validated) return validated;
        }
      } catch (e) {
        console.error('Error parsing stored coupon:', e);
      }
    }
    if (user) {
      const {
        data: profileData
      } = await supabase.from('profiles').select('last_coupon_code').eq('id', user.id).maybeSingle();
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
      const response = await fetch('https://adpnzkvzvjbervzrqhhx.supabase.co/rest/v1/rpc/validate_coupon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG56a3Z6dmpiZXJ2enJxaGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDAzODYsImV4cCI6MjA3OTA3NjM4Nn0.N7gETUDWj95yDCYdZTYWPoMJQcdx_Yjl51jxK-O1vrE'
        },
        body: JSON.stringify({
          p_coupon_code: code,
          p_product_id: '9453f6dc-5257-43d9-9b04-3bdfd5188ed1'
        })
      });
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
      const state = location.state as {
        couponData?: CouponData;
      } | null;
      if (state?.couponData) {
        setAppliedCoupon(state.couponData);
        saveCouponToStorage(state.couponData);
        setCouponInitialized(true);
        confetti({
          particleCount: 100,
          spread: 70,
          origin: {
            y: 0.6
          },
          colors: ['#10b981', '#06b6d4', '#22c55e', '#14b8a6']
        });
        toast({
          title: 'Cupom aplicado!',
          description: `${state.couponData.name} - ${state.couponData.type === 'percentage' ? `${state.couponData.value}% OFF` : `R$ ${state.couponData.value.toFixed(2)} OFF`}`
        });
        navigate('/', {
          replace: true,
          state: {}
        });
        return;
      }
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
  const fetchPlans = async () => {
    const {
      data: plansData
    } = await supabase.from('credit_plans').select('*').eq('active', true).order('credits', {
      ascending: true
    });
    if (plansData) {
      const plansWithAvailability = await Promise.all((plansData as CreditPlan[]).map(async plan => {
        const {
          data: countData
        } = await supabase.rpc('get_available_accounts_count', {
          p_plan_id: plan.id
        });
        return {
          ...plan,
          availableAccounts: countData || 0
        };
      }));
      setNewAccountPlans(plansWithAvailability.filter(p => p.plan_type === 'new_account'));
      setRechargePlans(plansWithAvailability.filter(p => p.plan_type === 'recharge'));
    }
  };
  const fetchContent = async () => {
    const {
      data
    } = await supabase.from('site_content').select('*');
    if (data) {
      data.forEach(item => {
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
      toast({
        title: 'Indisponível',
        description: 'Este plano ainda não está configurado para venda.',
        variant: 'destructive'
      });
      return;
    }
    if (!user) {
      setPendingPurchase({
        plan,
        type: 'new_account'
      });
      setIsAuthModalOpen(true);
      return;
    }
    processPurchase(plan, 'new_account');
  };
  const handleBuyRecharge = (plan: PlanWithAvailability) => {
    if (!plan.stripe_price_id || plan.price_cents === 0) {
      toast({
        title: 'Indisponível',
        description: 'Este plano ainda não está configurado para venda.',
        variant: 'destructive'
      });
      return;
    }
    if (!user) {
      setPendingPurchase({
        plan,
        type: 'recharge'
      });
      setIsAuthModalOpen(true);
      return;
    }
    processPurchase(plan, 'recharge');
  };
  const handleAuthSuccess = () => {
    setIsAuthModalOpen(false);
  };
  useEffect(() => {
    if (user && (newAccountPlans.length > 0 || rechargePlans.length > 0) && pendingPurchase) {
      const {
        plan,
        type
      } = pendingPurchase;
      setPendingPurchase(null);
      processPurchase(plan, type);
    }
  }, [user, newAccountPlans, rechargePlans, pendingPurchase]);
  const validateCoupon = async () => {
    if (!couponInput.trim()) {
      toast({
        title: 'Digite um código de cupom',
        variant: 'destructive'
      });
      return;
    }
    setCouponLoading(true);
    try {
      const data = await validateCouponCode(couponInput.trim());
      if (data) {
        setAppliedCoupon(data);
        saveCouponToStorage(data);
        setCouponInput('');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: {
            y: 0.6
          },
          colors: ['#10b981', '#06b6d4', '#22c55e', '#14b8a6']
        });
        toast({
          title: 'Cupom aplicado!',
          description: `${data.name} - ${data.type === 'percentage' ? `${data.value}% OFF` : `R$ ${data.value.toFixed(2)} OFF`}`
        });
      } else {
        toast({
          title: 'Cupom inválido ou expirado',
          variant: 'destructive'
        });
      }
    } catch {
      toast({
        title: 'Erro ao validar cupom',
        variant: 'destructive'
      });
    } finally {
      setCouponLoading(false);
    }
  };
  const removeCoupon = () => {
    setAppliedCoupon(null);
    localStorage.removeItem(COUPON_STORAGE_KEY);
    console.log('[COUPON] removeCoupon: Cleared from localStorage only, profile untouched');
    toast({
      title: 'Cupom removido'
    });
  };
  const processPurchase = async (plan: PlanWithAvailability, type: 'recharge' | 'new_account') => {
    setPurchaseLoading(plan.id);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId: plan.stripe_price_id,
          planId: plan.id,
          purchaseType: type,
          couponCode: appliedCoupon?.custom_code || appliedCoupon?.code || null
        }
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
      toast({
        title: 'Erro',
        description: errorMessage,
        variant: 'destructive'
      });
    } finally {
      setPurchaseLoading(null);
    }
  };

  // Default content fallbacks
  const hero = heroContent || {
    badge: 'Produtos digitais premium',
    title: 'Acesse produtos digitais',
    titleHighlight: 'com créditos',
    description: 'Adquira créditos em Reais com o melhor preço do mercado e tire seus projetos do papel. É simples, rápido e seguro.',
    ctaButton: 'Ver Planos',
    secondaryButton: 'Criar Conta Grátis'
  };
  const featuresData = featuresContent?.items || [{
    icon: 'Zap',
    title: 'Acesso Instantâneo',
    description: 'Download imediato após a compra. Sem espera.'
  }, {
    icon: 'Shield',
    title: 'Pagamento Seguro',
    description: 'Transações protegidas por Stripe e criptografia.'
  }, {
    icon: 'Download',
    title: 'Downloads Ilimitados',
    description: 'Baixe quantas vezes precisar, sem limites.'
  }, {
    icon: 'Star',
    title: 'Suporte Dedicado',
    description: 'Atendimento rápido para tirar todas as suas dúvidas.'
  }];
  const footer = footerContent || {
    copyright: `© ${new Date().getFullYear()} CreditsHub. Todos os direitos reservados.`
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>;
  }
  return <div className="min-h-screen bg-background lg:max-w-[80vw] lg:mx-auto">
      {/* Header - Sticky with glassmorphism */}
      <header className="sticky top-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={logoImage} alt="Mais Créditos" className="w-10 h-10 object-contain" loading="eager" decoding="async" />
            <span className="font-display font-bold text-xl">Mais Créditos</span>
          </Link>

          <nav className="flex items-center gap-3">
            {user ? <>
                <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                  <Zap className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-primary">{profile?.credits || 0} créditos</span>
                </div>
                <Link to="/dashboard">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <User className="w-4 h-4" />
                    <span className="hidden sm:inline">Minha Conta</span>
                  </Button>
                </Link>
                {isAdmin && <Link to="/admin">
                    <Button variant="outline" size="sm" className="gap-2">
                      <Settings className="w-4 h-4" />
                      <span className="hidden sm:inline">Admin</span>
                    </Button>
                  </Link>}
                <Button variant="ghost" size="sm" onClick={signOut}>
                  Sair
                </Button>
              </> : <Button className="gradient-primary shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105" onClick={() => {
            setAuthModalDefaultTab('login');
            setIsAuthModalOpen(true);
          }}>
                Entrar
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>}
          </nav>
        </div>
      </header>

      {/* Hero Section - Two columns layout */}
      <section className="relative py-8 lg:py-12 pb-20 lg:pb-24 overflow-hidden group" style={{
      background: 'linear-gradient(180deg, hsl(220, 60%, 15%) 0%, hsl(240, 50%, 30%) 25%, hsl(270, 60%, 45%) 50%, hsl(330, 70%, 55%) 75%, hsl(15, 85%, 55%) 100%)'
    }}>
        {/* Background decorations */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-white/5 rounded-full blur-3xl"></div>
        </div>
        
        {/* Shimmer light effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left column - Content */}
            <div className="text-center lg:text-left space-y-6 animate-fade-in">
              <Badge variant="secondary" className="px-4 py-2 bg-white/20 text-white border-white/30 backdrop-blur-sm">
                <Sparkles className="w-4 h-4 mr-2" />
                {hero.badge}
              </Badge>
              
              <h1 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold leading-tight text-white drop-shadow-lg uppercase">
                {hero.title}
                <span className="block text-white/90">{hero.titleHighlight}</span>
              </h1>
              
              <p className="text-lg text-white/80 max-w-lg leading-relaxed">
                {hero.description}
              </p>

              <div className="flex flex-col sm:flex-row items-center lg:items-start gap-4 pt-2">
                <a href="#plans">
                  <Button size="lg" className="bg-white text-purple-600 hover:bg-white/90 text-lg px-8 shadow-xl transition-all duration-300 hover:scale-105">
                    {hero.ctaButton}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </a>
              </div>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 pt-6">
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-white font-medium">Rápido</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-white font-medium">Seguro</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <span className="text-white font-medium">100% Digital</span>
                </div>
              </div>
            </div>

            {/* Right column - Mockup */}
            <div className="hidden lg:block animate-fade-in" style={{
            animationDelay: '0.2s'
          }}>
              <HeroMockup />
            </div>
          </div>
        </div>
        {isAdmin && <AdminEditButton section="hero" />}
        
        {/* Fade gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-48 md:h-72 bg-gradient-to-b from-transparent via-card/30 to-card pointer-events-none"></div>
        
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-12 md:h-20">
            <defs>
              <linearGradient id="waveGradient1" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="1" />
              </linearGradient>
            </defs>
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V120H0Z" fill="hsl(var(--card))" />
          </svg>
        </div>
      </section>


      {/* How It Works Section */}
      <HowItWorksSection />

      {/* Coupon Section */}
      <section className="py-12 bg-muted relative overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <div className="inline-flex items-center gap-2 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shadow-glow-sm">
                  <Tag className="w-5 h-5 text-primary" />
                </div>
              </div>
              <h2 className="font-display text-2xl md:text-3xl font-bold mb-2">
                Tem cupom de desconto?
              </h2>
              <p className="text-muted-foreground">
                Aplique seu código e economize ainda mais!
              </p>
            </div>
            
            {appliedCoupon ? <div className="glass-card shadow-glow rounded-2xl p-6 border-2 border-emerald-500/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {appliedCoupon.affiliate_avatar_url && <div className="avatar-gradient">
                        <img src={appliedCoupon.affiliate_avatar_url} alt={appliedCoupon.affiliate_name} className="w-14 h-14 object-cover" />
                      </div>}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white">
                          {appliedCoupon.type === 'percentage' ? `${appliedCoupon.value}% OFF` : `R$ ${appliedCoupon.value.toFixed(2)} OFF`}
                        </Badge>
                      </div>
                      <p className="font-bold text-lg">{appliedCoupon.custom_code}</p>
                      <p className="text-sm text-muted-foreground">por @{appliedCoupon.affiliate_username}</p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" onClick={removeCoupon} className="text-muted-foreground hover:text-destructive">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div> : <div className="flex gap-3">
                <div className="relative flex-1">
                  <Tag className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input placeholder="Digite o código do cupom" value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && validateCoupon()} className="pl-12 h-14 text-lg bg-card border-2 border-border focus:border-primary rounded-xl" />
                </div>
                <Button onClick={validateCoupon} disabled={couponLoading} size="lg" className="h-14 px-8 gradient-primary shadow-lg">
                  {couponLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Aplicar'}
                </Button>
              </div>}
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section id="plans" className="py-14 lg:py-20 pb-24 lg:pb-28 relative group overflow-hidden" style={{
      background: 'linear-gradient(180deg, hsl(230, 70%, 25%) 0%, hsl(260, 60%, 50%) 40%, hsl(330, 80%, 55%) 70%, hsl(20, 90%, 55%) 100%)'
    }}>
        {/* Shimmer light effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer-delay-2" />
        </div>
        {/* Shimmer light effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
        
        <div className="px-0 md:px-4 relative z-10">
          {/* Section header */}
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-white/20 text-white rounded-full text-sm font-medium mb-4 backdrop-blur-sm">
              Planos
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4 text-white">Pronto para finalizar seus projetos?
Escolha seu plano ideal.</h2>
            <p className="text-white/80 text-lg max-w-2xl mx-auto">
              Quanto mais créditos, maior o desconto. Escolha o melhor para você.
            </p>
          </div>

          {/* Plan type navigation */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <a href="#new-account-plans" onClick={() => {
            setFlashingSection('new_account');
            setTimeout(() => setFlashingSection(null), 6500);
          }}>
              <Button size="lg" className="gap-2 bg-white text-purple-600 font-bold hover:bg-white/90 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 px-8">
                <UserPlus className="w-5 h-5" />
                Conta Nova
              </Button>
            </a>
            <a href="#recharge-plans" onClick={() => {
            setFlashingSection('recharge');
            setTimeout(() => setFlashingSection(null), 6500);
          }}>
              <Button size="lg" className="gap-2 bg-emerald-500 text-white font-bold hover:bg-emerald-400 shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-300 px-8">
                <RefreshCw className="w-5 h-5" />
                Recarregar Conta
              </Button>
            </a>
          </div>

          {/* New Account Plans */}
          <div id="new-account-plans" className={`mb-8 rounded-2xl p-4 transition-all duration-300 ${flashingSection === 'new_account' ? 'animate-flash-border' : ''}`}>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="p-3 rounded-full bg-white/10">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-white">Conta Nova</h3>
              </div>
              <p className="text-white/80">Receba os dados de uma nova conta com créditos</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
              {newAccountPlans.filter(plan => plan.availableAccounts > 0).map(plan => <PlanCard key={plan.id} planType="new_account" planName={plan.name} credits={plan.credits} priceCents={plan.price_cents} competitorPriceCents={plan.competitor_price_cents} availableAccounts={plan.availableAccounts} isLoading={purchaseLoading === plan.id} onBuy={() => handleBuyNewAccount(plan)} couponDiscount={appliedCoupon ? {
              type: appliedCoupon.type,
              value: appliedCoupon.value,
              name: appliedCoupon.name
            } : null} />)}
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-4" />

          {/* Recharge Plans */}
          <div id="recharge-plans" className={`rounded-2xl p-4 transition-all duration-300 ${flashingSection === 'recharge' ? 'animate-flash-border' : ''}`}>
            <div className="text-center mb-10">
              <div className="inline-flex items-center gap-3 mb-3">
                <div className="p-3 rounded-full bg-white/10">
                  <RefreshCw className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-display text-2xl md:text-3xl font-bold text-white">Recarregar Conta</h3>
              </div>
              <p className="text-white/80">Adicione créditos a uma conta existente</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-3">
              {rechargePlans.map(plan => <PlanCard key={plan.id} planType="recharge" planName={plan.name} credits={plan.credits} priceCents={plan.price_cents} competitorPriceCents={plan.competitor_price_cents} isLoading={purchaseLoading === plan.id} onBuy={() => handleBuyRecharge(plan)} couponDiscount={appliedCoupon ? {
              type: appliedCoupon.type,
              value: appliedCoupon.value,
              name: appliedCoupon.name
            } : null} />)}
            </div>
          </div>
        </div>
        {isAdmin && <AdminEditButton section="plans" />}
        
        {/* Fade gradient overlay */}
        <div className="absolute bottom-0 left-0 right-0 h-48 md:h-72 bg-gradient-to-b from-transparent via-card/30 to-card pointer-events-none"></div>
        
        {/* Wave divider */}
        <div className="absolute bottom-0 left-0 right-0 w-full overflow-hidden leading-none">
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" className="w-full h-12 md:h-20">
            <defs>
              <linearGradient id="waveGradient2" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="hsl(var(--card))" stopOpacity="0.5" />
                <stop offset="100%" stopColor="hsl(var(--card))" stopOpacity="1" />
              </linearGradient>
            </defs>
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V120H0Z" fill="hsl(var(--card))" />
          </svg>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-14 lg:py-20 bg-card relative group overflow-hidden">
        {/* Shimmer light effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer-delay-3" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          {/* Section header */}
          <div className="text-center mb-14">
            <span className="inline-block px-4 py-1.5 bg-primary/10 text-primary rounded-full text-sm font-medium mb-4">
              Vantagens
            </span>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
              Por que escolher a <span className="text-gradient">Mais Créditos</span>?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Oferecemos a melhor experiência para você acessar produtos digitais
            </p>
          </div>
          
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto items-stretch">
            {featuresData.map((feature, index) => {
            const IconComponent = iconMap[feature.icon] || Zap;
            return <FeatureCard key={index} icon={IconComponent} title={feature.title} description={feature.description} index={index} />;
          })}
          </div>
        </div>
        {isAdmin && <AdminEditButton section="features" />}
      </section>

      {/* Final CTA Section */}
      <section className="py-14 bg-muted relative overflow-hidden">
        {/* Shimmer light effect */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 w-1/3 h-full bg-gradient-to-r from-transparent via-primary/10 to-transparent animate-shimmer-delay-3" />
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl font-bold mb-4">
              Pronto para começar?
            </h2>
            <p className="text-muted-foreground text-lg mb-8">
              Escolha seu plano e comece a usar seus créditos agora mesmo.
            </p>
            <a href="#plans">
              <Button size="lg" className="gradient-primary text-lg px-10 shadow-hero hover:shadow-xl transition-all duration-300 hover:scale-105">
                Ver Planos
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => {
      setIsAuthModalOpen(false);
      setPendingPurchase(null);
      setAuthModalDefaultTab('login');
    }} onSuccess={handleAuthSuccess} planId={pendingPurchase?.plan?.id} priceId={pendingPurchase?.plan?.stripe_price_id || undefined} defaultTab={authModalDefaultTab} />

      {/* Footer */}
      <footer className="bg-background border-t border-border py-12 relative group">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <img src={logoImage} alt="Mais Créditos" className="w-9 h-9 object-contain" loading="lazy" decoding="async" />
            <span className="font-display font-bold text-lg">Mais Créditos</span>
          </div>
          <p className="text-muted-foreground text-sm">
            {footer.copyright}
          </p>
        </div>
        {isAdmin && <AdminEditButton section="footer" />}
      </footer>
    </div>;
}