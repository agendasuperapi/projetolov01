import { useCallback, useState, useMemo } from 'react';
import { loadStripe, Appearance } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

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

interface EmbeddedCheckoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  priceId: string;
  planId: string;
  purchaseType: 'new_account' | 'recharge';
  couponCode?: string | null;
}

export default function EmbeddedCheckoutModal({
  open,
  onOpenChange,
  priceId,
  planId,
  purchaseType,
  couponCode,
}: EmbeddedCheckoutModalProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Create a unique key for each checkout attempt to force re-mount
  const checkoutKey = useMemo(() => {
    return `${priceId}-${planId}-${Date.now()}`;
  }, [priceId, planId, open]);

  const fetchClientSecret = useCallback(async () => {
    console.log('[EmbeddedCheckout] Fetching client secret...', { priceId, planId, purchaseType, couponCode });
    setError(null);
    setLoading(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw new Error(sessionError.message);
      }

      if (!session?.access_token) {
        throw new Error('Você precisa estar logado para continuar com o pagamento.');
      }

      const { data, error: invokeError } = await supabase.functions.invoke('create-checkout', {
        body: {
          priceId,
          planId,
          purchaseType,
          couponCode,
        },
      });

      console.log('[EmbeddedCheckout] Response:', { data, invokeError });

      if (invokeError) {
        console.error('[EmbeddedCheckout] Invoke error:', invokeError);
        setError(invokeError.message);
        throw new Error(invokeError.message);
      }

      if (!data || !data.clientSecret) {
        console.error('[EmbeddedCheckout] No clientSecret in response:', data);
        setError('Não foi possível iniciar o checkout');
        throw new Error('No clientSecret in response');
      }

      console.log('[EmbeddedCheckout] Got clientSecret:', data.clientSecret.substring(0, 50) + '...');
      setLoading(false);
      return data.clientSecret;
    } catch (err) {
      console.error('[EmbeddedCheckout] Error:', err);
      setLoading(false);
      throw err;
    }
  }, [priceId, planId, purchaseType, couponCode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 border-white" aria-describedby={undefined}>
        <VisuallyHidden>
          <DialogTitle>Checkout</DialogTitle>
        </VisuallyHidden>
        <div className="p-4 min-h-[400px]">
          {error && (
            <div className="mb-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
              {error}
            </div>
          )}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Carregando checkout...</span>
            </div>
          )}
          {open && priceId && planId && (
            <EmbeddedCheckoutProvider 
              key={checkoutKey}
              stripe={stripePromise} 
              options={{ 
                fetchClientSecret,
                onComplete: () => console.log('[EmbeddedCheckout] Checkout completed'),
              }}
            >
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
