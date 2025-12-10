import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, UserPlus } from 'lucide-react';

interface PlanPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  planName: string;
  availableAccounts: number;
  onPurchase: (type: 'recharge' | 'new_account', rechargeLink?: string) => void;
  isLoading: boolean;
}

export default function PlanPurchaseModal({
  isOpen,
  onClose,
  planName,
  availableAccounts,
  onPurchase,
  isLoading,
}: PlanPurchaseModalProps) {
  const [purchaseType, setPurchaseType] = useState<'recharge' | 'new_account'>('new_account');
  const [rechargeLink, setRechargeLink] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseType === 'recharge') {
      if (!rechargeLink.trim()) return;
      onPurchase('recharge', rechargeLink.trim());
    } else {
      onPurchase('new_account');
    }
  };

  const isNewAccountDisabled = availableAccounts === 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Comprar {planName}</DialogTitle>
          <DialogDescription>
            Escolha como deseja utilizar seus créditos
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* New Account Card */}
          <div 
            onClick={() => !isNewAccountDisabled && setPurchaseType('new_account')}
            className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
              purchaseType === 'new_account' 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            } ${isNewAccountDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${purchaseType === 'new_account' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <UserPlus className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Conta nova</span>
                  {isNewAccountDisabled && (
                    <span className="text-xs bg-destructive/10 text-destructive px-2 py-0.5 rounded-full">Esgotado</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Receba os dados de uma nova conta
                </p>
                {!isNewAccountDisabled && (
                  <p className="text-xs text-primary mt-1 font-medium">
                    {availableAccounts} conta(s) disponível(is)
                  </p>
                )}
              </div>
              {purchaseType === 'new_account' && !isNewAccountDisabled && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                </div>
              )}
            </div>
          </div>

          {/* Recharge Card */}
          <div 
            onClick={() => setPurchaseType('recharge')}
            className={`p-4 rounded-lg border-2 transition-all cursor-pointer ${
              purchaseType === 'recharge' 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-primary/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-full ${purchaseType === 'recharge' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                <RefreshCw className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <span className="font-semibold">Recarregue minha conta</span>
                <p className="text-sm text-muted-foreground">
                  Adicione créditos a uma conta existente
                </p>
              </div>
              {purchaseType === 'recharge' && (
                <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 bg-primary-foreground rounded-full" />
                </div>
              )}
            </div>
          </div>

          {/* Recharge Link Input */}
          {purchaseType === 'recharge' && (
            <div className="space-y-2">
              <Label htmlFor="rechargeLink">Digite seu link</Label>
              <Input
                id="rechargeLink"
                type="url"
                value={rechargeLink}
                onChange={(e) => setRechargeLink(e.target.value)}
                placeholder="https://..."
                required
              />
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="flex-1 gradient-primary" 
              disabled={isLoading || (purchaseType === 'recharge' && !rechargeLink.trim())}
            >
              {isLoading ? 'Processando...' : 'Continuar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
