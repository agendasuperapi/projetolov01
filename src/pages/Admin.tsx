import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sparkles, Plus, ArrowLeft, Package, Users, DollarSign, Trash2, Upload } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  credits_required: number;
  created_at: string;
}

interface CreditPlan {
  id: string;
  name: string;
  credits: number;
  price_cents: number;
  stripe_price_id: string | null;
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
  const [products, setProducts] = useState<Product[]>([]);
  const [plans, setPlans] = useState<CreditPlan[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', credits_required: 0 });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchProducts();
      fetchPlans();
      fetchTransactions();
    }
  }, [isAdmin]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('digital_products').select('*').order('created_at', { ascending: false });
    if (data) setProducts(data);
  };

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
      // Fetch profiles separately
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

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast({ title: 'Erro', description: 'Selecione um arquivo.', variant: 'destructive' });
      return;
    }

    setUploading(true);

    try {
      const fileName = `${Date.now()}-${selectedFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from('digital-products')
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('digital_products').insert({
        name: newProduct.name,
        description: newProduct.description || null,
        file_url: fileName,
        credits_required: newProduct.credits_required,
      });

      if (insertError) throw insertError;

      toast({ title: 'Sucesso!', description: 'Produto criado com sucesso.' });
      setNewProduct({ name: '', description: '', credits_required: 0 });
      setSelectedFile(null);
      setIsDialogOpen(false);
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao criar produto.', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteProduct = async (product: Product) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;

    try {
      await supabase.storage.from('digital-products').remove([product.file_url]);
      const { error } = await supabase.from('digital_products').delete().eq('id', product.id);
      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Produto excluído.' });
      await fetchProducts();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao excluir produto.', variant: 'destructive' });
    }
  };

  const handleUpdatePlan = async (planId: string, priceId: string, priceCents: number) => {
    try {
      const { error } = await supabase
        .from('credit_plans')
        .update({ stripe_price_id: priceId, price_cents: priceCents })
        .eq('id', planId);

      if (error) throw error;

      toast({ title: 'Sucesso!', description: 'Plano atualizado.' });
      await fetchPlans();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
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
            <p className="text-muted-foreground">Gerencie produtos, planos e transações</p>
          </div>
        </div>

        <Tabs defaultValue="products" className="space-y-8">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="products" className="gap-2">
              <Package className="w-4 h-4" />
              Produtos
            </TabsTrigger>
            <TabsTrigger value="plans" className="gap-2">
              <DollarSign className="w-4 h-4" />
              Planos
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <Users className="w-4 h-4" />
              Transações
            </TabsTrigger>
          </TabsList>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-6">
            <div className="flex justify-end">
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gradient-primary">
                    <Plus className="w-4 h-4 mr-2" />
                    Novo Produto
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar Produto Digital</DialogTitle>
                    <DialogDescription>
                      Adicione um novo produto à biblioteca
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleCreateProduct} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome do Produto</Label>
                      <Input
                        id="name"
                        value={newProduct.name}
                        onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea
                        id="description"
                        value={newProduct.description}
                        onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="credits">Créditos Necessários</Label>
                      <Input
                        id="credits"
                        type="number"
                        min="0"
                        value={newProduct.credits_required}
                        onChange={(e) => setNewProduct({ ...newProduct, credits_required: parseInt(e.target.value) || 0 })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="file">Arquivo</Label>
                      <div className="flex items-center gap-4">
                        <Input
                          id="file"
                          type="file"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          required
                        />
                      </div>
                      {selectedFile && (
                        <p className="text-sm text-muted-foreground">
                          <Upload className="w-4 h-4 inline mr-1" />
                          {selectedFile.name}
                        </p>
                      )}
                    </div>
                    <Button type="submit" className="w-full gradient-primary" disabled={uploading}>
                      {uploading ? 'Enviando...' : 'Criar Produto'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Produtos Digitais</CardTitle>
                <CardDescription>Gerencie os produtos disponíveis para download</CardDescription>
              </CardHeader>
              <CardContent>
                {products.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum produto cadastrado.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Créditos</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="w-[100px]">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-medium">{product.name}</TableCell>
                          <TableCell className="text-muted-foreground max-w-xs truncate">
                            {product.description || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge>{product.credits_required}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {new Date(product.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteProduct(product)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plans Tab */}
          <TabsContent value="plans" className="space-y-6">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Planos de Créditos</CardTitle>
                <CardDescription>Configure os preços e IDs do Stripe para cada plano</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {plans.map((plan) => (
                    <div key={plan.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{plan.name}</h3>
                          <p className="text-sm text-muted-foreground">{plan.credits.toLocaleString()} créditos</p>
                        </div>
                        <Badge variant={plan.stripe_price_id ? 'default' : 'secondary'}>
                          {plan.stripe_price_id ? 'Configurado' : 'Pendente'}
                        </Badge>
                      </div>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Preço (centavos)</Label>
                          <Input
                            type="number"
                            defaultValue={plan.price_cents}
                            onBlur={(e) => {
                              const value = parseInt(e.target.value) || 0;
                              if (value !== plan.price_cents) {
                                handleUpdatePlan(plan.id, plan.stripe_price_id || '', value);
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
                                handleUpdatePlan(plan.id, value, plan.price_cents);
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
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
                          <TableCell>R$ {(tx.amount_cents / 100).toFixed(2).replace('.', ',')}</TableCell>
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
        </Tabs>
      </main>
    </div>
  );
}
