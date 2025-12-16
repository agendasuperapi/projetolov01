-- Enable realtime for support_tickets
ALTER TABLE public.support_tickets REPLICA IDENTITY FULL;

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;

-- Enable realtime for support_messages
ALTER TABLE public.support_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_messages;