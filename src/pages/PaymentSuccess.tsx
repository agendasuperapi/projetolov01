import { useEffect, useState, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, CheckCircle, ArrowRight, RefreshCw, Loader2, ChevronDown, CreditCard, Calendar, Hash } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import confetti from 'canvas-confetti';

import instructionStep1 from '@/assets/instruction-step1.png';
import instructionStep2 from '@/assets/instruction-step2.png';
import instructionStep3 from '@/assets/instruction-step3.png';
import instructionStep4 from '@/assets/instruction-step4.png';

interface PurchaseDetails {
  planName: string;
  credits: number;
  amount: number;
  purchaseType: 'new_account' | 'recharge';
  date: string;
}

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const sessionId = searchParams.get('session_id');
  const previewMode = searchParams.get('preview');
  const { toast } = useToast();
  
  const [pendingRecharge, setPendingRecharge] = useState<{id: string; credits_added: number} | null>(null);
  const [rechargeLink, setRechargeLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetails | null>(null);
  const confettiTriggered = useRef(false);

  // Preview mode for development - allows viewing recharge form without actual pending request
  const isRechargePreview = previewMode === 'recharge';
  const showRechargeForm = (pendingRecharge && !submitted) || (isRechargePreview && !submitted);
  const displayCredits = pendingRecharge?.credits_added || purchaseDetails?.credits || 500;

  // Trigger confetti celebration
  const triggerConfetti = () => {
    if (confettiTriggered.current) return;
    confettiTriggered.current = true;

    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => Math.random() * (max - min) + min;

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50 * (timeLeft / duration);

      // Left side confetti
      confetti({
        particleCount: Math.floor(particleCount / 2),
        startVelocity: 30,
        spread: 60,
        origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        colors: ['#7c3aed', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899'],
      });

      // Right side confetti
      confetti({
        particleCount: Math.floor(particleCount / 2),
        startVelocity: 30,
        spread: 60,
        origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        colors: ['#7c3aed', '#22c55e', '#f59e0b', '#3b82f6', '#ec4899'],
      });
    }, 250);
  };

  useEffect(() => {
    refreshProfile();
    checkPendingRecharge();
    fetchPurchaseDetails();
  }, [user]);

  // Trigger confetti when purchase is confirmed (not loading and not showing recharge form)
  useEffect(() => {
    if (!loading && !showRechargeForm) {
      triggerConfetti();
    }
  }, [loading, showRechargeForm]);

  const fetchPurchaseDetails = async () => {
    if (!sessionId) return;

    try {
      // Try to get the payment transaction for this session
      const { data: transaction, error } = await supabase
        .from('payment_transactions')
        .select(`
          amount_cents,
          credits_added,
          created_at,
          plan_id,
          credit_plans (name, plan_type, credits)
        `)
        .eq('stripe_session_id', sessionId)
        .maybeSingle();

      if (!error && transaction) {
        const plan = transaction.credit_plans as { name: string; plan_type: string; credits: number } | null;
        setPurchaseDetails({
          planName: plan?.name || 'Plano',
          credits: transaction.credits_added,
          amount: transaction.amount_cents / 100,
          purchaseType: (plan?.plan_type as 'new_account' | 'recharge') || 'new_account',
          date: new Date(transaction.created_at || '').toLocaleDateString('pt-BR'),
        });
      }
    } catch (error) {
      console.error('Error fetching purchase details:', error);
    }
  };

  const checkPendingRecharge = async (retryCount = 0): Promise<void> => {
    if (!user || !sessionId) {
      setLoading(false);
      return;
    }

    const MAX_RETRIES = 10;
    const RETRY_DELAY = 1500; // 1.5 seconds

    try {
      // Find the recharge request linked to this specific Stripe session
      const { data, error } = await supabase
        .from('recharge_requests')
        .select('id, credits_added')
        .eq('user_id', user.id)
        .eq('stripe_session_id', sessionId)
        .eq('status', 'pending_link')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPendingRecharge(data);
        setLoading(false);
      } else if (retryCount < MAX_RETRIES) {
        // Webhook may not have processed yet, retry after delay
        console.log(`Recharge request not found, retrying (${retryCount + 1}/${MAX_RETRIES})...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
        return checkPendingRecharge(retryCount + 1);
      } else {
        // Max retries reached, stop loading
        console.log('Max retries reached, no pending recharge found');
        setLoading(false);
      }
    } catch (error) {
      console.error('Error checking pending recharge:', error);
      setLoading(false);
    }
  };

  const handleSubmitRechargeLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingRecharge || !rechargeLink.trim()) return;

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .update({ 
          recharge_link: rechargeLink.trim(),
          status: 'pending'
        })
        .eq('id', pendingRecharge.id);

      if (error) throw error;

      toast({ 
        title: 'Link enviado!', 
        description: 'Seu link de recarga foi enviado com sucesso. Processaremos em breve.' 
      });
      setSubmitted(true);
      triggerConfetti();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar link.';
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-card border-0 text-center">
          <CardContent className="pt-8 pb-8">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Processando pagamento...</h3>
            <p className="text-sm text-muted-foreground">
              Aguarde enquanto confirmamos seu pagamento
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show recharge link form if there's a pending recharge or in preview mode
  if (showRechargeForm) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-card border-0 animate-scale-fade-in">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4 animate-glow-pulse">
              <RefreshCw className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display">Pagamento Confirmado!</CardTitle>
            <CardDescription className="text-lg">
              Agora informe o link da conta para recarga
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl text-center border border-primary/20">
              <p className="text-sm text-muted-foreground mb-1">Créditos a adicionar</p>
              <p className="text-3xl font-bold text-primary">{displayCredits.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">créditos</p>
            </div>

            <form onSubmit={handleSubmitRechargeLink} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="rechargeLink">Link da sua conta</Label>
                <Input
                  id="rechargeLink"
                  type="url"
                  value={rechargeLink}
                  onChange={(e) => setRechargeLink(e.target.value)}
                  placeholder="https://..."
                  required
                  className="h-12"
                />
                <p className="text-xs text-muted-foreground">
                  Cole o link de acesso da sua conta para adicionar os créditos
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full h-12 gradient-primary text-lg font-semibold" 
                disabled={submitting || !rechargeLink.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Link'
                )}
              </Button>
            </form>

            <p className="text-xs text-muted-foreground text-center">
              Após o envio, nossa equipe processará a recarga e você receberá uma notificação.
            </p>

            {/* Visual Instructions */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center justify-center gap-2 w-full text-sm text-primary hover:text-primary/80 transition-colors py-2">
                <span>Como encontrar o link da sua conta?</span>
                <ChevronDown className="w-4 h-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 pt-4">
                <div className="space-y-4">
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={instructionStep1} alt="Passo 1: Clique no nome do projeto" className="w-full" />
                    <p className="text-xs text-muted-foreground p-3 bg-muted/50">
                      <strong>Passo 1:</strong> Clique no nome do seu projeto no canto superior esquerdo
                    </p>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={instructionStep2} alt="Passo 2: Copie o link da barra de endereços" className="w-full" />
                    <p className="text-xs text-muted-foreground p-3 bg-muted/50">
                      <strong>Passo 2:</strong> Copie o link completo da barra de endereços do navegador
                    </p>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={instructionStep3} alt="Passo 3: Cole o link no campo acima" className="w-full" />
                    <p className="text-xs text-muted-foreground p-3 bg-muted/50">
                      <strong>Passo 3:</strong> Cole o link no campo acima e clique em "Enviar Link"
                    </p>
                  </div>
                  <div className="rounded-lg overflow-hidden border border-border">
                    <img src={instructionStep4} alt="Passo 4: Confirmação" className="w-full" />
                    <p className="text-xs text-muted-foreground p-3 bg-muted/50">
                      <strong>Passo 4:</strong> Aguarde a confirmação do processamento
                    </p>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state (either new account purchase or recharge link submitted)
  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-card border-0 text-center animate-scale-fade-in overflow-hidden">
        <div className="h-2 w-full bg-gradient-to-r from-primary via-accent to-primary" />
        <CardHeader className="pb-4 pt-8">
          <div className="mx-auto w-24 h-24 rounded-full bg-success/10 flex items-center justify-center mb-4 animate-glow-pulse relative">
            <CheckCircle className="w-12 h-12 text-success" />
            <div className="absolute inset-0 rounded-full border-4 border-success/30 animate-ping" />
          </div>
          <CardTitle className="text-3xl font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {submitted ? 'Link Enviado!' : 'Compra Realizada!'}
          </CardTitle>
          <CardDescription className="text-lg mt-2">
            {submitted 
              ? 'Sua solicitação de recarga foi enviada com sucesso'
              : 'Seus créditos foram adicionados à sua conta'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 pb-8">
          {/* Purchase Details Card */}
          {purchaseDetails && !submitted && (
            <div className="bg-gradient-to-br from-card to-secondary/30 rounded-xl p-5 space-y-4 border border-border/50 text-left">
              <h4 className="font-semibold text-center text-lg mb-4">Detalhes da Compra</h4>
              
              <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs text-muted-foreground">Plano</p>
                  <p className="font-semibold">{purchaseDetails.planName}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                    <Hash className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Créditos</p>
                    <p className="font-bold text-success">{purchaseDetails.credits.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Valor</p>
                    <p className="font-bold">R$ {purchaseDetails.amount.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="font-medium">{purchaseDetails.date}</p>
                </div>
              </div>
            </div>
          )}

          {/* Simple message if no purchase details */}
          {!purchaseDetails && !submitted && (
            <div className="p-6 bg-gradient-to-r from-primary/10 to-accent/10 rounded-xl text-center border border-primary/20">
              <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
              <p className="text-muted-foreground">
                Obrigado pela sua compra! Seus créditos já estão disponíveis.
              </p>
            </div>
          )}

          {submitted && (
            <div className="p-6 bg-gradient-to-r from-success/10 to-accent/10 rounded-xl text-center border border-success/20">
              <RefreshCw className="w-8 h-8 text-success mx-auto mb-2" />
              <p className="text-muted-foreground">
                Nossa equipe processará sua recarga em breve. Você receberá uma notificação quando estiver pronto.
              </p>
            </div>
          )}
          
          <div className="flex flex-col gap-3 pt-2">
            <Link to="/dashboard">
              <Button className="w-full h-12 gradient-primary text-lg font-semibold shadow-glow hover:shadow-glow-sm transition-shadow">
                <Sparkles className="w-5 h-5 mr-2" />
                Ver Meus Produtos
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full h-11">
                Voltar à Página Inicial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
