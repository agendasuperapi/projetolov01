import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sparkles, CheckCircle, ArrowRight, RefreshCw, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const { user, refreshProfile } = useAuth();
  const sessionId = searchParams.get('session_id');
  const { toast } = useToast();
  
  const [pendingRecharge, setPendingRecharge] = useState<{id: string; credits_added: number} | null>(null);
  const [rechargeLink, setRechargeLink] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    refreshProfile();
    checkPendingRecharge();
  }, [user]);

  const checkPendingRecharge = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // Find the most recent pending_link recharge request for this user
      const { data, error } = await supabase
        .from('recharge_requests')
        .select('id, credits_added')
        .eq('user_id', user.id)
        .eq('status', 'pending_link')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        setPendingRecharge(data);
      }
    } catch (error) {
      console.error('Error checking pending recharge:', error);
    } finally {
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
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Show recharge link form if there's a pending recharge
  if (pendingRecharge && !submitted) {
    return (
      <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-card border-0">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <RefreshCw className="w-10 h-10 text-primary" />
            </div>
            <CardTitle className="text-2xl font-display">Pagamento Confirmado!</CardTitle>
            <CardDescription className="text-lg">
              Agora informe o link da conta para recarga
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="p-4 bg-secondary/50 rounded-lg text-center">
              <p className="text-sm text-muted-foreground mb-1">Créditos a adicionar</p>
              <p className="text-2xl font-bold text-primary">{pendingRecharge.credits_added.toLocaleString()} créditos</p>
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
                />
                <p className="text-xs text-muted-foreground">
                  Cole o link de acesso da sua conta para adicionar os créditos
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full gradient-primary" 
                disabled={submitting || !rechargeLink.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state (either new account purchase or recharge link submitted)
  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-card border-0 text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <CardTitle className="text-2xl font-display">
            {submitted ? 'Link Enviado!' : 'Pagamento Confirmado!'}
          </CardTitle>
          <CardDescription className="text-lg">
            {submitted 
              ? 'Sua solicitação de recarga foi enviada com sucesso'
              : 'Seus créditos foram adicionados à sua conta'
            }
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            {submitted
              ? 'Nossa equipe processará sua recarga em breve. Você receberá uma notificação quando estiver pronto.'
              : 'Obrigado pela sua compra. Agora você pode usar seus créditos para adquirir produtos digitais.'
            }
          </p>
          
          <div className="flex flex-col gap-3">
            <Link to="/dashboard">
              <Button className="w-full gradient-primary">
                <Sparkles className="w-4 h-4 mr-2" />
                Ver Meus Produtos
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">
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