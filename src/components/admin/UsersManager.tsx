import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import { Search, RotateCcw, Eye, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UserWithRole {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  credits: number | null;
  created_at: string;
  role: string | null;
  sync_status: string | null;
  sync_response: string | null;
  synced_at: string | null;
}

const SYNC_STATUS_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'pending', label: 'Pendente' },
  { value: 'synced', label: 'Sincronizado' },
  { value: 'error', label: 'Erro' },
];

const ROLE_OPTIONS = [
  { value: 'all', label: 'Todos' },
  { value: 'user', label: 'Usuário' },
  { value: 'admin', label: 'Admin' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function UsersManager() {
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [filters, setFilters] = useState({
    search: '',
    syncStatus: 'all',
    role: 'all',
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchUsers();
  }, [currentPage, pageSize, filters.syncStatus, filters.role]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      if (currentPage === 1) {
        fetchUsers();
      } else {
        setCurrentPage(1);
      }
    }, 300);
    return () => clearTimeout(debounce);
  }, [filters.search]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // First get the total count
      let countQuery = supabase
        .from('view_users_with_roles')
        .select('*', { count: 'exact', head: true });

      if (filters.search) {
        countQuery = countQuery.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }
      if (filters.syncStatus !== 'all') {
        countQuery = countQuery.eq('sync_status', filters.syncStatus);
      }
      if (filters.role !== 'all') {
        countQuery = countQuery.eq('role', filters.role as 'admin' | 'user');
      }

      const { count } = await countQuery;
      setTotalCount(count || 0);

      // Then get the paginated data
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;

      let dataQuery = supabase
        .from('view_users_with_roles')
        .select('*')
        .order('created_at', { ascending: false })
        .range(from, to);

      if (filters.search) {
        dataQuery = dataQuery.or(`name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);
      }
      if (filters.syncStatus !== 'all') {
        dataQuery = dataQuery.eq('sync_status', filters.syncStatus);
      }
      if (filters.role !== 'all') {
        dataQuery = dataQuery.eq('role', filters.role as 'admin' | 'user');
      }

      const { data, error } = await dataQuery;

      if (error) throw error;
      setUsers((data as UserWithRole[]) || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRetrySync = async (userId: string) => {
    setRetrying(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const { error } = await supabase.functions.invoke('sync-to-external', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { user_id: userId },
      });

      if (error) throw error;

      toast({
        title: 'Sincronização enviada!',
        description: 'A sincronização foi reenviada com sucesso.',
      });
      
      await fetchUsers();
    } catch (error: any) {
      toast({
        title: 'Erro ao retentar sincronização',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setRetrying(null);
    }
  };

  const getSyncStatusBadge = (status: string | null) => {
    switch (status) {
      case 'synced':
        return <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Sincronizado</Badge>;
      case 'error':
        return <Badge variant="destructive">Erro</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const getRoleBadge = (role: string | null) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-purple-500/20 text-purple-500 border-purple-500/30">Admin</Badge>;
      case 'user':
      default:
        return <Badge variant="outline">Usuário</Badge>;
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  const clearFilters = () => {
    setFilters({ search: '', syncStatus: 'all', role: 'all' });
    setCurrentPage(1);
  };

  const hasActiveFilters = filters.search || filters.syncStatus !== 'all' || filters.role !== 'all';

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Usuários Cadastrados</span>
          <span className="text-sm font-normal text-muted-foreground">
            {totalCount} usuário(s)
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou email..."
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                className="pl-10"
              />
            </div>
          </div>
          
          <Select
            value={filters.syncStatus}
            onValueChange={(value) => {
              setFilters({ ...filters, syncStatus: value });
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status Sync" />
            </SelectTrigger>
            <SelectContent>
              {SYNC_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={filters.role}
            onValueChange={(value) => {
              setFilters({ ...filters, role: value });
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Perfil" />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={pageSize.toString()}
            onValueChange={(value) => {
              setPageSize(Number(value));
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={size.toString()}>
                  {size} itens
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
              <X className="w-4 h-4" />
              Limpar
            </Button>
          )}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-8 text-muted-foreground">Carregando...</div>
        ) : users.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">Nenhum usuário encontrado.</div>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Créditos</TableHead>
                    <TableHead>Perfil</TableHead>
                    <TableHead>Sync</TableHead>
                    <TableHead>Data Cadastro</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.name || '-'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.credits?.toLocaleString() ?? 0}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{getSyncStatusBadge(user.sync_status)}</TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSelectedUser(user)}
                            title="Ver detalhes"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {(user.sync_status === 'error' || user.sync_status === 'pending') && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRetrySync(user.id)}
                              disabled={retrying === user.id}
                              title="Retentar sincronização"
                            >
                              <RotateCcw className={`w-4 h-4 ${retrying === user.id ? 'animate-spin' : ''}`} />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }
                      
                      return (
                        <PaginationItem key={pageNum}>
                          <PaginationLink
                            onClick={() => setCurrentPage(pageNum)}
                            isActive={currentPage === pageNum}
                            className="cursor-pointer"
                          >
                            {pageNum}
                          </PaginationLink>
                        </PaginationItem>
                      );
                    })}
                    
                    <PaginationItem>
                      <PaginationNext 
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </>
        )}

        {/* User Detail Dialog */}
        <Dialog open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Detalhes do Usuário</DialogTitle>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Nome</p>
                    <p className="font-medium">{selectedUser.name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Telefone</p>
                    <p className="font-medium">{selectedUser.phone || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Créditos</p>
                    <p className="font-medium">{selectedUser.credits?.toLocaleString() ?? 0}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Perfil</p>
                    {getRoleBadge(selectedUser.role)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status Sync</p>
                    {getSyncStatusBadge(selectedUser.sync_status)}
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Data de Cadastro</p>
                    <p className="font-medium">
                      {new Date(selectedUser.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {selectedUser.synced_at && (
                    <div>
                      <p className="text-sm text-muted-foreground">Última Sincronização</p>
                      <p className="font-medium">
                        {new Date(selectedUser.synced_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  )}
                </div>
                
                {selectedUser.sync_response && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Resposta da Sincronização</p>
                    <pre className="p-3 bg-muted rounded-lg text-xs overflow-auto max-h-40">
                      {selectedUser.sync_response}
                    </pre>
                  </div>
                )}

                {(selectedUser.sync_status === 'error' || selectedUser.sync_status === 'pending') && (
                  <Button
                    onClick={() => handleRetrySync(selectedUser.id)}
                    disabled={retrying === selectedUser.id}
                    className="w-full gap-2"
                  >
                    <RotateCcw className={`w-4 h-4 ${retrying === selectedUser.id ? 'animate-spin' : ''}`} />
                    Retentar Sincronização
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
