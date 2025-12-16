import { useCallback, useState, useMemo, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { loadStripe, Appearance } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import logoImage from '@/assets/logo.png';

const stripePromise = loadStripe('pk_test_51ScUIsB5jlU6MVipyrn6VrLyC0DVv5sQCGRAkSFOK2Ndlovwl0a12l8GsguXvPkAA3AhlTKrQBAKPh5SusTxQM9t00qT2IDmkD');

// Customização visual do checkout para combinar com o site
const checkoutAppearance: Appearance = {
  theme: 'flat',
  variables: {
    colorPrimary: '#7c3aed',
    colorBackground: '#ffffff',
    colorText: '#1f2937',
    colorDanger: '#ef4444',
    colorSuccess: '#22c55e',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSizeBase: '16px',
    spacingUnit: '4px',
    borderRadius: '12px',
  },
  rules: {
    '.Input': {
      border: '1px solid #e5e7eb',
      boxShadow: 'none',
    },
    '.Input:focus': {
      border: '2px solid #7c3aed',
      boxShadow: '0 0 0 3px rgba(124, 58, 237, 0.1)',
    },
    '.Label': {
      fontWeight: '500',
    },
    '.Tab': {
      border: '1px solid #e5e7eb',
      borderRadius: '8px',
    },
    '.Tab--selected': {
      backgroundColor: '#7c3aed',
      borderColor: '#7c3aed',
    },
  },
};

export default function Checkout() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, loading: authLoading } = useAuth();
  
  const priceId = searchParams.get('priceId');
  const planId = searchParams.get('planId');
  const purchaseType = searchParams.get('purchaseType') as 'new_account' | 'recharge' | null;
  const couponCode = searchParams.get('couponCode');

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect to home if not authenticated or missing params
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Validate required params
  useEffect(() => {
    if (!priceId || !planId || !purchaseType) {
      navigate('/', { replace: true });
    }
  }, [priceId, planId, purchaseType, navigate]);

  // Create a unique key for each checkout attempt to force re-mount
  const checkoutKey = useMemo(() => {
    return `${priceId}-${planId}-${Date.now()}`;
  }, [priceId, planId]);

  const fetchClientSecret = useCallback(async () => {
    console.log('[Checkout] Fetching client secret...', { priceId, planId, purchaseType, couponCode });
    setError(null);
    setLoading(true);
    
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId,
          planId,
          purchaseType,
          couponCode,
        },
      });

      console.log('[Checkout] Response:', { data, invokeError });

      if (invokeError) {
        console.error('[Checkout] Invoke error:', invokeError);
        setError(invokeError.message);
        throw new Error(invokeError.message);
      }

      if (!data || !data.clientSecret) {
        console.error('[Checkout] No clientSecret in response:', data);
        setError('Não foi possível iniciar o checkout');
        throw new Error('No clientSecret in response');
      }

      console.log('[Checkout] Got clientSecret:', data.clientSecret.substring(0, 50) + '...');
      setLoading(false);
      return data.clientSecret;
    } catch (err) {
      console.error('[Checkout] Error:', err);
      setLoading(false);
      throw err;
    }
  }, [priceId, planId, purchaseType, couponCode]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !priceId || !planId || !purchaseType) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => navigate('/')}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>
          </div>
          <div className="flex items-center gap-2.5">
            <img src={logoImage} alt="Mais Créditos" className="w-8 h-8 object-contain" />
            <span className="font-display font-bold text-lg">Mais Créditos</span>
          </div>
          <div className="w-20" /> {/* Spacer for centering */}
        </div>
      </header>

      {/* Checkout Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Finalizar Compra</h1>
          <p className="text-muted-foreground">
            {purchaseType === 'new_account' ? 'Conta Nova' : 'Recarga de Créditos'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando checkout...</span>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border shadow-sm overflow-hidden">
          <EmbeddedCheckoutProvider 
            key={checkoutKey}
            stripe={stripePromise} 
            options={{ 
              fetchClientSecret,
              onComplete: () => console.log('[Checkout] Checkout completed'),
            }}
          >
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </main>
    </div>
  );
}
