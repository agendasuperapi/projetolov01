import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RefreshCw, CheckCircle, Clock, ExternalLink, Bell, Search, Filter, MoreHorizontal, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface RechargeRequest {
  id: string;
  user_id: string;
  plan_id: string;
  recharge_link: string;
  status: string;
  credits_added: number;
  created_at: string;
  completed_at: string | null;
  user?: { name: string; email: string; phone: string | null } | null;
  plan?: { name: string } | null;
}

type StatusFilter = 'all' | 'pending_link' | 'pending' | 'completed' | 'canceled';

// Função para tocar som de notificação
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
    oscillator.frequency.setValueAtTime(1174.66, audioContext.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.2);
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.4);
  } catch (error) {
    console.log('Erro ao tocar som:', error);
  }
};

// Função para enviar notificação push do navegador
const sendBrowserNotification = (title: string, body: string) => {
  if (!('Notification' in window)) {
    console.log('Este navegador não suporta notificações');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'recharge-notification',
      requireInteraction: true,
    });
  } else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') {
        new Notification(title, {
          body,
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          tag: 'recharge-notification',
          requireInteraction: true,
        });
      }
    });
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case 'pending_link':
      return <Badge variant="outline" className="text-orange-500 border-orange-500/50">Aguardando Link</Badge>;
    case 'pending':
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">Pendente</Badge>;
    case 'completed':
      return <Badge variant="outline" className="text-green-500 border-green-500/50">Concluído</Badge>;
    case 'canceled':
      return <Badge variant="outline" className="text-red-500 border-red-500/50">Cancelado</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const getStatusIcon = (status: StatusFilter) => {
  switch (status) {
    case 'pending_link':
      return <RefreshCw className="w-4 h-4 text-orange-500" />;
    case 'pending':
      return <Clock className="w-4 h-4 text-yellow-500" />;
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-green-500" />;
    case 'canceled':
      return <XCircle className="w-4 h-4 text-red-500" />;
    default:
      return <Filter className="w-4 h-4" />;
  }
};

