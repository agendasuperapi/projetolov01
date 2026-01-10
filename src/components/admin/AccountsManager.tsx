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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Plus, Trash2, Edit, CheckCircle, Eye } from 'lucide-react';
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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [accountData, setAccountData] = useState('');
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [editAccountData, setEditAccountData] = useState('');
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
      .neq('plan_type', 'recharge')
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
      await fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao cadastrar conta.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleEditAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount || !editAccountData.trim()) return;

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ account_data: editAccountData.trim() })
        .eq('id', editingAccount.id);

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Conta atualizada.' });
      setIsEditDialogOpen(false);
      setEditingAccount(null);
      setEditAccountData('');
      await fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao atualizar conta.', variant: 'destructive' });
    }
  };

  const handleMarkAsUsed = async (accountId: string) => {
    if (!confirm('Tem certeza que deseja marcar esta conta como utilizada?')) return;

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ is_used: true, used_at: new Date().toISOString() })
        .eq('id', accountId);

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Conta marcada como utilizada.' });
      await fetchAccounts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao atualizar conta.', variant: 'destructive' });
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

  const openEditDialog = (account: Account) => {
    setEditingAccount(account);
    setEditAccountData(account.account_data);
    setIsEditDialogOpen(true);
  };

  const getAccountsByPlan = (planId: string) => {
    return accounts.filter(a => a.plan_id === planId);
  };

  const getAccountsCountByPlan = (planId: string) => {
    const available = accounts.filter(a => a.plan_id === planId && !a.is_used).length;
    const total = accounts.filter(a => a.plan_id === planId).length;
    return { available, total };
  };

  // Preview component that simulates customer view
  const AccountPreview = ({ accountData }: { accountData: string }) => {
    const lines = accountData.split('\n').map(line => line.trim());
    let email = '';
    let password = '';
    
    const emailIndex = lines.findIndex(line => line.toLowerCase() === 'email:');
    const senhaIndex = lines.findIndex(line => line.toLowerCase() === 'senha:');
    
    if (emailIndex !== -1 && lines[emailIndex + 1]) {
      email = lines[emailIndex + 1];
    }
    if (senhaIndex !== -1 && lines[senhaIndex + 1]) {
      password = lines[senhaIndex + 1];
    }
    
    return (
      <div className="border-2 border-primary/20 rounded-lg p-4 bg-gradient-to-br from-secondary/50 to-background">
        <p className="text-xs text-muted-foreground mb-3 font-medium">👁 Prévia (como o cliente verá):</p>
        <div className="space-y-2">
          <div className="bg-background border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Email</p>
            <p className="font-mono text-sm">{email || <span className="text-destructive">(não detectado)</span>}</p>
          </div>
          <div className="bg-background border rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Senha</p>
            <p className="font-mono text-sm">{password || <span className="text-destructive">(não detectado)</span>}</p>
          </div>
        </div>
      </div>
    );
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
                  placeholder="Email:&#10;exemplo@email.com&#10;Senha:&#10;senha123"
                  rows={5}
                  required
                />
              </div>
              {accountData.trim() && (
                <AccountPreview accountData={accountData} />
              )}
              <Button type="submit" className="w-full gradient-primary" disabled={creating}>
                {creating ? 'Cadastrando...' : 'Cadastrar Conta'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Conta</DialogTitle>
              <DialogDescription>
                Atualize os dados desta conta
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEditAccount} className="space-y-4">
              <div className="space-y-2">
                <Label>Dados da Conta</Label>
                <Textarea
                  value={editAccountData}
                  onChange={(e) => setEditAccountData(e.target.value)}
                  placeholder="Email:&#10;exemplo@email.com&#10;Senha:&#10;senha123"
                  rows={5}
                  required
                />
              </div>
              {editAccountData.trim() && (
                <AccountPreview accountData={editAccountData} />
              )}
              <Button type="submit" className="w-full gradient-primary">
                Salvar Alterações
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

      {/* Accounts by Plan - Accordion */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle>Contas por Plano</CardTitle>
          <CardDescription>Gerencie as contas disponíveis separadas por plano</CardDescription>
        </CardHeader>
        <CardContent>
          {plans.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum plano cadastrado.</p>
          ) : (
            <Accordion type="multiple" className="w-full">
              {plans.map((plan) => {
                const planAccounts = getAccountsByPlan(plan.id);
                const { available, total } = getAccountsCountByPlan(plan.id);
                
                return (
                  <AccordionItem key={plan.id} value={plan.id}>
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-4">
                        <span className="font-semibold">{plan.name}</span>
                        <Badge variant="outline">
                          {available}/{total} disponíveis
                        </Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {planAccounts.length === 0 ? (
                        <p className="text-center text-muted-foreground py-4">
                          Nenhuma conta cadastrada para este plano.
                        </p>
                      ) : (
                        <>
                          {/* Desktop Table */}
                          <div className="hidden md:block">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Dados da Conta</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead>Data</TableHead>
                                  <TableHead className="w-[150px]">Ações</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {planAccounts.map((account) => (
                                  <TableRow key={account.id}>
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
                                      <div className="flex items-center gap-1">
                                        <Popover>
                                          <PopoverTrigger asChild>
                                            <Button variant="ghost" size="icon" title="Ver prévia">
                                              <Eye className="w-4 h-4" />
                                            </Button>
                                          </PopoverTrigger>
                                          <PopoverContent className="w-80">
                                            <AccountPreview accountData={account.account_data} />
                                          </PopoverContent>
                                        </Popover>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => openEditDialog(account)}
                                          title="Editar"
                                        >
                                          <Edit className="w-4 h-4" />
                                        </Button>
                                        {!account.is_used && (
                                          <>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleMarkAsUsed(account.id)}
                                              title="Marcar como utilizada"
                                              className="text-amber-500 hover:text-amber-600"
                                            >
                                              <CheckCircle className="w-4 h-4" />
                                            </Button>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              onClick={() => handleDeleteAccount(account.id)}
                                              className="text-destructive hover:text-destructive"
                                              title="Excluir"
                                            >
                                              <Trash2 className="w-4 h-4" />
                                            </Button>
                                          </>
                                        )}
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Mobile Cards */}
                          <div className="md:hidden space-y-3">
                            {planAccounts.map((account) => (
                              <div 
                                key={account.id} 
                                className="p-4 border rounded-lg bg-card space-y-3"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <Badge variant={account.is_used ? 'secondary' : 'default'}>
                                    {account.is_used ? 'Utilizada' : 'Disponível'}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(account.created_at).toLocaleDateString('pt-BR')}
                                  </span>
                                </div>
                                <p className="text-sm font-mono bg-muted p-2 rounded break-all">
                                  {account.account_data}
                                </p>
                                <AccountPreview accountData={account.account_data} />
                                <div className="flex items-center gap-2 pt-2 border-t">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openEditDialog(account)}
                                    className="flex-1"
                                  >
                                    <Edit className="w-4 h-4 mr-2" />
                                    Editar
                                  </Button>
                                  {!account.is_used && (
                                    <>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleMarkAsUsed(account.id)}
                                        className="text-amber-500 border-amber-500/50"
                                      >
                                        <CheckCircle className="w-4 h-4" />
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleDeleteAccount(account.id)}
                                        className="text-destructive border-destructive/50"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
