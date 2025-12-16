import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, Clock, CheckCircle, AlertCircle, Plus, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NewTicketModal from '@/components/support/NewTicketModal';
import TicketDetailModal from '@/components/support/TicketDetailModal';
import { useNavigate } from 'react-router-dom';

type TicketStatus = 'open' | 'in_progress' | 'waiting_user' | 'resolved' | 'closed';
type TicketType = 'problem' | 'suggestion' | 'complaint' | 'question' | 'financial' | 'technical' | 'other';
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';

interface Ticket {
  id: string;
  ticket_number: number;
  subject: string;
  ticket_type: TicketType;
  priority: TicketPriority;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
  rating: number | null;
  last_message?: string;
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

const typeLabels: Record<TicketType, string> = {
  problem: 'Problema',
  suggestion: 'Sugestão',
  complaint: 'Reclamação',
  question: 'Dúvida',
  financial: 'Financeiro',
  technical: 'Técnico',
  other: 'Outro',
};

export default function Support() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | TicketStatus>('all');
  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user) {
      loadTickets();
    }
  }, [user]);

  const loadTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setTickets(data || []);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = filter === 'all' 
    ? tickets 
    : tickets.filter(t => t.status === filter);

  const stats = {
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    waiting: tickets.filter(t => t.status === 'waiting_user').length,
    resolved: tickets.filter(t => t.status === 'resolved' || t.status === 'closed').length,
  };

  if (authLoading || !user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Suporte</h1>
            <p className="text-muted-foreground">Abra chamados e acompanhe suas solicitações</p>
          </div>
          <Button onClick={() => setIsNewTicketOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Novo Chamado
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-4 border-border/50 bg-card/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <MessageSquare className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border/50 bg-card/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/20">
                <Clock className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.open}</p>
                <p className="text-sm text-muted-foreground">Abertos</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border/50 bg-card/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20">
                <AlertCircle className="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.waiting}</p>
                <p className="text-sm text-muted-foreground">Aguardando</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 border-border/50 bg-card/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/20">
                <CheckCircle className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.resolved}</p>
                <p className="text-sm text-muted-foreground">Resolvidos</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-6">
          <TabsList className="bg-card border border-border/50">
            <TabsTrigger value="all">Todos</TabsTrigger>
            <TabsTrigger value="open">Abertos</TabsTrigger>
            <TabsTrigger value="in_progress">Em Andamento</TabsTrigger>
            <TabsTrigger value="waiting_user">Aguardando Você</TabsTrigger>
            <TabsTrigger value="resolved">Resolvidos</TabsTrigger>
            <TabsTrigger value="closed">Encerrados</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Tickets List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredTickets.length === 0 ? (
            <Card className="p-8 text-center border-border/50 bg-card/50">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum chamado encontrado</p>
              <Button onClick={() => setIsNewTicketOpen(true)} className="mt-4">
                Criar primeiro chamado
              </Button>
            </Card>
          ) : (
            filteredTickets.map((ticket) => (
              <Card
                key={ticket.id}
                className="p-4 border-border/50 bg-card/50 hover:bg-card/80 cursor-pointer transition-colors"
                onClick={() => setSelectedTicket(ticket.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">
                        #{String(ticket.ticket_number).padStart(3, '0')}
                      </span>
                      <Badge className={statusColors[ticket.status]}>
                        {statusLabels[ticket.status]}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-foreground mb-1">{ticket.subject}</h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{typeLabels[ticket.ticket_type]}</span>
                      <span>•</span>
                      <span>{format(new Date(ticket.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
                    </div>
                  </div>
                  {ticket.rating && (
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star
                          key={i}
                          className={`h-4 w-4 ${i < ticket.rating! ? 'fill-amber-400 text-amber-400' : 'text-muted'}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>

        <NewTicketModal
          open={isNewTicketOpen}
          onOpenChange={setIsNewTicketOpen}
          onSuccess={() => {
            loadTickets();
            setIsNewTicketOpen(false);
          }}
        />

        <TicketDetailModal
          ticketId={selectedTicket}
          onClose={() => setSelectedTicket(null)}
          onUpdate={loadTickets}
        />
      </div>
    </div>
  );
}
