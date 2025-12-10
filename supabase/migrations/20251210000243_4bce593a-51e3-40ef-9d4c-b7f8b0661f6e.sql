-- 1. Add INSERT policy to profiles table - users can only insert their own profile
CREATE POLICY "Users can insert own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);

-- 2. Add UPDATE policy to accounts table - only admins can update accounts
CREATE POLICY "Only admins can update accounts"
ON public.accounts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Block direct INSERT on payment_transactions - only service role can insert
CREATE POLICY "Block direct insert on payment_transactions"
ON public.payment_transactions
FOR INSERT
WITH CHECK (false);