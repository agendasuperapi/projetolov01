import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

export default function CouponHandler() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const validateCoupon = async () => {
      if (!code) {
        navigate('/', { replace: true });
        return;
      }

      try {
        const response = await fetch(
          'https://adpnzkvzvjbervzrqhhx.supabase.co/rest/v1/rpc/validate_coupon',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkcG56a3Z6dmpiZXJ2enJxaGh4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1MDAzODYsImV4cCI6MjA3OTA3NjM4Nn0.N7gETUDWj95yDCYdZTYWPoMJQcdx_Yjl51jxK-O1vrE',
            },
            body: JSON.stringify({ 
              p_coupon_code: code.trim(),
              p_product_id: '9453f6dc-5257-43d9-9b04-3bdfd5188ed1'
            }),
          }
        );
        
        const responseData = await response.json();
        const data = Array.isArray(responseData) ? responseData[0] : responseData;

        if (data && data.coupon_id && data.is_active) {
          // Coupon is valid, navigate to index with coupon data
          navigate('/', { 
            replace: true, 
            state: { couponData: data } 
          });
        } else {
          // Not a valid coupon, just go to index
          navigate('/', { replace: true });
        }
      } catch {
        // Error validating, just go to index
        navigate('/', { replace: true });
      }
    };

    validateCoupon();
  }, [code, navigate]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Verificando...</p>
        </div>
      </div>
    );
  }

  return null;
}
