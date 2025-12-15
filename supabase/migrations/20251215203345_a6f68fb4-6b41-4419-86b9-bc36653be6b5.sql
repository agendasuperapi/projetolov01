-- Enable REPLICA IDENTITY FULL for recharge_requests to capture complete row data
ALTER TABLE public.recharge_requests REPLICA IDENTITY FULL;

-- Add recharge_requests to the realtime publication (if not already added)
ALTER PUBLICATION supabase_realtime ADD TABLE public.recharge_requests;