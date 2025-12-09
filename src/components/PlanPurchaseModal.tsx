import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

        <form onSubmit={handleSubmit} className="space-y-6">
          <RadioGroup
            value={purchaseType}
            onValueChange={(value) => setPurchaseType(value as 'recharge' | 'new_account')}
            className="space-y-4"
          >
            {/* New Account Option */}
            <div className="flex items-start space-x-3">
              <RadioGroupItem 
                value="new_account" 
                id="new_account" 
                disabled={isNewAccountDisabled}
                className="mt-1" 
              />
              <Label 
                htmlFor="new_account" 
                className={`flex-1 cursor-pointer ${isNewAccountDisabled ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Conta nova</span>
                  {isNewAccountDisabled && (
                    <span className="text-xs text-destructive font-normal">(Esgotado)</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Receba os dados de uma nova conta
                </p>
                {!isNewAccountDisabled && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {availableAccounts} conta(s) disponível(is)
                  </p>
                )}
              </Label>
            </div>

            {/* Recharge Option */}
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="recharge" id="recharge" className="mt-1" />
              <Label htmlFor="recharge" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 mb-1">
                  <RefreshCw className="w-4 h-4 text-primary" />
                  <span className="font-semibold">Recarregue minha conta</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Adicione créditos a uma conta existente
                </p>
              </Label>
            </div>
          </RadioGroup>

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
