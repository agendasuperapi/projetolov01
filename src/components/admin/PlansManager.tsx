import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';

interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  competitor_price_cents: number | null;
  active: boolean;
}

export default function PlansManager() {
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [competitorPrices, setCompetitorPrices] = useState<Record<string, string>>({});
  const [stripeMode, setStripeMode] = useState<'test' | 'live'>('test');
  const [loadingMode, setLoadingMode] = useState(true);
  const [savingMode, setSavingMode] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    fetchStripeMode();
  }, []);

  const fetchStripeMode = async () => {
    setLoadingMode(true);
    try {
      const { data, error } = await supabase
        .from('stripe_settings')
        .select('mode')
        .limit(1)
        .single();
      
      if (error) throw error;
      if (data) {
        setStripeMode(data.mode as 'test' | 'live');
      }
    } catch (error: any) {
      console.error('Error fetching stripe mode:', error);
    } finally {
      setLoadingMode(false);
    }
  };

  const handleModeChange = async (isLive: boolean) => {
    const newMode = isLive ? 'live' : 'test';
    setSavingMode(true);
    
    try {
      const { error } = await supabase
        .from('stripe_settings')
        .update({ mode: newMode, updated_at: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Update all rows
      
      if (error) throw error;
      
      setStripeMode(newMode);
      toast({ 
        title: 'Modo atualizado!', 
        description: `Stripe agora está em modo ${newMode === 'live' ? 'PRODUÇÃO' : 'TESTE'}.`,
        variant: newMode === 'live' ? 'default' : 'default'
      });
    } catch (error: any) {
      toast({ 
        title: 'Erro', 
        description: error.message || 'Erro ao atualizar modo.', 
        variant: 'destructive' 
      });
    } finally {
      setSavingMode(false);
    }
  };

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('credit_plans')
      .select('id, name, credits, price_cents, competitor_price_cents, active')
      .order('credits', { ascending: true });
    
    if (data) {
      setPlans(data);
      const prices: Record<string, string> = {};
      data.forEach((plan) => {
        prices[plan.id] = plan.competitor_price_cents 
          ? (plan.competitor_price_cents / 100).toFixed(2) 
          : '';
      });
      setCompetitorPrices(prices);
    }
  };

  const handleSaveCompetitorPrice = async (planId: string) => {
    const priceValue = competitorPrices[planId];
    const priceCents = priceValue ? Math.round(parseFloat(priceValue) * 100) : 0;

    try {
      const { error } = await supabase
        .from('credit_plans')
        .update({ competitor_price_cents: priceCents })
        .eq('id', planId);

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Preço do concorrente atualizado.' });
      setEditingPlan(null);
      await fetchPlans();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao atualizar.', variant: 'destructive' });
    }
  };

  const calculateDiscount = (planPrice: number, competitorPrice: number | null) => {
    if (!competitorPrice || competitorPrice <= 0 || planPrice <= 0) return 0;
    return Math.round(((competitorPrice - planPrice) / competitorPrice) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Stripe Mode Toggle Card */}
      <Card className={`shadow-card border-2 ${stripeMode === 'live' ? 'border-green-500 bg-green-500/5' : 'border-yellow-500 bg-yellow-500/5'}`}>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {stripeMode === 'live' ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-yellow-500" />
              )}
              <div>
                <CardTitle className="text-lg">Modo Stripe</CardTitle>
                <CardDescription>
                  {stripeMode === 'live' 
                    ? 'Processando pagamentos reais' 
                    : 'Modo de teste - pagamentos simulados'}
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-sm font-medium ${stripeMode === 'test' ? 'text-yellow-600' : 'text-muted-foreground'}`}>
                Teste
              </span>
              {loadingMode || savingMode ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Switch
                  checked={stripeMode === 'live'}
                  onCheckedChange={handleModeChange}
                  className="data-[state=checked]:bg-green-500"
                />
              )}
              <span className={`text-sm font-medium ${stripeMode === 'live' ? 'text-green-600' : 'text-muted-foreground'}`}>
                Produção
              </span>
            </div>
          </div>
        </CardHeader>
        {stripeMode === 'live' && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 p-3 rounded-lg">
              <CheckCircle className="w-4 h-4" />
              <span>Usando chaves de produção (STRIPE_SECRET_KEY_LIVE)</span>
            </div>
          </CardContent>
        )}
        {stripeMode === 'test' && (
          <CardContent className="pt-0">
            <div className="flex items-center gap-2 text-sm text-yellow-600 bg-yellow-500/10 p-3 rounded-lg">
              <AlertTriangle className="w-4 h-4" />
              <span>Usando chaves de teste (STRIPE_SECRET_KEY)</span>
            </div>
          </CardContent>
        )}
      </Card>

      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Gerenciar Planos</CardTitle>
          <CardDescription>Configure o preço do concorrente para cada plano para exibir o desconto na página inicial</CardDescription>
        </CardHeader>
        <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Plano</TableHead>
              <TableHead>Créditos</TableHead>
              <TableHead>Seu Preço</TableHead>
              <TableHead>Preço Concorrente</TableHead>
              <TableHead>Desconto</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((plan) => {
              const discount = calculateDiscount(plan.price_cents, plan.competitor_price_cents);
              const isEditing = editingPlan === plan.id;

              return (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">
                    {plan.name}
                    {!plan.active && (
                      <Badge variant="secondary" className="ml-2">Inativo</Badge>
                    )}
                  </TableCell>
                  <TableCell>{plan.credits.toLocaleString()}</TableCell>
                  <TableCell>
                    {plan.price_cents === 0 
                      ? 'A definir' 
                      : `R$ ${(plan.price_cents / 100).toFixed(2).replace('.', ',')}`
                    }
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">R$</span>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={competitorPrices[plan.id] || ''}
                          onChange={(e) => setCompetitorPrices({
                            ...competitorPrices,
                            [plan.id]: e.target.value
                          })}
                          className="w-24"
                          placeholder="0,00"
                        />
                      </div>
                    ) : (
                      plan.competitor_price_cents && plan.competitor_price_cents > 0
                        ? `R$ ${(plan.competitor_price_cents / 100).toFixed(2).replace('.', ',')}`
                        : <span className="text-muted-foreground">Não definido</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {discount > 0 ? (
                      <Badge className="bg-green-500 hover:bg-green-600">
                        {discount}% OFF
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <div className="flex gap-2">
                        <Button 
                          size="sm" 
                          onClick={() => handleSaveCompetitorPrice(plan.id)}
                        >
                          Salvar
                        </Button>
                        <Button 
                          size="sm" 
                          variant="outline"
                          onClick={() => setEditingPlan(null)}
                        >
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setEditingPlan(plan.id)}
                      >
                        Editar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        </CardContent>
      </Card>
    </div>
  );
}
