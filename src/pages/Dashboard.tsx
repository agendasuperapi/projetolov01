import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Zap, Download, ArrowLeft, Package, ShoppingCart } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Product {
  id: string;
  name: string;
  description: string | null;
  file_url: string;
  credits_required: number;
}

interface Purchase {
  id: string;
  credits_spent: number;
  purchased_at: string;
  product: Product;
}

export default function Dashboard() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProducts();
      fetchPurchases();
    }
  }, [user]);

  const fetchProducts = async () => {
    const { data } = await supabase.from('digital_products').select('*').order('credits_required', { ascending: true });
    if (data) setProducts(data);
  };

  const fetchPurchases = async () => {
    const { data } = await supabase
      .from('purchases')
      .select('*, product:digital_products(*)')
      .order('purchased_at', { ascending: false });
    
    if (data) {
      setPurchases(data.map(p => ({ ...p, product: p.product as Product })));
    }
  };

  const handlePurchaseProduct = async (product: Product) => {
    if (!profile || profile.credits < product.credits_required) {
      toast({ title: 'Créditos insuficientes', description: 'Compre mais créditos para adquirir este produto.', variant: 'destructive' });
      return;
    }

    setPurchaseLoading(product.id);

    try {
      // Check if already purchased
      const { data: existingPurchase } = await supabase
        .from('purchases')
        .select('id')
        .eq('user_id', user!.id)
        .eq('product_id', product.id)
        .maybeSingle();

      if (existingPurchase) {
        toast({ title: 'Já adquirido', description: 'Você já possui este produto.' });
        setPurchaseLoading(null);
        return;
      }

      // Deduct credits
      const newCredits = profile.credits - product.credits_required;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ credits: newCredits })
        .eq('id', user!.id);

      if (updateError) throw updateError;

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          user_id: user!.id,
          product_id: product.id,
          credits_spent: product.credits_required,
        });

      if (purchaseError) throw purchaseError;

      toast({ title: 'Sucesso!', description: 'Produto adquirido. Agora você pode fazer o download.' });
      await refreshProfile();
      await fetchPurchases();
    } catch (error: any) {
      toast({ title: 'Erro', description: error.message || 'Erro ao adquirir produto.', variant: 'destructive' });
    } finally {
      setPurchaseLoading(null);
    }
  };

  const handleDownload = async (product: Product) => {
    try {
      const { data, error } = await supabase.storage.from('digital-products').createSignedUrl(product.file_url, 3600);
      
      if (error) throw error;
      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    } catch (error: any) {
      toast({ title: 'Erro', description: 'Erro ao gerar link de download.', variant: 'destructive' });
    }
  };

  const isPurchased = (productId: string) => purchases.some(p => p.product.id === productId);

  if (loading) {
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
          <p className="text-muted-foreground">Gerencie seus produtos e créditos</p>
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
              <CardTitle className="text-sm font-medium text-muted-foreground">Produtos Adquiridos</CardTitle>
              <Package className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{purchases.length}</div>
            </CardContent>
          </Card>

          <Card className="shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Créditos Utilizados</CardTitle>
              <ShoppingCart className="w-5 h-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{purchases.reduce((acc, p) => acc + p.credits_spent, 0)}</div>
            </CardContent>
          </Card>
        </div>

        {/* My Products */}
        {purchases.length > 0 && (
          <section className="mb-12">
            <h2 className="font-display text-2xl font-bold mb-6">Meus Produtos</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {purchases.map((purchase) => (
                <Card key={purchase.id} className="shadow-card hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      {purchase.product.name}
                      <Badge variant="secondary">Adquirido</Badge>
                    </CardTitle>
                    {purchase.product.description && (
                      <CardDescription>{purchase.product.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Button onClick={() => handleDownload(purchase.product)} className="w-full gradient-primary">
                      <Download className="w-4 h-4 mr-2" />
                      Download
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Available Products */}
        <section>
          <h2 className="font-display text-2xl font-bold mb-6">Produtos Disponíveis</h2>
          {products.length === 0 ? (
            <Card className="shadow-card text-center py-12">
              <CardContent>
                <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Nenhum produto disponível no momento.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {products.map((product) => {
                const owned = isPurchased(product.id);
                return (
                  <Card key={product.id} className="shadow-card hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {product.name}
                        <Badge className="gradient-primary text-primary-foreground">
                          {product.credits_required} créditos
                        </Badge>
                      </CardTitle>
                      {product.description && (
                        <CardDescription>{product.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent>
                      {owned ? (
                        <Button onClick={() => handleDownload(product)} className="w-full gradient-primary">
                          <Download className="w-4 h-4 mr-2" />
                          Download
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => handlePurchaseProduct(product)} 
                          disabled={purchaseLoading === product.id}
                          className="w-full"
                          variant="outline"
                        >
                          {purchaseLoading === product.id ? 'Processando...' : 'Adquirir Produto'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
