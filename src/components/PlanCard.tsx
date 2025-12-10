import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Zap } from 'lucide-react';

interface PlanCardProps {
  planType: 'new_account' | 'recharge';
  planName: string;
  credits: number;
  priceCents: number;
  competitorPriceCents?: number | null;
  availableAccounts?: number;
  isLoading?: boolean;
  onBuy: () => void;
}

export default function PlanCard({
  planType,
  planName,
  credits,
  priceCents,
  competitorPriceCents,
  availableAccounts = 0,
  isLoading = false,
  onBuy,
}: PlanCardProps) {
  const discount = competitorPriceCents && competitorPriceCents > 0 && priceCents > 0
    ? Math.round(((competitorPriceCents - priceCents) / competitorPriceCents) * 100)
    : 0;

  const isDisabled = planType === 'new_account' && availableAccounts === 0;
  const priceFormatted = priceCents === 0 
    ? 'A definir' 
    : `R$ ${(priceCents / 100).toFixed(2).replace('.', ',')}`;
  const competitorPriceFormatted = competitorPriceCents 
    ? `R$ ${(competitorPriceCents / 100).toFixed(2).replace('.', ',')}` 
    : null;

  const badgeLabel = planType === 'new_account' ? 'Conta Nova' : 'Recarga';
  const titleText = planType === 'new_account' ? 'NOVA CONTA' : 'RECARREGUE SUA CONTA';
  const descriptionText = planType === 'new_account' 
    ? `Conta nova com ${credits} créditos` 
    : `Recarregue +${credits} créditos na sua conta`;

  return (
    <Card className={`relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-1 bg-card border-border w-[calc(50%-0.5rem)] lg:w-[calc(25%-0.75rem)] max-w-[280px] ${isDisabled ? 'opacity-60' : ''}`}>
      <CardContent className="p-3 md:p-5 space-y-2 md:space-y-4">
        {/* Badge */}
        <Badge className="bg-emerald-500 hover:bg-emerald-500 text-white text-[10px] md:text-xs font-medium px-2 md:px-3 py-0.5 md:py-1">
          {badgeLabel}
        </Badge>

        {/* Title */}
        <div className="space-y-0.5 md:space-y-1">
          <h3 className="font-display font-bold text-[11px] md:text-lg text-foreground tracking-tight leading-tight">
            {titleText}
          </h3>
          
          {/* Credits Display */}
          <div className="flex items-center gap-0.5 md:gap-1">
            <span className="text-lg md:text-3xl font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 bg-clip-text text-transparent">
              +{credits}
            </span>
            <span className="text-[10px] md:text-lg text-muted-foreground font-medium">Créditos</span>
          </div>

          {/* Lovable Logo Placeholder */}
          <div className="flex items-center gap-1 md:gap-1.5 pt-0.5 md:pt-1">
            <div className="w-4 h-4 md:w-5 md:h-5 rounded bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center">
              <span className="text-white text-[10px] md:text-xs">❤</span>
            </div>
            <span className="font-semibold text-foreground text-xs md:text-base">Lovable</span>
          </div>
        </div>

        {/* Description */}
        <p className="text-[10px] md:text-sm text-muted-foreground leading-tight">
          {descriptionText}
        </p>

        {/* Pricing */}
        <div className="space-y-0.5 md:space-y-1">
          {competitorPriceFormatted && discount > 0 && (
            <div className="flex items-center gap-1 md:gap-2">
              <span className="text-[10px] md:text-sm text-muted-foreground line-through">
                {competitorPriceFormatted}
              </span>
              <Badge variant="outline" className="text-[9px] md:text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-medium px-1 md:px-2">
                ↓ {discount}%
              </Badge>
            </div>
          )}
          
          <div className="flex items-baseline gap-0.5 md:gap-1">
            <span className="text-base md:text-2xl font-bold text-foreground">{priceFormatted}</span>
            {priceCents > 0 && (
              <Zap className="w-3 h-3 md:w-5 md:h-5 text-primary" />
            )}
          </div>
          
          <p className="text-[9px] md:text-xs text-muted-foreground">À vista no PIX</p>
        </div>

        {/* Availability for new accounts */}
        {planType === 'new_account' && (
          <p className={`text-[10px] md:text-xs font-medium ${availableAccounts > 0 ? 'text-emerald-600' : 'text-destructive'}`}>
            {availableAccounts > 0 
              ? `${availableAccounts} conta(s) disponível(is)` 
              : 'Esgotado'}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex gap-1 md:gap-2 pt-1 md:pt-2">
          <Button 
            onClick={onBuy}
            disabled={isLoading || priceCents === 0 || isDisabled}
            className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white font-medium text-[10px] md:text-sm h-8 md:h-10 px-2 md:px-4"
          >
            {isLoading ? 'Processando...' : 'Comprar'}
          </Button>
          <Button 
            variant="outline" 
            size="icon"
            onClick={onBuy}
            disabled={isLoading || priceCents === 0 || isDisabled}
            className="border-border hover:bg-accent h-8 w-8 md:h-10 md:w-10"
          >
            <ShoppingCart className="w-3 h-3 md:w-4 md:h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
