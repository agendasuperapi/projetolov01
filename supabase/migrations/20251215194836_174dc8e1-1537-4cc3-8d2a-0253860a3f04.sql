-- Add RLS policy for admins to view all payment transactions
CREATE POLICY "Admins can view all transactions" 
ON public.payment_transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));