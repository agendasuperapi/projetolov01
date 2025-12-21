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
import { Sparkles, Plus, ArrowLeft, Users, DollarSign, Trash2, FileText, RefreshCw, Package, Zap, Activity, UserCheck, CheckCircle, AlertCircle, Clock, HeadphonesIcon, AlertTriangle, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import ContentEditor from '@/components/admin/ContentEditor';
import AccountsManager from '@/components/admin/AccountsManager';
import RechargeManager from '@/components/admin/RechargeManager';
import StripeEventsManager from '@/components/admin/StripeEventsManager';
import UsersManager from '@/components/admin/UsersManager';
import SupportManager from '@/components/admin/SupportManager';
interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
  stripe_price_id_test: string | null;
  stripe_price_id_live: string | null;
  competitor_price_cents: number | null;
  active: boolean;
  plan_type: 'new_account' | 'recharge';
  sync_status: string | null;
  sync_response: string | null;
  synced_at: string | null;
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
  const [newPlan, setNewPlan] = useState({ name: '', credits: 0, price_cents: 0, stripe_price_id: '', plan_type: 'new_account' as 'new_account' | 'recharge' });
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingPlanId, setSyncingPlanId] = useState<string | null>(null);
  const [pendingRechargesCount, setPendingRechargesCount] = useState(0);
  const [syncIssuesCount, setSyncIssuesCount] = useState(0);
  const [activeTab, setActiveTab] = useState(editSection ? 'content' : 'accounts');
  const [stripeMode, setStripeMode] = useState<'test' | 'live'>('test');
  const [loadingStripeMode, setLoadingStripeMode] = useState(true);
  const [savingStripeMode, setSavingStripeMode] = useState(false);
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
      fetchPendingRechargesCount();
      fetchSyncIssuesCount();
      fetchStripeMode();

      // Real-time subscription para atualizar badge de recargas
      const rechargeChannel = supabase
        .channel('admin-recharge-badge')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'recharge_requests'
          },
          () => {
            fetchPendingRechargesCount();
          }
        )
        .subscribe();

      // Real-time subscription para atualizar transações
      const transactionsChannel = supabase
        .channel('admin-transactions')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'payment_transactions'
          },
          () => {
            fetchTransactions();
          }
        )
        .subscribe();

      // Real-time subscription para sync issues
      const syncChannel = supabase
        .channel('admin-sync-issues')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'stripe_events'
          },
          () => {
            fetchSyncIssuesCount();
          }
        )
        .subscribe();

      // Real-time subscription para stripe_settings (modo)
      const settingsChannel = supabase
        .channel('admin-stripe-settings')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'stripe_settings'
          },
          () => {
            fetchStripeMode();
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(rechargeChannel);
        supabase.removeChannel(transactionsChannel);
        supabase.removeChannel(syncChannel);
        supabase.removeChannel(settingsChannel);
      };
    }
  }, [isAdmin]);

  const fetchStripeMode = async () => {
    setLoadingStripeMode(true);
    try {
      const { data } = await supabase
        .from('stripe_settings')
        .select('mode')
        .limit(1)
        .single();
      
      if (data) {
        setStripeMode(data.mode as 'test' | 'live');
      }
    } finally {
      setLoadingStripeMode(false);
    }
  };

  const handleStripeModeChange = async (isLive: boolean) => {
    const newMode = isLive ? 'live' : 'test';
    setSavingStripeMode(true);
    
    try {
      const { error } = await supabase
        .from('stripe_settings')
        .update({ mode: newMode, updated_at: new Date().toISOString() })
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (error) throw error;
      
      setStripeMode(newMode);
      toast({ 
        title: 'Modo atualizado!', 
        description: `Stripe agora está em modo ${newMode === 'live' ? 'PRODUÇÃO' : 'TESTE'}.`
      });
    } catch (error: any) {
      toast({ 
        title: 'Erro', 
        description: error.message || 'Erro ao atualizar modo.', 
        variant: 'destructive' 
      });
    } finally {
      setSavingStripeMode(false);
    }
  };

  const fetchPendingRechargesCount = async () => {
    const { count } = await supabase
      .from('recharge_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    
    setPendingRechargesCount(count || 0);
  };

  const fetchSyncIssuesCount = async () => {
    const { count } = await supabase
      .from('stripe_events')
      .select('*', { count: 'exact', head: true })
      .eq('event_type', 'checkout.session.completed')
      .or('sync_status.eq.error,sync_status.eq.pending');
    
    setSyncIssuesCount(count || 0);
  };

  const fetchPlans = async () => {
    const { data } = await supabase.from('credit_plans').select('*').order('credits', { ascending: true });
    if (data) setPlans(data as CreditPlan[]);
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

  // Helper function to sync plan to external server
  const syncPlanToExternal = async (planId: string, showToast = false) => {
    setSyncingPlanId(planId);
    try {
      const { data, error } = await supabase.functions.invoke('sync-plans-to-external', {
        body: { action: 'sync_plan', plan_id: planId }
      });
      
      if (error) {
        console.error('Erro ao sincronizar plano com servidor externo:', error);
        if (showToast) {
          toast({ 
            title: 'Erro na sincronização', 
            description: 'Falha ao sincronizar com servidor externo.', 
            variant: 'destructive' 
          });
        }
      } else {
        console.log('Plano sincronizado com servidor externo:', data);
        if (showToast) {
          toast({ 
            title: 'Sincronizado!', 
            description: 'Plano sincronizado com sucesso.' 
          });
        }
        await fetchPlans();
      }
    } catch (err) {
      console.error('Falha na sincronização do plano:', err);
      if (showToast) {
        toast({ 
          title: 'Erro', 
          description: 'Falha ao sincronizar plano.', 
          variant: 'destructive' 
        });
      }
    } finally {
      setSyncingPlanId(null);
    }
  };

  // Helper to get sync status indicator
  const getSyncStatusBadge = (plan: CreditPlan) => {
    const status = plan.sync_status;
    const isSyncing = syncingPlanId === plan.id;

    if (isSyncing) {
      return (
        <Badge variant="outline" className="gap-1">
          <RefreshCw className="w-3 h-3 animate-spin" />
          Sincronizando...
        </Badge>
      );
    }

    if (status === 'synced') {
      const syncDate = plan.synced_at ? new Date(plan.synced_at).toLocaleString('pt-BR') : null;
      return (
        <div className="flex flex-col gap-1">
          <Badge variant="outline" className="gap-1 border-green-500 text-green-600 bg-green-50">
            <CheckCircle className="w-3 h-3" />
            Servidor B
          </Badge>
          {syncDate && (
            <span className="text-xs text-muted-foreground">
              Última sync: {syncDate}
            </span>
          )}
        </div>
      );
    }

    if (status === 'error') {
      return (
        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="destructive" className="gap-1">
                  <AlertCircle className="w-3 h-3" />
                  Erro
                </Badge>
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <p className="break-words">{plan.sync_response || 'Erro desconhecido'}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="outline"
            size="sm"
            onClick={() => syncPlanToExternal(plan.id, true)}
            className="h-6 px-2 text-xs"
          >
            <RefreshCw className="w-3 h-3 mr-1" />
            Retry
          </Button>
        </div>
      );
    }

    // pending or null
    return (
      <div className="flex items-center gap-2">
        <Badge variant="secondary" className="gap-1">
          <Clock className="w-3 h-3" />
          Pendente
        </Badge>
        <Button
          variant="outline"
          size="sm"
          onClick={() => syncPlanToExternal(plan.id, true)}
          className="h-6 px-2 text-xs"
        >
          <RefreshCw className="w-3 h-3 mr-1" />
          Sincronizar
        </Button>
      </div>
    );
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const { data: createdPlan, error } = await supabase.from('credit_plans').insert({
        name: newPlan.name,
        credits: newPlan.credits,
        price_cents: newPlan.price_cents,
        stripe_price_id: newPlan.stripe_price_id || null,
        plan_type: newPlan.plan_type,
        active: true,
      }).select('id').single();

      if (error) throw error;

      // Sync to external server
      if (createdPlan?.id) {
        await syncPlanToExternal(createdPlan.id);
      }

      toast({ title: 'Sucesso!', description: 'Plano criado com sucesso.' });
      setNewPlan({ name: '', credits: 0, price_cents: 0, stripe_price_id: '', plan_type: 'new_account' });
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

      // Sync to external server
      await syncPlanToExternal(planId);

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
          
          {/* Stripe Mode Indicator */}
          <div 
            className={`flex items-center gap-2 px-4 py-2 rounded-full border cursor-pointer transition-colors ${
              stripeMode === 'live' 
                ? 'bg-green-500/10 border-green-500/50 text-green-600' 
                : 'bg-yellow-500/10 border-yellow-500/50 text-yellow-600'
            }`}
            onClick={() => setActiveTab('plans')}
          >
            {stripeMode === 'live' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                <span className="font-medium text-sm">Stripe: Produção</span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span className="font-medium text-sm">Stripe: Teste</span>
              </>
            )}
          </div>
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

        {/* Alert for Sync Issues */}
        {syncIssuesCount > 0 && (
          <Card className="mb-6 border-red-500/50 bg-red-500/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-2 rounded-full bg-red-500/20">
                <AlertTriangle className="w-5 h-5 text-red-500" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-red-600 dark:text-red-400">
                  Sincronização com Servidor B pendente
                </p>
                <p className="text-sm text-muted-foreground">
                  {syncIssuesCount} evento{syncIssuesCount > 1 ? 's' : ''} de checkout aguardando sincronização ou com erro.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm"
                className="border-red-500/50 text-red-600 hover:bg-red-500/20"
                onClick={() => setActiveTab('stripe-events')}
              >
                Ver eventos
              </Button>
            </CardContent>
          </Card>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
          <TabsList className="grid w-full max-w-6xl grid-cols-8">
            <TabsTrigger value="accounts" className="gap-2">
              <Package className="w-4 h-4" />
              Contas
            </TabsTrigger>
            <TabsTrigger value="recharges" className="gap-2 relative">
              <Zap className="w-4 h-4" />
              Recargas
              {pendingRechargesCount > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs animate-pulse"
                >
                  {pendingRechargesCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <UserCheck className="w-4 h-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2">
              <HeadphonesIcon className="w-4 h-4" />
              Suporte
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <Users className="w-4 h-4" />
              Transações
            </TabsTrigger>
            <TabsTrigger value="stripe-events" className="gap-2">
              <Activity className="w-4 h-4" />
              Stripe
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="content" className="gap-2">
              <FileText className="w-4 h-4" />
              Conteúdo
            </TabsTrigger>
          </TabsList>


          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-6">
            <AccountsManager />
          </TabsContent>

          {/* Recharges Tab */}
          <TabsContent value="recharges" className="space-y-6">
            <RechargeManager />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <UsersManager />
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support" className="space-y-6">
            <SupportManager />
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

          {/* Stripe Events Tab */}
          <TabsContent value="stripe-events" className="space-y-6">
            <StripeEventsManager />
          </TabsContent>

          {/* Plans Tab - Combined New Account and Recharge */}
          <TabsContent value="plans" className="space-y-6">
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
                    {loadingStripeMode || savingStripeMode ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Switch
                        checked={stripeMode === 'live'}
                        onCheckedChange={handleStripeModeChange}
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
                  <Button className="gradient-primary" onClick={() => setNewPlan({ ...newPlan, plan_type: 'new_account' })}>
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Plano
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Plano de {newPlan.plan_type === 'new_account' ? 'Conta Nova' : 'Recarga'}</DialogTitle>
                    <DialogDescription>
                      Adicione um novo plano de créditos
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreatePlan} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="plan_type">Tipo de Plano</Label>
                      <select
                        id="plan_type"
                        value={newPlan.plan_type}
                        onChange={(e) => setNewPlan({ ...newPlan, plan_type: e.target.value as 'new_account' | 'recharge' })}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <option value="new_account">Conta Nova</option>
                        <option value="recharge">Recarga</option>
                      </select>
                    </div>
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

            {/* New Account Plans */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-primary" />
                  Planos de Conta Nova
                </CardTitle>
                <CardDescription>Configure os preços e IDs do Stripe para planos de conta nova</CardDescription>
              </CardHeader>
              <CardContent>
                {plans.filter(p => p.plan_type === 'new_account').length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum plano de conta nova cadastrado.</p>
                ) : (
                  <div className="space-y-6">
                    {plans.filter(p => p.plan_type === 'new_account').map((plan) => (
                      <div key={plan.id} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h3 className="font-semibold">{plan.name}</h3>
                            <p className="text-sm text-muted-foreground">{plan.credits.toLocaleString()} créditos</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={(plan.stripe_price_id_test || plan.stripe_price_id_live) ? 'default' : 'secondary'}>
                              {(plan.stripe_price_id_test || plan.stripe_price_id_live) ? 'Configurado' : 'Pendente'}
                            </Badge>
                            {getSyncStatusBadge(plan)}
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
                        <div className="grid sm:grid-cols-2 gap-4">
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
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                              Price ID (Teste)
                            </Label>
                            <Input
                              placeholder="price_test_..."
                              defaultValue={plan.stripe_price_id_test || ''}
                              onBlur={(e) => {
                                const value = e.target.value;
                                if (value !== plan.stripe_price_id_test) {
                                  handleUpdatePlan(plan.id, { stripe_price_id_test: value || null });
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                              Price ID (Produção)
                            </Label>
                            <Input
                              placeholder="price_live_..."
                              defaultValue={plan.stripe_price_id_live || ''}
                              onBlur={(e) => {
                                const value = e.target.value;
                                if (value !== plan.stripe_price_id_live) {
                                  handleUpdatePlan(plan.id, { stripe_price_id_live: value || null });
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

            {/* Recharge Plans */}
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Planos de Recarga
                </CardTitle>
                <CardDescription>Configure os preços e IDs do Stripe para planos de recarga</CardDescription>
              </CardHeader>
              <CardContent>
                {plans.filter(p => p.plan_type === 'recharge').length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum plano de recarga cadastrado.</p>
                ) : (
                  <div className="space-y-6">
                    {plans.filter(p => p.plan_type === 'recharge').map((plan) => (
                      <div key={plan.id} className="p-4 border rounded-lg space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div>
                            <h3 className="font-semibold">{plan.name}</h3>
                            <p className="text-sm text-muted-foreground">{plan.credits.toLocaleString()} créditos</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant={(plan.stripe_price_id_test || plan.stripe_price_id_live) ? 'default' : 'secondary'}>
                              {(plan.stripe_price_id_test || plan.stripe_price_id_live) ? 'Configurado' : 'Pendente'}
                            </Badge>
                            {getSyncStatusBadge(plan)}
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
                        <div className="grid sm:grid-cols-2 gap-4">
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
                        </div>
                        <div className="grid sm:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                              Price ID (Teste)
                            </Label>
                            <Input
                              placeholder="price_test_..."
                              defaultValue={plan.stripe_price_id_test || ''}
                              onBlur={(e) => {
                                const value = e.target.value;
                                if (value !== plan.stripe_price_id_test) {
                                  handleUpdatePlan(plan.id, { stripe_price_id_test: value || null });
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="flex items-center gap-2">
                              <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                              Price ID (Produção)
                            </Label>
                            <Input
                              placeholder="price_live_..."
                              defaultValue={plan.stripe_price_id_live || ''}
                              onBlur={(e) => {
                                const value = e.target.value;
                                if (value !== plan.stripe_price_id_live) {
                                  handleUpdatePlan(plan.id, { stripe_price_id_live: value || null });
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

          {/* Content Editor Tab */}
          <TabsContent value="content" className="space-y-6">
            <ContentEditor />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}