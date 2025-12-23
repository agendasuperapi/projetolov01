import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, ArrowLeft, History, CreditCard, KeyRound, Copy, Check, RefreshCw, Clock, CheckCircle, Send, Loader2, HeadphonesIcon, MessageSquare, AlertCircle, Plus, Star, Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NewTicketModal from '@/components/support/NewTicketModal';
import TicketDetailModal from '@/components/support/TicketDetailModal';
import logoImage from '@/assets/logo.png';
interface Transaction {
  id: string;
  credits_added: number;
  amount_cents: number;
  status: string;
  created_at: string;
  plan: {
    name: string;
  } | null;
}
interface PurchasedAccount {
  id: string;
  account_data: string;
  used_at: string;
  plan: {
    name: string;
  } | null;
}
interface RechargeRequest {
  id: string;
  recharge_link: string;
  status: string;
  credits_added: number;
  created_at: string;
  completed_at: string | null;
  plan: {
    name: string;
  } | null;
}
type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
type TicketType = 'problem' | 'suggestion' | 'complaint' | 'question' | 'financial' | 'technical' | 'other';
interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  ticket_type: TicketType;
  priority: string;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  rating: number | null;
}
const statusLabels: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  waiting_user: 'Aguardando Você',
  resolved: 'Resolvido',
  closed: 'Encerrado'
};
const statusColors: Record<TicketStatus, string> = {
  open: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting_user: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-muted text-muted-foreground border-border'
};
const typeLabels: Record<TicketType, string> = {
  problem: 'Problema',
  suggestion: 'Sugestão',
  complaint: 'Reclamação',
  question: 'Dúvida',
  financial: 'Financeiro',
  technical: 'Técnico',
  other: 'Outro'
};
export default function Dashboard() {
  const {
    user,
    profile,
    loading
  } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchasedAccounts, setPurchasedAccounts] = useState<PurchasedAccount[]>([]);
  const [rechargeRequests, setRechargeRequests] = useState<RechargeRequest[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [linkInputs, setLinkInputs] = useState<Record<string, string>>({});
  const [submittingLink, setSubmittingLink] = useState<string | null>(null);
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);
  const [ticketSearch, setTicketSearch] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const navigate = useNavigate();
  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);
  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchPurchasedAccounts();
      fetchRechargeRequests();
      fetchTickets();
    }
  }, [user]);

  // Realtime subscription for support tickets and messages
  useEffect(() => {
    if (!user) return;
    const ticketsChannel = supabase.channel('user-tickets-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'support_tickets',
      filter: `user_id=eq.${user.id}`
    }, payload => {
      if (payload.eventType === 'UPDATE') {
        const newStatus = (payload.new as any).status;
        if (newStatus === 'resolved') {
          toast.success('Seu chamado foi resolvido!', {
            description: 'Avalie o atendimento no painel de suporte.'
          });
        } else if (newStatus === 'in_progress') {
          toast.info('Seu chamado está sendo atendido');
        }
      }
      fetchTickets();
    }).subscribe();
    const messagesChannel = supabase.channel('user-messages-changes').on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'support_messages'
    }, async payload => {
      const newMessage = payload.new as any;
      // Check if this message is for a ticket owned by the user and is from admin
      if (newMessage.is_admin && newMessage.user_id !== user.id) {
        const {
          data: ticket
        } = await supabase.from('support_tickets').select('ticket_number, user_id').eq('id', newMessage.ticket_id).single();
        if (ticket && ticket.user_id === user.id) {
          toast.info(`Nova resposta no chamado #${String(ticket.ticket_number).padStart(3, '0')}`, {
            description: 'Clique em Suporte para ver.'
          });
          fetchTickets();
        }
      }
    }).subscribe();
    return () => {
      supabase.removeChannel(ticketsChannel);
      supabase.removeChannel(messagesChannel);
    };
  }, [user]);
  const fetchTransactions = async () => {
    const {
      data
    } = await supabase.from('payment_transactions').select('*, plan:credit_plans(name)').eq('user_id', user!.id).order('created_at', {
      ascending: false
    });
    if (data) {
      setTransactions(data.map(t => ({
        ...t,
        plan: t.plan as {
          name: string;
        } | null
      })));
    }
  };
  const fetchPurchasedAccounts = async () => {
    const {
      data
    } = await supabase.from('accounts').select('id, account_data, used_at, plan:credit_plans(name)').eq('used_by', user!.id).order('used_at', {
      ascending: false
    });
    if (data) {
      setPurchasedAccounts(data.map(a => ({
        ...a,
        plan: a.plan as {
          name: string;
        } | null
      })));
    }
  };
  const fetchRechargeRequests = async () => {
    const {
      data: recharges
    } = await supabase.from('recharge_requests').select('*').eq('user_id', user!.id).order('created_at', {
      ascending: false
    });
    if (recharges && recharges.length > 0) {
      const planIds = [...new Set(recharges.map(r => r.plan_id))];
      const {
        data: plans
      } = await supabase.from('credit_plans').select('id, name').in('id', planIds);
      const planMap = new Map(plans?.map(p => [p.id, p.name]) || []);
      setRechargeRequests(recharges.map(r => ({
        id: r.id,
        recharge_link: r.recharge_link,
        status: r.status,
        credits_added: r.credits_added,
        created_at: r.created_at,
        completed_at: r.completed_at,
        plan: planMap.has(r.plan_id) ? {
          name: planMap.get(r.plan_id)!
        } : null
      })));
    } else {
      setRechargeRequests([]);
    }
  };
  const fetchTickets = async () => {
    const {
      data,
      error
    } = await supabase.from('support_tickets').select('*').order('updated_at', {
      ascending: false
    });
    if (!error && data) {
      setTickets(data);
    }
  };
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Dados copiados!');
    setTimeout(() => setCopiedId(null), 2000);
  };
  const handleSubmitRechargeLink = async (rechargeId: string) => {
    const link = linkInputs[rechargeId]?.trim();
    if (!link) return;
    setSubmittingLink(rechargeId);
    try {
      const {
        error
      } = await supabase.from('recharge_requests').update({
        recharge_link: link,
        status: 'pending'
      }).eq('id', rechargeId);
      if (error) throw error;
      toast.success('Link enviado com sucesso!');
      setLinkInputs(prev => ({
        ...prev,
        [rechargeId]: ''
      }));
      fetchRechargeRequests();
    } catch (error) {
      toast.error('Erro ao enviar link');
    } finally {
      setSubmittingLink(null);
    }
  };
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>;
  }
  const totalCreditsAdded = transactions.filter(t => t.status === 'completed').reduce((acc, t) => acc + t.credits_added, 0);
  const totalSpent = transactions.filter(t => t.status === 'completed').reduce((acc, t) => acc + t.amount_cents, 0);
  const openTicketsCount = tickets.filter(t => t.status === 'open' || t.status === 'waiting_user').length;
  return <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src={logoImage} alt="Mais Créditos" className="h-10 w-auto" />
          </Link>

          <div className="flex items-center gap-4">
            
            <Link to="/#plans">
              <Button variant="outline" size="sm">Comprar Créditos</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>

        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold mb-2">Olá, {profile?.name || 'Usuário'}!</h1>
          <p className="text-muted-foreground">Gerencie seus créditos e histórico</p>
        </div>

        {/* Stats */}
        <div className="grid sm:grid-cols-2 gap-6 mb-8">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Comprado</CardTitle>
              <CreditCard className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalCreditsAdded.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">créditos</p>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total de Pedidos</CardTitle>
              <History className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{transactions?.length || 0}</div>
              <p className="text-xs text-muted-foreground">pedidos realizados</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList className="grid w-full max-w-2xl grid-cols-2 md:grid-cols-4 h-auto gap-1">
            <TabsTrigger value="accounts" className="gap-2 text-xs sm:text-sm py-2">
              <KeyRound className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Minhas Contas</span>
              <span className="sm:hidden">Contas</span>
            </TabsTrigger>
            <TabsTrigger value="recharges" className="gap-2 text-xs sm:text-sm py-2">
              <RefreshCw className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Minhas Recargas</span>
              <span className="sm:hidden">Recargas</span>
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2 text-xs sm:text-sm py-2">
              <History className="w-4 h-4 shrink-0" />
              Transações
            </TabsTrigger>
            <TabsTrigger value="support" className="gap-2 text-xs sm:text-sm py-2 relative">
              <HeadphonesIcon className="w-4 h-4 shrink-0" />
              Suporte
              {openTicketsCount > 0 && <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  {openTicketsCount}
                </Badge>}
            </TabsTrigger>
          </TabsList>

          {/* Accounts Tab */}
          <TabsContent value="accounts">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-primary" />
                  Contas Adquiridas
                </CardTitle>
                <CardDescription>Dados de acesso das suas contas compradas</CardDescription>
              </CardHeader>
              <CardContent>
                {purchasedAccounts.length === 0 ? <div className="text-center py-12">
                    <KeyRound className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Nenhuma conta adquirida ainda.</p>
                    <Link to="/#plans">
                      <Button className="gradient-primary">Comprar Conta</Button>
                    </Link>
                  </div> : <div className="space-y-4">
                    {purchasedAccounts.map(account => <Card key={account.id} className="bg-secondary/50 border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{account.plan?.name || 'Plano'}</Badge>
                                <span className="text-xs text-muted-foreground">
                                  {account.used_at && new Date(account.used_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <div className="bg-background p-3 rounded-lg font-mono text-sm whitespace-pre-wrap break-all">
                                {account.account_data}
                              </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => copyToClipboard(account.account_data, account.id)} className="shrink-0">
                              {copiedId === account.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recharges Tab */}
          <TabsContent value="recharges">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Solicitações de Recarga
                </CardTitle>
                <CardDescription>Acompanhe o status das suas recargas</CardDescription>
              </CardHeader>
              <CardContent>
                {rechargeRequests.length === 0 ? <div className="text-center py-12">
                    <RefreshCw className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Nenhuma recarga solicitada ainda.</p>
                    <Link to="/#plans">
                      <Button className="gradient-primary">Solicitar Recarga</Button>
                    </Link>
                  </div> : <div className="space-y-4">
                    {rechargeRequests.map(recharge => <Card key={recharge.id} className="bg-secondary/50 border-border">
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="outline">{recharge.plan?.name || 'Plano'}</Badge>
                                <Badge variant={recharge.status === 'completed' ? 'default' : recharge.status === 'pending_link' ? 'destructive' : 'secondary'} className={recharge.status === 'completed' ? 'bg-green-500' : ''}>
                                  {recharge.status === 'completed' ? <><CheckCircle className="w-3 h-3 mr-1" /> Recarregado</> : recharge.status === 'pending_link' ? <><Clock className="w-3 h-3 mr-1" /> Aguardando Link</> : <><Clock className="w-3 h-3 mr-1" /> Pendente</>}
                                </Badge>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(recharge.created_at).toLocaleDateString('pt-BR')}
                                </span>
                              </div>
                              <div className="text-sm text-muted-foreground mb-2">
                                <span className="font-medium">+{recharge.credits_added} créditos</span>
                              </div>
                              
                              {recharge.status === 'pending_link' && !recharge.recharge_link ? <div className="space-y-2">
                                  <p className="text-xs text-muted-foreground font-medium">Informe o link da sua conta:</p>
                                  <div className="flex gap-2">
                                    <Input type="url" placeholder="https://..." value={linkInputs[recharge.id] || ''} onChange={e => setLinkInputs(prev => ({
                              ...prev,
                              [recharge.id]: e.target.value
                            }))} className="flex-1" />
                                    <Button size="sm" onClick={() => handleSubmitRechargeLink(recharge.id)} disabled={submittingLink === recharge.id || !linkInputs[recharge.id]?.trim()} className="gradient-primary">
                                      {submittingLink === recharge.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                    </Button>
                                  </div>
                                </div> : recharge.recharge_link ? <div className="space-y-1">
                                  <p className="text-xs text-muted-foreground font-medium">Link cadastrado:</p>
                                  <div className="bg-background p-3 rounded-lg font-mono text-sm break-all">
                                    {recharge.recharge_link}
                                  </div>
                                </div> : null}
                              
                              {recharge.completed_at && <p className="text-xs text-muted-foreground mt-2">
                                  Recarregado em: {new Date(recharge.completed_at).toLocaleDateString('pt-BR')}
                                </p>}
                            </div>
                            {recharge.recharge_link && <Button variant="outline" size="sm" onClick={() => copyToClipboard(recharge.recharge_link, recharge.id)} className="shrink-0">
                                {copiedId === recharge.id ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                              </Button>}
                          </div>
                        </CardContent>
                      </Card>)}
                  </div>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Suas Transações</CardTitle>
                <CardDescription>Histórico de créditos comprados</CardDescription>
              </CardHeader>
              <CardContent>
                {transactions.length === 0 ? <div className="text-center py-12">
                    <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground mb-4">Nenhuma compra realizada ainda.</p>
                    <Link to="/#plans">
                      <Button className="gradient-primary">Comprar Créditos</Button>
                    </Link>
                  </div> : <>
                    {/* Desktop Table */}
                    <div className="hidden md:block">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Plano</TableHead>
                            <TableHead>Créditos</TableHead>
                            <TableHead>Valor</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {transactions.map(tx => <TableRow key={tx.id}>
                              <TableCell className="font-medium">{tx.plan?.name || 'Plano'}</TableCell>
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
                            </TableRow>)}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Mobile Cards */}
                    <div className="md:hidden space-y-3">
                      {transactions.map(tx => <div key={tx.id} className="p-4 border rounded-lg bg-card/50 space-y-2">
                          {/* Header: Plano e Status */}
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold">{tx.plan?.name || 'Plano'}</p>
                            <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                              {tx.status === 'completed' ? 'Concluído' : tx.status}
                            </Badge>
                          </div>

                          {/* Info row: Créditos e Valor */}
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{tx.credits_added} créditos</Badge>
                            <span className="text-sm font-medium">
                              R$ {(tx.amount_cents / 100).toFixed(2).replace('.', ',')}
                            </span>
                          </div>

                          {/* Data */}
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>)}
                    </div>
                  </>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Support Tab */}
          <TabsContent value="support">
            <div className="space-y-6">
              {/* Support Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-foreground">Suporte</h2>
                  <p className="text-muted-foreground text-sm">Abra chamados e acompanhe suas solicitações</p>
                </div>
                <Button onClick={() => setIsNewTicketOpen(true)} className="gap-2">
                  <Plus className="h-4 w-4" />
                  Novo Chamado
                </Button>
              </div>

              {/* Support Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4 border-border/50 bg-card/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <MessageSquare className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{tickets.length}</p>
                      <p className="text-sm text-muted-foreground">Total</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-border/50 bg-card/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/20">
                      <Clock className="h-5 w-5 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{tickets.filter(t => t.status === 'open').length}</p>
                      <p className="text-sm text-muted-foreground">Abertos</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-border/50 bg-card/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <AlertCircle className="h-5 w-5 text-amber-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{tickets.filter(t => t.status === 'waiting_user').length}</p>
                      <p className="text-sm text-muted-foreground">Aguardando</p>
                    </div>
                  </div>
                </Card>
                <Card className="p-4 border-border/50 bg-card/50">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length}</p>
                      <p className="text-sm text-muted-foreground">Resolvidos</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* Filters */}
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Buscar por assunto ou número..." value={ticketSearch} onChange={e => setTicketSearch(e.target.value)} className="pl-10" />
                </div>
                <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Filtrar por status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os Status</SelectItem>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="in_progress">Em Andamento</SelectItem>
                    <SelectItem value="waiting_user">Aguardando Você</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                    <SelectItem value="closed">Encerrado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Tickets List */}
              <div className="space-y-4">
                {(() => {
                const filteredTickets = tickets.filter(ticket => {
                  const matchesSearch = ticketSearch === '' || ticket.subject.toLowerCase().includes(ticketSearch.toLowerCase()) || String(ticket.ticket_number).includes(ticketSearch);
                  const matchesStatus = ticketStatusFilter === 'all' || ticket.status === ticketStatusFilter;
                  return matchesSearch && matchesStatus;
                });
                if (tickets.length === 0) {
                  return <Card className="p-8 text-center border-border/50 bg-card/50">
                        <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nenhum chamado encontrado</p>
                        <Button onClick={() => setIsNewTicketOpen(true)} className="mt-4">
                          Criar primeiro chamado
                        </Button>
                      </Card>;
                }
                if (filteredTickets.length === 0) {
                  return <Card className="p-8 text-center border-border/50 bg-card/50">
                        <Search className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">Nenhum chamado corresponde aos filtros</p>
                      </Card>;
                }
                return filteredTickets.map(ticket => <Card key={ticket.id} className="p-4 border-border/50 bg-card/50 hover:bg-card/80 cursor-pointer transition-colors" onClick={() => setSelectedTicket(ticket.id)}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium text-muted-foreground">
                              #{String(ticket.ticket_number).padStart(3, '0')}
                            </span>
                            <Badge className={statusColors[ticket.status]}>
                              {statusLabels[ticket.status]}
                            </Badge>
                          </div>
                          <h3 className="font-semibold text-foreground mb-1">{ticket.subject}</h3>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{typeLabels[ticket.ticket_type]}</span>
                            <span>•</span>
                            <span>{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", {
                            locale: ptBR
                          })}</span>
                          </div>
                        </div>
                        {ticket.rating && <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => <Star key={i} className={`h-4 w-4 ${i < ticket.rating! ? 'fill-amber-400 text-amber-400' : 'text-muted'}`} />)}
                          </div>}
                      </div>
                    </Card>);
              })()}
              </div>
            </div>

            <NewTicketModal open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen} onSuccess={() => {
            fetchTickets();
            setIsNewTicketOpen(false);
          }} />

            <TicketDetailModal ticketId={selectedTicket} onClose={() => setSelectedTicket(null)} onUpdate={fetchTickets} />
          </TabsContent>
        </Tabs>
      </main>
    </div>;
}