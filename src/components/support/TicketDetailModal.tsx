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
import { Send, X, Star } from 'lucide-react';
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
  rating_comment: string | null;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  user_id: string;
}

interface TicketDetailModalProps {
  ticketId: string | null;
  onClose: () => void;
  onUpdate: () => void;
}

const statusLabels: Record<TicketStatus, string> = {
  open: 'Aberto',
  in_progress: 'Em Andamento',
  waiting_user: 'Aguardando Você',
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

export default function TicketDetailModal({ ticketId, onClose, onUpdate }: TicketDetailModalProps) {
  const { user } = useAuth();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [rating, setRating] = useState(0);
  const [showRating, setShowRating] = useState(false);
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
        is_admin: false,
      });

      if (error) throw error;

      setNewMessage('');
      loadMessages();
    } catch (error: any) {
      console.error('Error sending message:', error);
      toast.error('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const closeTicket = async () => {
    if (!ticketId) return;
    
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      toast.success('Chamado encerrado');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error closing ticket:', error);
      toast.error('Erro ao encerrar chamado');
    }
  };

  const submitRating = async () => {
    if (!ticketId || rating === 0) return;

    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ rating, status: 'closed', closed_at: new Date().toISOString() })
        .eq('id', ticketId);

      if (error) throw error;

      toast.success('Obrigado pelo feedback!');
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error submitting rating:', error);
      toast.error('Erro ao enviar avaliação');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (!ticketId) return null;

  const isClosed = ticket?.status === 'closed' || ticket?.status === 'resolved';

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
          <DialogTitle className="text-left">{ticket?.subject || 'Carregando...'}</DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[300px] max-h-[400px] bg-muted/20">
          {loading ? (
            <div className="text-center text-muted-foreground">Carregando...</div>
          ) : messages.length === 0 ? (
            <div className="text-center text-muted-foreground">
              Nenhuma mensagem ainda. Envie uma mensagem para iniciar a conversa.
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.user_id === user?.id ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    msg.user_id === user?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-card border border-border'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                  <p
                    className={`text-xs mt-1 ${
                      msg.user_id === user?.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    }`}
                  >
                    {format(new Date(msg.created_at), 'HH:mm', { locale: ptBR })}
                  </p>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Rating Section */}
        {isClosed && !ticket?.rating && (
          <div className="p-4 border-t border-border bg-card">
            <p className="text-sm text-center mb-3">Como foi seu atendimento?</p>
            <div className="flex justify-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  className="p-1 hover:scale-110 transition-transform"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating ? 'fill-amber-400 text-amber-400' : 'text-muted'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating > 0 && (
              <Button onClick={submitRating} className="w-full">
                Enviar Avaliação
              </Button>
            )}
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
            <div className="mt-3">
              <Button variant="outline" onClick={closeTicket} className="w-full">
                Encerrar Chamado
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
