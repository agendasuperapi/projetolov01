-- Allow users to update their own recharge requests (to add recharge_link)
CREATE POLICY "Users can update own recharge requests" 
ON public.recharge_requests 
FOR UPDATE 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);