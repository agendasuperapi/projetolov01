import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

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
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

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
  );
}
