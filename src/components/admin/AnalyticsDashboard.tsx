import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Users, 
  Eye, 
  MousePointerClick, 
  Timer, 
  RefreshCw, 
  TrendingUp,
  Smartphone,
  Monitor,
  Tablet,
  Globe,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, Legend } from 'recharts';

interface AnalyticsData {
  overview: {
    activeUsers: number;
    sessions: number;
    pageViews: number;
    bounceRate: number;
    avgSessionDuration: number;
    newUsers: number;
  };
  daily: Array<{
    date: string;
    users: number;
    sessions: number;
    pageViews: number;
  }>;
  devices: Array<{
    device: string;
    users: number;
  }>;
  sources: Array<{
    source: string;
    users: number;
    sessions: number;
  }>;
  pages: Array<{
    path: string;
    views: number;
    users: number;
  }>;
  period: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', '#8884d8', '#82ca9d'];

const deviceIcons: Record<string, React.ReactNode> = {
  desktop: <Monitor className="w-4 h-4" />,
  mobile: <Smartphone className="w-4 h-4" />,
  tablet: <Tablet className="w-4 h-4" />,
};

export default function AnalyticsDashboard() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7' | '30' | '90'>('30');

  const fetchAnalytics = async () => {
    setLoading(true);
    setError(null);

    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session?.session) {
        throw new Error('Não autenticado');
      }

      const { data: result, error: fnError } = await supabase.functions.invoke('ga-analytics', {
        body: { period },
        headers: {
          Authorization: `Bearer ${session.session.access_token}`,
        },
      });

      if (fnError) throw fnError;
      if (result.error) throw new Error(result.error);

      setData(result);
    } catch (err: any) {
      console.error('Error fetching analytics:', err);
      setError(err.message || 'Erro ao carregar analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [period]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr || dateStr.length !== 8) return dateStr;
    const year = dateStr.substring(0, 4);
    const month = dateStr.substring(4, 6);
    const day = dateStr.substring(6, 8);
    return `${day}/${month}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-3 text-muted-foreground">Carregando analytics...</span>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="p-6 flex flex-col items-center gap-4">
          <AlertCircle className="w-12 h-12 text-destructive" />
          <div className="text-center">
            <p className="font-medium text-destructive mb-2">Erro ao carregar analytics</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
          <Button variant="outline" onClick={fetchAnalytics}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Tentar novamente
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const dailyChartData = data.daily.map(d => ({
    ...d,
    dateFormatted: formatDate(d.date),
  }));

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Google Analytics</h2>
          <p className="text-muted-foreground">Dados de tráfego do site</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(v) => setPeriod(v as '7' | '30' | '90')}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={fetchAnalytics} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Usuários Ativos</span>
            </div>
            <p className="text-2xl font-bold">{data.overview.activeUsers.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-xs">Novos Usuários</span>
            </div>
            <p className="text-2xl font-bold">{data.overview.newUsers.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MousePointerClick className="w-4 h-4" />
              <span className="text-xs">Sessões</span>
            </div>
            <p className="text-2xl font-bold">{data.overview.sessions.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Eye className="w-4 h-4" />
              <span className="text-xs">Visualizações</span>
            </div>
            <p className="text-2xl font-bold">{data.overview.pageViews.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Timer className="w-4 h-4" />
              <span className="text-xs">Duração Média</span>
            </div>
            <p className="text-2xl font-bold">{formatDuration(data.overview.avgSessionDuration)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Globe className="w-4 h-4" />
              <span className="text-xs">Taxa de Rejeição</span>
            </div>
            <p className="text-2xl font-bold">{(data.overview.bounceRate * 100).toFixed(1)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Line Chart - Daily Users */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">Usuários por Dia</CardTitle>
            <CardDescription>Tendência de visitantes no período</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="dateFormatted" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="users" 
                    name="Usuários"
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sessions" 
                    name="Sessões"
                    stroke="hsl(var(--secondary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Devices */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dispositivos</CardTitle>
            <CardDescription>Desktop vs Mobile vs Tablet</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.devices}
                    dataKey="users"
                    nameKey="device"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ device, percent }) => `${device} ${(percent * 100).toFixed(0)}%`}
                  >
                    {data.devices.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex justify-center gap-4 mt-4">
              {data.devices.map((d, i) => (
                <div key={d.device} className="flex items-center gap-2">
                  {deviceIcons[d.device.toLowerCase()] || <Globe className="w-4 h-4" />}
                  <span className="text-sm">{d.users}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sources and Pages Row */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Bar Chart - Traffic Sources */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Fontes de Tráfego</CardTitle>
            <CardDescription>De onde vêm os visitantes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.sources} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis 
                    type="category" 
                    dataKey="source" 
                    width={100}
                    tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="users" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Table - Top Pages */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Páginas Mais Visitadas</CardTitle>
            <CardDescription>Top 10 páginas por visualizações</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Página</TableHead>
                  <TableHead className="text-right">Views</TableHead>
                  <TableHead className="text-right">Usuários</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.pages.map((page, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-sm max-w-[200px] truncate">
                      {page.path}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary">{page.views.toLocaleString()}</Badge>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {page.users.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