export default function RechargeManager() {
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const previousPendingCount = useRef<number>(0);
  const isInitialLoad = useRef(true);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    fetchRecharges();

    const channel = supabase
      .channel('recharge-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'recharge_requests'
        },
        (payload) => {
          console.log('Nova recarga recebida:', payload);
          playNotificationSound();
          sendBrowserNotification(
            '🔔 Nova Recarga!',
            'Uma nova solicitação de recarga foi adicionada.'
          );
          toast.info('Nova solicitação de recarga!', {
            description: 'Uma nova recarga foi adicionada.',
            icon: <Bell className="w-4 h-4" />,
          });
          fetchRecharges();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'recharge_requests'
        },
        (payload) => {
          console.log('Recarga atualizada:', payload);
          const newData = payload.new as RechargeRequest;
          const oldData = payload.old as Partial<RechargeRequest>;
          
          // Notifica quando link é cadastrado (status muda de pending_link para pending)
          if (oldData.status === 'pending_link' && newData.status === 'pending') {
            playNotificationSound();
            sendBrowserNotification(
              '🔗 Link Cadastrado!',
              'Um usuário cadastrou o link de recarga. Recarga pronta para processamento.'
            );
            toast.warning('Link de recarga cadastrado!', {
              description: 'Uma recarga está pronta para processamento.',
              icon: <Bell className="w-4 h-4" />,
            });
          }
          
          fetchRecharges();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchRecharges = async () => {
    const { data } = await supabase
      .from('recharge_requests')
      .select('*')
      .order('created_at', { ascending: false });

    if (data && data.length > 0) {
      const userIds = [...new Set(data.map(r => r.user_id))];
      const planIds = [...new Set(data.map(r => r.plan_id))];

      const [profilesRes, plansRes] = await Promise.all([
        supabase.from('profiles').select('id, name, email, phone').in('id', userIds),
        supabase.from('credit_plans').select('id, name').in('id', planIds)
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
      const planMap = new Map(plansRes.data?.map(p => [p.id, p]) || []);

      setRecharges(data.map(r => ({
        ...r,
        user: profileMap.get(r.user_id) || null,
        plan: planMap.get(r.plan_id) || null
      })));

      const pendingCount = data.filter(r => r.status === 'pending').length;
      
      if (isInitialLoad.current && pendingCount > 0) {
        playNotificationSound();
        sendBrowserNotification(
          `⚠️ ${pendingCount} Recarga(s) Pendente(s)`,
          'Há recargas aguardando processamento.'
        );
        toast.warning(`${pendingCount} recarga(s) pendente(s)!`, {
          description: 'Há recargas aguardando processamento.',
          icon: <Bell className="w-4 h-4" />,
          duration: 5000,
        });
      } else if (!isInitialLoad.current && pendingCount > previousPendingCount.current) {
        playNotificationSound();
        sendBrowserNotification(
          '🔔 Nova Recarga Pendente!',
          'Uma recarga está pronta para processamento.'
        );
        toast.warning('Nova recarga pendente!', {
          description: 'Uma recarga está pronta para processamento.',
          icon: <Bell className="w-4 h-4" />,
        });
      }

      previousPendingCount.current = pendingCount;
      isInitialLoad.current = false;
    } else {
      setRecharges([]);
    }
  };

  const handleChangeStatus = async (rechargeId: string, newStatus: string) => {
    setLoading(true);
    try {
      const updateData: { status: string; completed_at?: string | null } = { status: newStatus };
      
      if (newStatus === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }

      const { error } = await supabase
        .from('recharge_requests')
        .update(updateData)
        .eq('id', rechargeId);

      if (error) throw error;

      const statusLabels: Record<string, string> = {
        pending: 'pendente',
        completed: 'concluído',
        canceled: 'cancelado'
      };

      toast.success(`Status alterado para ${statusLabels[newStatus] || newStatus}!`);
      await fetchRecharges();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar status');
    } finally {
      setLoading(false);
    }
  };

  // Filter recharges based on search and status
  const filteredRecharges = recharges.filter(r => {
    const matchesSearch = searchTerm === '' || 
      r.user?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.user?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.user?.phone?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Count by status
  const counts = {
    all: recharges.length,
    pending_link: recharges.filter(r => r.status === 'pending_link').length,
    pending: recharges.filter(r => r.status === 'pending').length,
    completed: recharges.filter(r => r.status === 'completed').length,
    canceled: recharges.filter(r => r.status === 'canceled').length,
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-primary" />
            Gerenciador de Recargas
          </CardTitle>
          <CardDescription>Gerencie todas as solicitações de recarga</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Pesquisar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as StatusFilter)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <div className="flex items-center gap-2">
                    <Filter className="w-4 h-4" />
                    Todos ({counts.all})
                  </div>
                </SelectItem>
                <SelectItem value="pending_link">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="w-4 h-4 text-orange-500" />
                    Aguardando Link ({counts.pending_link})
                  </div>
                </SelectItem>
                <SelectItem value="pending">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-yellow-500" />
                    Pendentes ({counts.pending})
                  </div>
                </SelectItem>
                <SelectItem value="completed">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    Concluídos ({counts.completed})
                  </div>
                </SelectItem>
                <SelectItem value="canceled">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-4 h-4 text-red-500" />
                    Cancelados ({counts.canceled})
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Mostrando {filteredRecharges.length} de {recharges.length} recargas
          </div>

          {/* Table / Cards */}
          {filteredRecharges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma recarga encontrada.</p>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Plano</TableHead>
                      <TableHead>Créditos</TableHead>
                      <TableHead>Link</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecharges.map((recharge) => (
                      <TableRow key={recharge.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{recharge.user?.name || 'Usuário'}</p>
                            <p className="text-sm text-muted-foreground">{recharge.user?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm">{recharge.user?.phone || '-'}</span>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{recharge.plan?.name || 'Plano'}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">+{recharge.credits_added}</Badge>
                        </TableCell>
                        <TableCell>
                          {recharge.recharge_link ? (
                            <a 
                              href={recharge.recharge_link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline text-sm"
                            >
                              <ExternalLink className="w-3 h-3" />
                              Abrir
                            </a>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(recharge.status)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {new Date(recharge.created_at).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell>
                          {recharge.status !== 'pending_link' ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" disabled={loading}>
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                {recharge.status !== 'pending' && (
                                  <DropdownMenuItem onClick={() => handleChangeStatus(recharge.id, 'pending')}>
                                    <Clock className="w-4 h-4 mr-2 text-yellow-500" />
                                    Marcar como Pendente
                                  </DropdownMenuItem>
                                )}
                                {recharge.status !== 'completed' && (
                                  <DropdownMenuItem onClick={() => handleChangeStatus(recharge.id, 'completed')}>
                                    <CheckCircle className="w-4 h-4 mr-2 text-green-500" />
                                    Marcar como Concluído
                                  </DropdownMenuItem>
                                )}
                                {recharge.status !== 'canceled' && (
                                  <DropdownMenuItem onClick={() => handleChangeStatus(recharge.id, 'canceled')}>
                                    <XCircle className="w-4 h-4 mr-2 text-red-500" />
                                    Marcar como Cancelado
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile Cards */}
              <div className="md:hidden space-y-3">
                {filteredRecharges.map((recharge) => (
                  <div key={recharge.id} className="p-4 border rounded-lg bg-card space-y-3">
                    {/* Header: Nome, status e badge */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{recharge.user?.name || 'Usuário'}</p>
                        <p className="text-sm text-muted-foreground truncate">{recharge.user?.email}</p>
                        {recharge.user?.phone && (
                          <p className="text-xs text-muted-foreground">{recharge.user?.phone}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {getStatusBadge(recharge.status)}
                      </div>
                    </div>

                    {/* Info row: Plano e Créditos */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{recharge.plan?.name || 'Plano'}</Badge>
                      <Badge variant="secondary">+{recharge.credits_added} créditos</Badge>
                    </div>

                    {/* Link e Data */}
                    <div className="flex items-center justify-between text-sm">
                      {recharge.recharge_link ? (
                        <a 
                          href={recharge.recharge_link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          Abrir Link
                        </a>
                      ) : (
                        <span className="text-muted-foreground">Sem link</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(recharge.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    {/* Actions */}
                    {recharge.status !== 'pending_link' && (
                      <div className="pt-2 border-t flex gap-2 flex-wrap">
                        {recharge.status !== 'pending' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChangeStatus(recharge.id, 'pending')}
                            disabled={loading}
                            className="flex-1 gap-1"
                          >
                            <Clock className="w-3 h-3 text-yellow-500" />
                            Pendente
                          </Button>
                        )}
                        {recharge.status !== 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChangeStatus(recharge.id, 'completed')}
                            disabled={loading}
                            className="flex-1 gap-1"
                          >
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            Concluído
                          </Button>
                        )}
                        {recharge.status !== 'canceled' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleChangeStatus(recharge.id, 'canceled')}
                            disabled={loading}
                            className="flex-1 gap-1"
                          >
                            <XCircle className="w-3 h-3 text-red-500" />
                            Cancelado
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
