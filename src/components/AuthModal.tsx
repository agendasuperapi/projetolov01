import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const authSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255, 'Email muito longo'),
  password: z.string().min(6, 'Senha deve ter pelo menos 6 caracteres').max(72, 'Senha muito longa'),
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo').optional(),
  phone: z.string().trim().min(10, 'Telefone deve ter pelo menos 10 dígitos').max(20, 'Telefone muito longo').optional(),
});

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  planId?: string;
  priceId?: string;
  defaultTab?: 'login' | 'signup';
}

export default function AuthModal({ isOpen, onClose, onSuccess, planId, priceId, defaultTab = 'login' }: AuthModalProps) {
  const [isLogin, setIsLogin] = useState(defaultTab === 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  
  // Reset to default tab when modal opens
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      resetForm();
      setIsLogin(defaultTab === 'login');
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const validation = authSchema.safeParse({
        email,
        password,
        name: isLogin ? undefined : name,
        phone: isLogin ? undefined : phone,
      });

      if (!validation.success) {
        toast({
          title: 'Erro de validação',
          description: validation.error.errors[0].message,
          variant: 'destructive',
        });
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          // Check if user doesn't exist - redirect to signup with email pre-filled
          if (error.message.includes('Invalid login credentials')) {
            // Check if user exists by trying to get user info
            const { data: existingUsers } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', email.trim())
              .limit(1);
            
            if (!existingUsers || existingUsers.length === 0) {
              // User doesn't exist, switch to signup with email preserved
              toast({ title: 'Email não cadastrado', description: 'Redirecionando para cadastro...', variant: 'default' });
              setPassword('');
              setIsLogin(false);
              setLoading(false);
              return;
            }
            
            toast({ title: 'Erro', description: 'Senha incorreta.', variant: 'destructive' });
          } else {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          }
          setLoading(false);
          return;
        }

        toast({ title: 'Bem-vindo!', description: 'Login realizado com sucesso.' });
        onSuccess();
      } else {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { 
              name: name.trim(), 
              phone: phone.trim(),
              planId: planId || null,
              priceId: priceId || null
            },
          },
        });

        if (error) {
          if (error.message.includes('already registered')) {
            toast({ title: 'Erro', description: 'Este email já está cadastrado.', variant: 'destructive' });
          } else {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
          }
          setLoading(false);
          return;
        }

        // Sincronizar usuário com servidor externo
        if (signUpData.user) {
          try {
            await supabase.functions.invoke('sync-to-external', {
              body: { user_id: signUpData.user.id }
            });
            console.log('User synced to external server');
          } catch (syncError) {
            console.error('Error syncing to external server:', syncError);
          }
        }

        toast({ title: 'Conta criada!', description: 'Cadastro realizado com sucesso.' });
        onSuccess();
      }
    } catch {
      toast({ title: 'Erro', description: 'Ocorreu um erro inesperado.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setName('');
    setPhone('');
  };

  const isPurchaseFlow = planId || priceId;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-display">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </DialogTitle>
          <DialogDescription>
            {isLogin 
              ? (isPurchaseFlow ? 'Faça login para continuar com sua compra' : 'Faça login para acessar sua conta')
              : (isPurchaseFlow ? 'Crie sua conta para continuar com sua compra' : 'Crie sua conta para começar')}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {!isLogin && (
            <>
              <div className="space-y-2">
                <Label htmlFor="name">Nome</Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(00) 00000-0000"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required={!isLogin}
                  disabled={loading}
                />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full gradient-primary" disabled={loading}>
            {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar Conta'}
          </Button>

          <div className="text-center text-sm text-muted-foreground">
            {isLogin ? (
              <>
                Não tem conta?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(false)}
                  className="text-primary hover:underline font-medium"
                >
                  Cadastre-se
                </button>
              </>
            ) : (
              <>
                Já tem conta?{' '}
                <button
                  type="button"
                  onClick={() => setIsLogin(true)}
                  className="text-primary hover:underline font-medium"
                >
                  Entrar
                </button>
              </>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
