import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Send, CheckCircle, XCircle, Clock, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';

interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  ticket_type: string;
  priority: string;
  status: TicketStatus;
  created_at: string;
  rating: number | null;
  user_id: string;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_id: string;
}

interface Profile {
  id: string;
  name: string;
  email: string;
}

interface AdminTicketModalProps {
  ticketId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

const statusLabels: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  waiting_user: 'Aguardando Usuário',
  resolved: 'Resolvido',
  closed: 'Encerrado',
};

const statusColors: Record<TicketStatus, string> = {
  open: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  waiting_user: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-muted text-muted-foreground border-border',
};

export default function AdminTicketModal({ ticketId, onClose, onUpdate }: AdminTicketModalProps) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ticketId) {
      loadTicket();
      loadMessages();
    }
  }, [ticketId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTicket = async () => {
    if (!ticketId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .eq('id', ticketId)
        .single();

      if (error) throw error;
      setTicket(data);

      // Load user profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', data.user_id)
        .single();

      if (profile) {
        setProfiles(new Map([[profile.id, profile]]));
      }
    } catch (error) {
      console.error('Error loading ticket:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async () => {
    if (!ticketId) return;
    try {
      const { data, error } = await supabase
        .from('support_messages')
        .select('*')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);

      // Load profiles for all message authors
      const userIds = [...new Set(data?.map(m => m.user_id) || [])];
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      if (profilesData) {
        setProfiles(new Map(profilesData.map(p => [p.id, p])));
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const sendMessage = async () => {
    if (!user || !ticketId || !newMessage.trim()) return;

    setSending(true);
    try {
      const { error } = await supabase.from('support_messages').insert({
        ticket_id: ticketId,
        user_id: user.id,
        message: newMessage.trim(),
        is_admin: true,
      });

      if (error) throw error;

      // Update ticket status to in_progress if it was open
      if (ticket?.status === 'open') {
        await supabase
          .from('support_tickets')
          .update({ status: 'in_progress' })
          .eq('id', ticketId);
      }

      setNewMessage('');
      loadMessages();
      onUpdate();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const updateStatus = async (status: TicketStatus) => {
    if (!ticketId) return;

    try {
      const updateData: any = { status };
      if (status === 'closed' || status === 'resolved') {
        updateData.closed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('support_tickets')
        .update(updateData)
        .eq('id', ticketId);

      if (error) throw error;

      toast.success(`Status atualizado para ${statusLabels[status]}`);
      loadTicket();
      onUpdate();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!ticketId) return null;

  const userProfile = ticket ? profiles.get(ticket.user_id) : null;
  const isClosed = ticket?.status === 'closed';

  return (
    <Dialog open={!!ticketId} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-4 pb-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                #{ticket?.ticket_number ? String(ticket.ticket_number).padStart(3, '0') : '...'}
              </span>
              {ticket && (
                <Badge className={statusColors[ticket.status]}>
                  {statusLabels[ticket.status]}
                </Badge>
              )}
            </div>
          </div>
          {userProfile && (
            <p className="text-sm text-muted-foreground">{userProfile.name} • {userProfile.email}</p>
          )}
          <DialogTitle className="text-left">{ticket?.subject || 'Carregando...'}</DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[350px] bg-muted/20">
          {loading ? (
            <div className="text-center text-muted-foreground">Carregando...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground">
              Nenhuma mensagem ainda.
            </div>
          ) : (
            messages.map((msg) => {
              const msgProfile = profiles.get(msg.user_id);
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.is_admin ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      msg.is_admin
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-card border border-border'
                    }`}
                  >
                    {!msg.is_admin && msgProfile && (
                      <p className="text-xs font-medium mb-1">{msgProfile.name}</p>
                    )}
                    <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                    <p
                      className={`text-xs mt-1 ${
                        msg.is_admin ? 'text-primary-foreground/70' : 'text-muted-foreground'
                      }`}
                    >
                      {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Rating Display */}
        {ticket?.rating && (
          <div className="px-4 py-2 border-t border-border bg-card/50">
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm text-muted-foreground">Avaliação do usuário:</span>
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`h-4 w-4 ${i < ticket.rating! ? 'fill-amber-400 text-amber-400' : 'text-muted'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        {!isClosed && (
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <Textarea
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyPress}
                className="min-h-[60px] resize-none"
                disabled={sending}
              />
              <Button
                onClick={sendMessage}
                disabled={sending || !newMessage.trim()}
                size="icon"
                className="h-[60px] w-[60px]"
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatus('resolved')}
                className="gap-1"
              >
                <CheckCircle className="h-4 w-4 text-green-500" />
                Marcar Solucionado
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatus('waiting_user')}
                className="gap-1"
              >
                <Clock className="h-4 w-4 text-amber-500" />
                Aguardar Usuário
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => updateStatus('closed')}
                className="gap-1"
              >
                <XCircle className="h-4 w-4 text-red-500" />
                Encerrar
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
