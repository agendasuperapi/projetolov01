import { useState } from 'react';
import { 
  BarChart3, 
  Package, 
  Zap, 
  UserCheck, 
  HeadphonesIcon, 
  Users, 
  Activity, 
  DollarSign, 
  FileText,
  Menu,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

interface AdminMobileSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingRechargesCount: number;
}

const menuItems = [
  { value: 'analytics', label: 'Analytics', icon: BarChart3 },
  { value: 'accounts', label: 'Contas', icon: Package },
  { value: 'recharges', label: 'Recargas', icon: Zap, hasBadge: true },
  { value: 'users', label: 'Usuários', icon: UserCheck },
  { value: 'support', label: 'Suporte', icon: HeadphonesIcon },
  { value: 'transactions', label: 'Transações', icon: Users },
  { value: 'stripe-events', label: 'Stripe', icon: Activity },
  { value: 'plans', label: 'Planos', icon: DollarSign },
  { value: 'content', label: 'Conteúdo', icon: FileText },
];

export default function AdminMobileSidebar({ 
  activeTab, 
  onTabChange, 
  pendingRechargesCount 
}: AdminMobileSidebarProps) {
  const [open, setOpen] = useState(false);

  const handleItemClick = (value: string) => {
    onTabChange(value);
    setOpen(false);
  };

  const activeItem = menuItems.find(item => item.value === activeTab);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="gap-2 w-full justify-between"
          >
            <div className="flex items-center gap-2">
              {activeItem && <activeItem.icon className="w-4 h-4" />}
              <span>{activeItem?.label || 'Menu'}</span>
            </div>
            <Menu className="w-4 h-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72">
          <SheetHeader>
            <SheetTitle className="text-left">Menu Admin</SheetTitle>
          </SheetHeader>
          <nav className="mt-6 flex flex-col gap-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.value;
              
              return (
                <button
                  key={item.value}
                  onClick={() => handleItemClick(item.value)}
                  className={`
                    flex items-center gap-3 px-3 py-3 rounded-lg text-left transition-colors relative
                    ${isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                  {item.hasBadge && pendingRechargesCount > 0 && (
                    <Badge 
                      variant="destructive" 
                      className="ml-auto h-5 min-w-5 p-0 flex items-center justify-center text-xs"
                    >
                      {pendingRechargesCount}
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </SheetContent>
      </Sheet>
    </div>
  );
}
