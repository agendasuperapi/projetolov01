import { useState } from 'react';
import { 
  BarChart3, 
  Package, 
  Zap, 
  HeadphonesIcon, 
  Plus,
  X,
  Users,
  Activity,
  DollarSign,
  FileText,
  UserCheck
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface AdminBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingRechargesCount: number;
}

const mainTabs = [
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'accounts', label: 'Contas', icon: Package },
  { value: 'recharges', label: 'Recargas', icon: Zap, hasBadge: true },
  { value: 'support', label: 'Suporte', icon: HeadphonesIcon },
];

const moreTabs = [
  { value: 'users', label: 'Usuários', icon: UserCheck },
  { value: 'transactions', label: 'Transações', icon: Users },
  { value: 'stripe-events', label: 'Stripe', icon: Activity },
  { value: 'plans', label: 'Planos', icon: DollarSign },
  { value: 'content', label: 'Conteúdo', icon: FileText },
];

export default function AdminBottomNav({ 
  activeTab, 
  onTabChange, 
  pendingRechargesCount 
}: AdminBottomNavProps) {
  const [showMore, setShowMore] = useState(false);

  const handleTabClick = (value: string) => {
    onTabChange(value);
    setShowMore(false);
  };

  const isMainTab = mainTabs.some(tab => tab.value === activeTab);
  const activeMoreTab = moreTabs.find(tab => tab.value === activeTab);

  return (
    <>
      {/* Overlay for more menu */}
      {showMore && (
        <div 
          className="md:hidden fixed inset-0 bg-black/50 z-40 animate-in fade-in duration-200"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More menu popup */}
      {showMore && (
        <div className="md:hidden fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-card border border-border rounded-2xl shadow-xl p-4 min-w-[200px] animate-in slide-in-from-bottom-4 duration-200">
          <div className="grid grid-cols-3 gap-3">
            {moreTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.value;
              
              return (
                <button
                  key={tab.value}
                  onClick={() => handleTabClick(tab.value)}
                  className={cn(
                    "flex flex-col items-center gap-1 p-3 rounded-xl transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "hover:bg-muted text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
        <div className="flex items-center justify-around h-16 px-2">
          {/* First two main tabs */}
          {mainTabs.slice(0, 2).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            
            return (
              <button
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors relative",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
                {tab.hasBadge && pendingRechargesCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 right-0 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {pendingRechargesCount}
                  </Badge>
                )}
              </button>
            );
          })}

          {/* Center plus button */}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex items-center justify-center w-14 h-14 -mt-6 rounded-full shadow-lg transition-all duration-200",
              showMore 
                ? "bg-muted text-foreground rotate-45" 
                : activeMoreTab
                  ? "bg-primary text-primary-foreground"
                  : "bg-primary text-primary-foreground"
            )}
          >
            {showMore ? (
              <X className="w-6 h-6" />
            ) : activeMoreTab ? (
              <activeMoreTab.icon className="w-6 h-6" />
            ) : (
              <Plus className="w-6 h-6" />
            )}
          </button>

          {/* Last two main tabs */}
          {mainTabs.slice(2, 4).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.value;
            
            return (
              <button
                key={tab.value}
                onClick={() => handleTabClick(tab.value)}
                className={cn(
                  "flex flex-col items-center gap-1 py-2 px-3 rounded-lg transition-colors relative",
                  isActive 
                    ? "text-primary" 
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
                {tab.hasBadge && pendingRechargesCount > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 right-0 h-4 min-w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {pendingRechargesCount}
                  </Badge>
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
