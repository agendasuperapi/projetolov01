import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, Eye, Search, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface StripeEvent {
  id: string;
  event_id: string;
  event_type: string;
  event_data: any;
  processed: boolean;
  created_at: string;
  user_id: string | null;
  plan_id: string | null;
  product_id: string | null;
  email: string | null;
  environment: string | null;
  affiliate_id: string | null;
  affiliate_coupon_id: string | null;
}

const EVENT_TYPES = [
  { value: 'all', label: 'Todos os eventos' },
  { value: 'checkout.session.completed', label: 'Checkout Concluído' },
  { value: 'checkout.session.expired', label: 'Checkout Expirado' },
  { value: 'payment_intent.succeeded', label: 'Pagamento Sucesso' },
  { value: 'payment_intent.payment_failed', label: 'Pagamento Falhou' },
  { value: 'customer.created', label: 'Cliente Criado' },
  { value: 'invoice.paid', label: 'Fatura Paga' },
  { value: 'invoice.payment_failed', label: 'Fatura Falhou' },
];

export default function StripeEventsManager() {
  const [events, setEvents] = useState<StripeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<StripeEvent | null>(null);
  const [filters, setFilters] = useState({
    eventType: 'all',
    environment: 'all',
    search: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    fetchEvents();
  }, [filters.eventType, filters.environment, filters.dateFrom, filters.dateTo]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('stripe_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (filters.eventType !== 'all') {
        query = query.eq('event_type', filters.eventType);
      }

      if (filters.environment !== 'all') {
        query = query.eq('environment', filters.environment);
      }

      if (filters.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }

      if (filters.dateTo) {
        query = query.lte('created_at', `${filters.dateTo}T23:59:59`);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching stripe events:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEvents = events.filter(event => {
    if (!filters.search) return true;
    const searchLower = filters.search.toLowerCase();
    return (
      event.event_id.toLowerCase().includes(searchLower) ||
      event.event_type.toLowerCase().includes(searchLower) ||
      event.email?.toLowerCase().includes(searchLower) ||
      event.user_id?.toLowerCase().includes(searchLower)
    );
  });

  const getEventTypeBadge = (eventType: string) => {
    if (eventType.includes('completed') || eventType.includes('succeeded') || eventType.includes('paid')) {
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">{eventType}</Badge>;
    }
    if (eventType.includes('failed') || eventType.includes('expired')) {
      return <Badge variant="destructive">{eventType}</Badge>;
    }
    return <Badge variant="secondary">{eventType}</Badge>;
  };

  const getEnvironmentBadge = (env: string | null) => {
    if (env === 'production') {
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Produção</Badge>;
    }
    return <Badge variant="outline">Teste</Badge>;
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Eventos do Stripe</CardTitle>
            <CardDescription>Visualize todos os eventos recebidos do webhook</CardDescription>
          </div>
          <Button variant="outline" onClick={fetchEvents} disabled={loading} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por ID, email..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-9"
            />
          </div>

          <Select
            value={filters.eventType}
            onValueChange={(value) => setFilters({ ...filters, eventType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Tipo de evento" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.environment}
            onValueChange={(value) => setFilters({ ...filters, environment: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ambiente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ambientes</SelectItem>
              <SelectItem value="test">Teste</SelectItem>
              <SelectItem value="production">Produção</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="pl-9"
              placeholder="Data inicial"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="pl-9"
              placeholder="Data final"
            />
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-muted/50">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Total de eventos</p>
              <p className="text-2xl font-bold">{filteredEvents.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-green-500/10">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Sucesso</p>
              <p className="text-2xl font-bold text-green-400">
                {filteredEvents.filter(e => e.event_type.includes('completed') || e.event_type.includes('succeeded') || e.event_type.includes('paid')).length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-red-500/10">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Falhas</p>
              <p className="text-2xl font-bold text-red-400">
                {filteredEvents.filter(e => e.event_type.includes('failed') || e.event_type.includes('expired')).length}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-orange-500/10">
            <CardContent className="p-4">
              <p className="text-sm text-muted-foreground">Produção</p>
              <p className="text-2xl font-bold text-orange-400">
                {filteredEvents.filter(e => e.environment === 'production').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Table */}
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Ambiente</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Carregando eventos...
                  </TableCell>
                </TableRow>
              ) : filteredEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum evento encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filteredEvents.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(event.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>{getEventTypeBadge(event.event_type)}</TableCell>
                    <TableCell>{getEnvironmentBadge(event.environment)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {event.email || '-'}
                    </TableCell>
                    <TableCell>
                      {event.processed ? (
                        <Badge variant="outline" className="text-green-400 border-green-500/30">Processado</Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-400 border-yellow-500/30">Pendente</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedEvent(event)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Event Detail Dialog */}
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Detalhes do Evento</DialogTitle>
            </DialogHeader>
            {selectedEvent && (
              <ScrollArea className="h-[60vh]">
                <div className="space-y-4 pr-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Event ID</p>
                      <p className="font-mono text-sm break-all">{selectedEvent.event_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Tipo</p>
                      {getEventTypeBadge(selectedEvent.event_type)}
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Data</p>
                      <p>{format(new Date(selectedEvent.created_at), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Ambiente</p>
                      {getEnvironmentBadge(selectedEvent.environment)}
                    </div>
                    {selectedEvent.email && (
                      <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p>{selectedEvent.email}</p>
                      </div>
                    )}
                    {selectedEvent.user_id && (
                      <div>
                        <p className="text-sm text-muted-foreground">User ID</p>
                        <p className="font-mono text-sm break-all">{selectedEvent.user_id}</p>
                      </div>
                    )}
                    {selectedEvent.plan_id && (
                      <div>
                        <p className="text-sm text-muted-foreground">Plan ID</p>
                        <p className="font-mono text-sm break-all">{selectedEvent.plan_id}</p>
                      </div>
                    )}
                    {selectedEvent.affiliate_id && (
                      <div>
                        <p className="text-sm text-muted-foreground">Affiliate ID</p>
                        <p className="font-mono text-sm break-all">{selectedEvent.affiliate_id}</p>
                      </div>
                    )}
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Dados do Evento (JSON)</p>
                    <pre className="bg-muted p-4 rounded-lg text-xs overflow-auto max-h-[300px]">
                      {JSON.stringify(selectedEvent.event_data, null, 2)}
                    </pre>
                  </div>
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
