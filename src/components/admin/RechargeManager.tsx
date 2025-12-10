import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, CheckCircle, Clock, ExternalLink, Bell } from 'lucide-react';
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
  user?: { name: string; email: string } | null;
  plan?: { name: string } | null;
}

// Função para tocar som de notificação
const playNotificationSound = () => {
  try {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5
    oscillator.frequency.setValueAtTime(1174.66, audioContext.currentTime + 0.1); // D6
    oscillator.frequency.setValueAtTime(1318.51, audioContext.currentTime + 0.2); // E6
    
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

export default function RechargeManager() {
  const [recharges, setRecharges] = useState<RechargeRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const previousPendingCount = useRef<number>(0);
  const isInitialLoad = useRef(true);

  // Solicitar permissão de notificação ao montar o componente
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    fetchRecharges();

    // Real-time subscription para novas recargas
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
          // Tocar som de notificação
          playNotificationSound();
          // Enviar notificação push do navegador
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
        () => {
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
        supabase.from('profiles').select('id, name, email').in('id', userIds),
        supabase.from('credit_plans').select('id, name').in('id', planIds)
      ]);

      const profileMap = new Map(profilesRes.data?.map(p => [p.id, p]) || []);
      const planMap = new Map(plansRes.data?.map(p => [p.id, p]) || []);

      setRecharges(data.map(r => ({
        ...r,
        user: profileMap.get(r.user_id) || null,
        plan: planMap.get(r.plan_id) || null
      })));

      // Contar recargas pendentes
      const pendingCount = data.filter(r => r.status === 'pending').length;
      
      // Notificar sobre recargas pendentes
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

  const handleMarkAsCompleted = async (rechargeId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('recharge_requests')
        .update({ 
          status: 'completed', 
          completed_at: new Date().toISOString() 
        })
        .eq('id', rechargeId);

      if (error) throw error;

      toast.success('Recarga marcada como concluída!');
      await fetchRecharges();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao atualizar recarga');
    } finally {
      setLoading(false);
    }
  };

  const pendingLinkRecharges = recharges.filter(r => r.status === 'pending_link');
  const pendingRecharges = recharges.filter(r => r.status === 'pending');
  const completedRecharges = recharges.filter(r => r.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Pending Link Recharges */}
      <Card className="shadow-card border-orange-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="w-5 h-5 text-orange-500" />
            Aguardando Link ({pendingLinkRecharges.length})
          </CardTitle>
          <CardDescription>Recargas pagas aguardando o link do usuário</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingLinkRecharges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma recarga aguardando link.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingLinkRecharges.map((recharge) => (
                  <TableRow key={recharge.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{recharge.user?.name || 'Usuário'}</p>
                        <p className="text-sm text-muted-foreground">{recharge.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{recharge.plan?.name || 'Plano'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">+{recharge.credits_added}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-orange-500 border-orange-500/50">
                        Aguardando Link
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(recharge.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pending Recharges */}
      <Card className="shadow-card border-yellow-500/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-yellow-500" />
            Recargas Pendentes ({pendingRecharges.length})
          </CardTitle>
          <CardDescription>Recargas com link recebido aguardando processamento</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingRecharges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma recarga pendente.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Link de Recarga</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingRecharges.map((recharge) => (
                  <TableRow key={recharge.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{recharge.user?.name || 'Usuário'}</p>
                        <p className="text-sm text-muted-foreground">{recharge.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{recharge.plan?.name || 'Plano'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">+{recharge.credits_added}</Badge>
                    </TableCell>
                    <TableCell>
                      <a 
                        href={recharge.recharge_link} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline text-sm"
                      >
                        <ExternalLink className="w-3 h-3" />
                        Abrir Link
                      </a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(recharge.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleMarkAsCompleted(recharge.id)}
                        disabled={loading}
                        className="gap-1"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Marcar Recarregado
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Completed Recharges */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Recargas Concluídas ({completedRecharges.length})
          </CardTitle>
          <CardDescription>Histórico de recargas processadas</CardDescription>
        </CardHeader>
        <CardContent>
          {completedRecharges.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma recarga concluída.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Créditos</TableHead>
                  <TableHead>Data Solicitação</TableHead>
                  <TableHead>Data Recarga</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completedRecharges.map((recharge) => (
                  <TableRow key={recharge.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{recharge.user?.name || 'Usuário'}</p>
                        <p className="text-sm text-muted-foreground">{recharge.user?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{recharge.plan?.name || 'Plano'}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">+{recharge.credits_added}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(recharge.created_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {recharge.completed_at && new Date(recharge.completed_at).toLocaleDateString('pt-BR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}