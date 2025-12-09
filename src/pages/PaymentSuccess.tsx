import { useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkles, CheckCircle, ArrowRight } from 'lucide-react';

export default function PaymentSuccess() {
  const [searchParams] = useSearchParams();
  const { refreshProfile } = useAuth();
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    // Refresh profile to get updated credits
    refreshProfile();
  }, []);

  return (
    <div className="min-h-screen gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-card border-0 text-center">
        <CardHeader className="pb-4">
          <div className="mx-auto w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-4">
            <CheckCircle className="w-10 h-10 text-success" />
          </div>
          <CardTitle className="text-2xl font-display">Pagamento Confirmado!</CardTitle>
          <CardDescription className="text-lg">
            Seus créditos foram adicionados à sua conta
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            Obrigado pela sua compra. Agora você pode usar seus créditos para adquirir produtos digitais.
          </p>
          
          <div className="flex flex-col gap-3">
            <Link to="/dashboard">
              <Button className="w-full gradient-primary">
                <Sparkles className="w-4 h-4 mr-2" />
                Ver Meus Produtos
              </Button>
            </Link>
            <Link to="/">
              <Button variant="outline" className="w-full">
                Voltar à Página Inicial
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
