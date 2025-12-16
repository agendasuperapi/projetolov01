import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageSquare, Clock, Users, AlertTriangle, Search, Star } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AdminTicketModal from './AdminTicketModal';

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
  user_id: string;
  user_email?: string;
  user_name?: string;
  messages_count?: number;
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

const typeLabels: Record<TicketType, string> = {
  problem: 'Problema',
  suggestion: 'Sugestão',
  complaint: 'Reclamação',
  question: 'Dúvida',
  financial: 'Financeiro',
  technical: 'Técnico',
  other: 'Outro',
};

const priorityLabels: Record<TicketPriority, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  urgent: 'Urgente',
};

const priorityColors: Record<TicketPriority, string> = {
  low: 'bg-muted text-muted-foreground',
  normal: 'bg-blue-500/20 text-blue-400',
  high: 'bg-amber-500/20 text-amber-400',
  urgent: 'bg-red-500/20 text-red-400',
};

export default function SupportManager() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedTicket, setSelectedTicket] = useState<string | null>(null);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    try {
      // Load tickets with user info
      const { data: ticketsData, error: ticketsError } = await supabase
        .from('support_tickets')
        .select('*')
        .order('updated_at', { ascending: false });

      if (ticketsError) throw ticketsError;

      // Load profiles to get user names/emails
      const userIds = [...new Set(ticketsData?.map(t => t.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      const enrichedTickets = ticketsData?.map(ticket => ({
        ...ticket,
        user_name: profilesMap.get(ticket.user_id)?.name,
        user_email: profilesMap.get(ticket.user_id)?.email,
      })) || [];

      setTickets(enrichedTickets);
    } catch (error) {
      console.error('Error loading tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesSearch =
      search === '' ||
      ticket.subject.toLowerCase().includes(search.toLowerCase()) ||
      ticket.user_name?.toLowerCase().includes(search.toLowerCase()) ||
      ticket.user_email?.toLowerCase().includes(search.toLowerCase()) ||
      String(ticket.ticket_number).includes(search);

    const matchesStatus = statusFilter === 'all' || ticket.status === statusFilter;
    const matchesType = typeFilter === 'all' || ticket.ticket_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  const stats = {
    total: tickets.length,
    new: tickets.filter(t => t.status === 'open').length,
    unassigned: tickets.filter(t => t.status === 'open' || t.status === 'waiting_user').length,
    urgent: tickets.filter(t => t.priority === 'urgent' && t.status !== 'closed').length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Central de Suporte</h2>
        <p className="text-muted-foreground">Gerencie todos os chamados de suporte</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              <p className="text-2xl font-bold text-foreground">{stats.new}</p>
              <p className="text-sm text-muted-foreground">Novos</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-amber-500/20">
              <Users className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.unassigned}</p>
              <p className="text-sm text-muted-foreground">Sem Atribuição</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-border/50 bg-card/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{stats.urgent}</p>
              <p className="text-sm text-muted-foreground">Urgentes</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por assunto, usuário ou número..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            {Object.entries(statusLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Tipos</SelectItem>
            {Object.entries(typeLabels).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tickets List */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : filteredTickets.length === 0 ? (
          <Card className="p-8 text-center border-border/50 bg-card/50">
            <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum chamado encontrado</p>
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
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-sm font-medium text-muted-foreground">
                      #{String(ticket.ticket_number).padStart(3, '0')}
                    </span>
                    <Badge className={statusColors[ticket.status]}>
                      {statusLabels[ticket.status]}
                    </Badge>
                    <Badge className={priorityColors[ticket.priority]}>
                      {priorityLabels[ticket.priority]}
                    </Badge>
                    <Badge variant="outline">{typeLabels[ticket.ticket_type]}</Badge>
                  </div>
                  <h3 className="font-semibold text-foreground mb-1">{ticket.subject}</h3>
                  <div className="text-sm text-muted-foreground">
                    <p>{ticket.user_name} • {ticket.user_email}</p>
                    <p>
                      Criado: {format(new Date(ticket.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      {' • '}
                      Atualizado: {format(new Date(ticket.updated_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </p>
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

      <AdminTicketModal
        ticketId={selectedTicket}
        onClose={() => setSelectedTicket(null)}
        onUpdate={loadTickets}
      />
    </div>
  );
}
