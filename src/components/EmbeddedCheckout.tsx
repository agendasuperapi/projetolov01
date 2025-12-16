import { useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import {
  EmbeddedCheckoutProvider,
  EmbeddedCheckout,
} from '@stripe/react-stripe-js';
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';

const stripePromise = loadStripe('pk_test_51ScUIsB5jlU6MVipyrn6VrLyC0DVv5sQCGRAkSFOK2Ndlovwl0a12l8GsguXvPkAA3AhlTKrQBAKPh5SusTxQM9t00qT2IDmkD');

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
  const fetchClientSecret = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke('create-checkout', {
      body: {
        priceId,
        planId,
        purchaseType,
        couponCode,
      },
    });

    if (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }

    return data.clientSecret;
  }, [priceId, planId, purchaseType, couponCode]);

  const options = { fetchClientSecret };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        <div className="p-4">
          {open && (
            <EmbeddedCheckoutProvider stripe={stripePromise} options={options}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
