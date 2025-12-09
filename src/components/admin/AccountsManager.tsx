import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreditPlan {
  id: string;
  name: string;
  credits: number;
}

interface Account {
  id: string;
  plan_id: string;
  account_data: string;
  is_used: boolean;
  used_at: string | null;
  created_at: string;
  credit_plans?: { name: string } | null;
}

export default function AccountsManager() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [accountData, setAccountData] = useState('');
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchAccounts();
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('credit_plans')
      .select('id, name, credits')
      .eq('active', true)
      .order('credits', { ascending: true });
    if (data) setPlans(data);
  };

  const fetchAccounts = async () => {
    const { data } = await supabase
      .from('accounts')
      .select('*, credit_plans(name)')
      .order('created_at', { ascending: false });
    if (data) setAccounts(data as Account[]);
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlanId || !accountData.trim()) {
      toast({ title: 'Erro', description: 'Preencha todos os campos.', variant: 'destructive' });
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase.from('accounts').insert({
        plan_id: selectedPlanId,
        account_data: accountData.trim(),
      });

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Conta cadastrada com sucesso.' });
      setAccountData('');
      setSelectedPlanId('');
      setIsDialogOpen(false);
      await fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao cadastrar conta.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm('Tem certeza que deseja excluir esta conta?')) return;

    try {
      const { error } = await supabase.from('accounts').delete().eq('id', accountId);
      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Conta excluída.' });
      await fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir conta.', variant: 'destructive' });
    }
  };

  const getAccountsCountByPlan = (planId: string) => {
    const available = accounts.filter(a => a.plan_id === planId && !a.is_used).length;
    const total = accounts.filter(a => a.plan_id === planId).length;
    return { available, total };
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Cadastrar Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar Nova Conta</DialogTitle>
              <DialogDescription>
                Adicione os dados de uma conta para um plano específico
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAccount} className="space-y-4">
              <div className="space-y-2">
                <Label>Plano</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o plano" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} ({plan.credits} créditos)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Dados da Conta</Label>
                <Textarea
                  value={accountData}
                  onChange={(e) => setAccountData(e.target.value)}
                  placeholder="Digite os dados da conta que serão enviados ao usuário (login, senha, instruções, etc.)"
                  rows={5}
                  required
                />
              </div>
              <Button type="submit" className="w-full gradient-primary" disabled={creating}>
                {creating ? 'Cadastrando...' : 'Cadastrar Conta'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary by Plan */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Resumo por Plano</CardTitle>
          <CardDescription>Quantidade de contas disponíveis em cada plano</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const { available, total } = getAccountsCountByPlan(plan.id);
              return (
                <div key={plan.id} className="p-4 border rounded-lg text-center">
                  <p className="font-semibold">{plan.name}</p>
                  <p className="text-2xl font-bold text-primary">{available}</p>
                  <p className="text-sm text-muted-foreground">de {total} disponíveis</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Accounts Table */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Contas Cadastradas</CardTitle>
          <CardDescription>Gerencie as contas disponíveis para cada plano</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma conta cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plano</TableHead>
                  <TableHead>Dados da Conta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>
                      <Badge variant="outline">{account.credit_plans?.name || 'N/A'}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate text-sm font-mono">{account.account_data}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={account.is_used ? 'secondary' : 'default'}>
                        {account.is_used ? 'Utilizada' : 'Disponível'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(account.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      {!account.is_used && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteAccount(account.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
