import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sparkles, Zap, ArrowLeft, History, CreditCard, KeyRound, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

interface Transaction {
  id: string;
  credits_added: number;
  amount_cents: number;
  status: string;
  created_at: string;
  plan: { name: string } | null;
}

interface PurchasedAccount {
  id: string;
  account_data: string;
  used_at: string;
  plan: { name: string } | null;
}

export default function Dashboard() {
  const { user, profile, loading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [purchasedAccounts, setPurchasedAccounts] = useState<PurchasedAccount[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
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
    }
  }, [user]);

  const fetchTransactions = async () => {
    const { data } = await supabase
      .from('payment_transactions')
      .select('*, plan:credit_plans(name)')
      .eq('user_id', user!.id)
      .order('created_at', { ascending: false });
    
    if (data) {
      setTransactions(data.map(t => ({ ...t, plan: t.plan as { name: string } | null })));
    }
  };

  const fetchPurchasedAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('id, account_data, used_at, plan:credit_plans(name)')
      .eq('used_by', user!.id)
      .order('used_at', { ascending: false });
    
    if (data) {
      setPurchasedAccounts(data.map(a => ({ ...a, plan: a.plan as { name: string } | null })));
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Dados copiados!');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  const totalCreditsAdded = transactions.filter(t => t.status === 'completed').reduce((acc, t) => acc + t.credits_added, 0);
  const totalSpent = transactions.filter(t => t.status === 'completed').reduce((acc, t) => acc + t.amount_cents, 0);

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

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-full">
              <Zap className="w-4 h-4 text-primary" />
              <span className="font-bold">{profile?.credits || 0} créditos</span>
            </div>
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Disponíveis</CardTitle>
              <Zap className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{profile?.credits || 0}</div>
            </CardContent>
          </Card>
          
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Investido</CardTitle>
              <History className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">R$ {(totalSpent / 100).toFixed(2).replace('.', ',')}</div>
            </CardContent>
          </Card>
        </div>

        {/* Purchased Accounts */}
        <section className="mb-12">
          <h2 className="font-display text-2xl font-bold mb-6">Meus Acessos</h2>
          
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-primary" />
                Contas Adquiridas
              </CardTitle>
              <CardDescription>Dados de acesso das suas contas compradas</CardDescription>
            </CardHeader>
            <CardContent>
              {purchasedAccounts.length === 0 ? (
                <div className="text-center py-12">
                  <KeyRound className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Nenhuma conta adquirida ainda.</p>
                  <Link to="/#plans">
                    <Button className="gradient-primary">Comprar Conta</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {purchasedAccounts.map((account) => (
                    <Card key={account.id} className="bg-secondary/50 border-border">
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(account.account_data, account.id)}
                            className="shrink-0"
                          >
                            {copiedId === account.id ? (
                              <Check className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* Transaction History */}
        <section>
          <h2 className="font-display text-2xl font-bold mb-6">Histórico de Compras</h2>
          
          <Card className="shadow-card">
            <CardHeader>
              <CardTitle>Suas Transações</CardTitle>
              <CardDescription>Histórico de créditos comprados</CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground mb-4">Nenhuma compra realizada ainda.</p>
                  <Link to="/#plans">
                    <Button className="gradient-primary">Comprar Créditos</Button>
                  </Link>
                </div>
              ) : (
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
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}