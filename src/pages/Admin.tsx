import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Plus, ArrowLeft, Users, DollarSign, Trash2, FileText, RefreshCw, Package, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import ContentEditor from '@/components/admin/ContentEditor';
import AccountsManager from '@/components/admin/AccountsManager';
import RechargeManager from '@/components/admin/RechargeManager';
interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  competitor_price_cents: number | null;
  active: boolean;
}

interface Transaction {
  id: string;
  user_id: string;
  credits_added: number;
  amount_cents: number;
  status: string;
  created_at: string;
  profiles?: { name: string; email: string } | null;
}

export default function Admin() {
  const { user, isAdmin, loading } = useAuth();
  const [searchParams] = useSearchParams();
  const editSection = searchParams.get('edit');
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newPlan, setNewPlan] = useState({ name: '', credits: 0, price_cents: 0, stripe_price_id: '' });
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPlans();
      fetchTransactions();
    }
  }, [isAdmin]);

  const fetchPlans = async () => {
    const { data } = await supabase.from('credit_plans').select('*').order('credits', { ascending: true });
    if (data) setPlans(data);
  };

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    if (data) {
      const userIds = [...new Set(data.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);
      
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const txWithProfiles = data.map(tx => ({
        ...tx,
        profiles: profileMap.get(tx.user_id) || null,
      }));
      
      setTransactions(txWithProfiles as Transaction[]);
    }
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { error } = await supabase.from('credit_plans').insert({
        name: newPlan.name,
        credits: newPlan.credits,
        price_cents: newPlan.price_cents,
        stripe_price_id: newPlan.stripe_price_id || null,
        active: true,
      });

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Plano criado com sucesso.' });
      setNewPlan({ name: '', credits: 0, price_cents: 0, stripe_price_id: '' });
      setIsDialogOpen(false);
      await fetchPlans();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao criar plano.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleUpdatePlan = async (planId: string, updates: Partial<CreditPlan>) => {
    try {
      const { error } = await supabase
        .from('credit_plans')
        .update(updates)
        .eq('id', planId);

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Plano atualizado.' });
      await fetchPlans();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm('Tem certeza que deseja excluir este plano?')) return;

    try {
      const { error } = await supabase.from('credit_plans').delete().eq('id', planId);
      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Plano excluído.' });
      await fetchPlans();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir plano.', variant: 'destructive' });
    }
  };

  const handleSyncStripe = async () => {
    setSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { data, error } = await supabase.functions.invoke('sync-stripe-products', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({ 
        title: 'Sincronização concluída!', 
        description: data.message || 'Produtos sincronizados com sucesso.' 
      });
      await fetchPlans();
    } catch (error: any) {
      toast({ 
        title: 'Erro na sincronização', 
        description: error.message || 'Erro ao sincronizar com Stripe.', 
        variant: 'destructive' 
      });
    } finally {
      setSyncing(false);
    }
  };

  if (loading || !isAdmin) {
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
            <Badge variant="outline">Admin</Badge>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-display text-3xl font-bold mb-2">Painel Admin</h1>
            <p className="text-muted-foreground">Gerencie planos e transações</p>
          </div>
        </div>

        <Tabs defaultValue={editSection ? 'content' : 'plans'} className="space-y-8">
          <TabsList className="grid w-full max-w-3xl grid-cols-5">
            <TabsTrigger value="plans" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="accounts" className="gap-2">
              <Package className="w-4 h-4" />
              Contas
            </TabsTrigger>
            <TabsTrigger value="recharges" className="gap-2">
              <Zap className="w-4 h-4" />
              Recargas
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <Users className="w-4 h-4" />
              Transações
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <FileText className="w-4 h-4" />
              Conteúdo
            </TabsTrigger>
          </TabsList>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <div className="flex justify-end gap-2">
              <Button 
                variant="outline" 
                onClick={handleSyncStripe} 
                disabled={syncing}
                className="gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizando...' : 'Sincronizar Stripe'}
              </Button>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Plano
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Plano de Créditos</DialogTitle>
                    <DialogDescription>
                      Adicione um novo plano de créditos
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreatePlan} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Plano</Label>
                      <Input
                        id="name"
                        value={newPlan.name}
                        onChange={(e) => setNewPlan({ ...newPlan, name: e.target.value })}
                        placeholder="Ex: Plano Básico"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="credits">Quantidade de Créditos</Label>
                      <Input
                        id="credits"
                        type="number"
                        min="1"
                        value={newPlan.credits}
                        onChange={(e) => setNewPlan({ ...newPlan, credits: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço (R$)</Label>
                      <Input
                        id="price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={(newPlan.price_cents / 100).toFixed(2)}
                        onChange={(e) => setNewPlan({ ...newPlan, price_cents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                        placeholder="Ex: 100.00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stripe_price_id">Stripe Price ID</Label>
                      <Input
                        id="stripe_price_id"
                        value={newPlan.stripe_price_id}
                        onChange={(e) => setNewPlan({ ...newPlan, stripe_price_id: e.target.value })}
                        placeholder="price_..."
                      />
                    </div>
                    <Button type="submit" className="w-full gradient-primary" disabled={creating}>
                      {creating ? 'Criando...' : 'Criar Plano'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Planos de Créditos</CardTitle>
                <CardDescription>Configure os preços e IDs do Stripe para cada plano</CardDescription>
              </CardHeader>
              <CardContent>
                {plans.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum plano cadastrado.</p>
                ) : (
                  <div className="space-y-6">
                    {plans.map((plan) => (
                      <div key={plan.id} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{plan.name}</h3>
                            <p className="text-sm text-muted-foreground">{plan.credits.toLocaleString()} créditos</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={plan.stripe_price_id ? 'default' : 'secondary'}>
                              {plan.stripe_price_id ? 'Configurado' : 'Pendente'}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeletePlan(plan.id)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="grid sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label>Preço (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              defaultValue={(plan.price_cents / 100).toFixed(2)}
                              onBlur={(e) => {
                                const valueInCents = Math.round(parseFloat(e.target.value || '0') * 100);
                                if (valueInCents !== plan.price_cents) {
                                  handleUpdatePlan(plan.id, { price_cents: valueInCents });
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Preço Concorrente (R$)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              defaultValue={(plan.competitor_price_cents ? plan.competitor_price_cents / 100 : 0).toFixed(2)}
                              onBlur={(e) => {
                                const valueInCents = Math.round(parseFloat(e.target.value || '0') * 100);
                                if (valueInCents !== (plan.competitor_price_cents || 0)) {
                                  handleUpdatePlan(plan.id, { competitor_price_cents: valueInCents });
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Stripe Price ID</Label>
                            <Input
                              placeholder="price_..."
                              defaultValue={plan.stripe_price_id || ''}
                              onBlur={(e) => {
                                const value = e.target.value;
                                if (value !== plan.stripe_price_id) {
                                  handleUpdatePlan(plan.id, { stripe_price_id: value || null });
                                }
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <AccountsManager />
          </TabsContent>

          {/* Recharges Tab */}
          <TabsContent value="recharges" className="space-y-6">
            <RechargeManager />
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Transações Recentes</CardTitle>
                <CardDescription>Histórico de pagamentos e créditos adicionados</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma transação registrada.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead>Valor</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{tx.profiles?.name || 'Usuário'}</p>
                              <p className="text-sm text-muted-foreground">{tx.profiles?.email}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{tx.credits_added}</Badge>
                          </TableCell>
                          <TableCell>
                            R$ {(tx.amount_cents / 100).toFixed(2).replace('.', ',')}
                          </TableCell>
                          <TableCell>
                            <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                              {tx.status === 'completed' ? 'Concluído' : tx.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Editor Tab */}
          <TabsContent value="content" className="space-y-6">
            <ContentEditor />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}