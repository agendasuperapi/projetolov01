import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface HeroContent {
  badge: string;
  title: string;
  titleHighlight: string;
  description: string;
  ctaButton: string;
  secondaryButton: string;
  backgroundColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  gradientDirection?: string;
}

interface FeatureItem {
  icon: string;
  title: string;
  description: string;
}

interface FeaturesContent {
  items: FeatureItem[];
}

interface PlansContent {
  title: string;
  subtitle: string;
  features: string[];
  competitorLabel?: string;
}

interface FooterContent {
  copyright: string;
}

interface StylesContent {
  primaryColor?: string;
  accentColor?: string;
  buttonGradientFrom?: string;
  buttonGradientTo?: string;
  featuresBackground?: string;
  footerBackground?: string;
}

type SectionContent = HeroContent | FeaturesContent | PlansContent | FooterContent | StylesContent;

export default function ContentEditor() {
  const [searchParams] = useSearchParams();
  const editSection = searchParams.get('edit') || 'hero';
  
  const [heroContent, setHeroContent] = useState<HeroContent | null>(null);
  const [featuresContent, setFeaturesContent] = useState<FeaturesContent | null>(null);
  const [plansContent, setPlansContent] = useState<PlansContent | null>(null);
  const [footerContent, setFooterContent] = useState<FooterContent | null>(null);
  const [stylesContent, setStylesContent] = useState<StylesContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    setLoading(true);
    const { data } = await supabase.from('site_content').select('*');
    
    if (data) {
      data.forEach((item) => {
        const content = item.content as Record<string, unknown>;
        switch (item.section_key) {
          case 'hero':
            setHeroContent(content as unknown as HeroContent);
            break;
          case 'features':
            setFeaturesContent(content as unknown as FeaturesContent);
            break;
          case 'plans':
            setPlansContent(content as unknown as PlansContent);
            break;
          case 'footer':
            setFooterContent(content as unknown as FooterContent);
            break;
          case 'styles':
            setStylesContent(content as unknown as StylesContent);
            break;
        }
      });
    }
    setLoading(false);
  };

  const saveSection = async (sectionKey: string, content: SectionContent) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_content')
        .update({ content: JSON.parse(JSON.stringify(content)), updated_at: new Date().toISOString() })
        .eq('section_key', sectionKey);

      if (error) throw error;
      
      toast({ title: 'Salvo!', description: 'Conteúdo atualizado com sucesso.' });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro ao salvar';
      toast({ title: 'Erro', description: errorMessage, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Tabs defaultValue={editSection} className="space-y-6">
      <TabsList className="grid w-full grid-cols-5">
        <TabsTrigger value="hero">Hero</TabsTrigger>
        <TabsTrigger value="features">Features</TabsTrigger>
        <TabsTrigger value="plans">Planos</TabsTrigger>
        <TabsTrigger value="footer">Footer</TabsTrigger>
        <TabsTrigger value="styles">Estilos</TabsTrigger>
      </TabsList>

      {/* Hero Editor */}
      <TabsContent value="hero">
        <Card>
          <CardHeader>
            <CardTitle>Seção Hero</CardTitle>
            <CardDescription>Edite o conteúdo da seção principal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {heroContent && (
              <>
                <div className="space-y-2">
                  <Label>Badge</Label>
                  <Input
                    value={heroContent.badge}
                    onChange={(e) => setHeroContent({ ...heroContent, badge: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={heroContent.title}
                    onChange={(e) => setHeroContent({ ...heroContent, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Título Destaque</Label>
                  <Input
                    value={heroContent.titleHighlight}
                    onChange={(e) => setHeroContent({ ...heroContent, titleHighlight: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea
                    value={heroContent.description}
                    onChange={(e) => setHeroContent({ ...heroContent, description: e.target.value })}
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Botão Principal</Label>
                    <Input
                      value={heroContent.ctaButton}
                      onChange={(e) => setHeroContent({ ...heroContent, ctaButton: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Botão Secundário</Label>
                    <Input
                      value={heroContent.secondaryButton}
                      onChange={(e) => setHeroContent({ ...heroContent, secondaryButton: e.target.value })}
                    />
                  </div>
                </div>

                {/* Cores e Gradiente */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">Cores do Fundo</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cor Inicial do Gradiente</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={heroContent.gradientFrom || '#1a1a2e'}
                          onChange={(e) => setHeroContent({ ...heroContent, gradientFrom: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={heroContent.gradientFrom || '#1a1a2e'}
                          onChange={(e) => setHeroContent({ ...heroContent, gradientFrom: e.target.value })}
                          placeholder="#1a1a2e"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Cor Final do Gradiente</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={heroContent.gradientTo || '#0f0f1a'}
                          onChange={(e) => setHeroContent({ ...heroContent, gradientTo: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={heroContent.gradientTo || '#0f0f1a'}
                          onChange={(e) => setHeroContent({ ...heroContent, gradientTo: e.target.value })}
                          placeholder="#0f0f1a"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2 mt-4">
                    <Label>Direção do Gradiente</Label>
                    <select
                      value={heroContent.gradientDirection || 'to-b'}
                      onChange={(e) => setHeroContent({ ...heroContent, gradientDirection: e.target.value })}
                      className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                    >
                      <option value="to-t">De baixo para cima</option>
                      <option value="to-b">De cima para baixo</option>
                      <option value="to-l">Da direita para esquerda</option>
                      <option value="to-r">Da esquerda para direita</option>
                      <option value="to-tl">Diagonal ↖</option>
                      <option value="to-tr">Diagonal ↗</option>
                      <option value="to-bl">Diagonal ↙</option>
                      <option value="to-br">Diagonal ↘</option>
                    </select>
                  </div>
                  
                  {/* Preview */}
                  <div className="mt-4">
                    <Label>Preview do Gradiente</Label>
                    <div 
                      className="h-20 rounded-lg mt-2 border"
                      style={{
                        background: `linear-gradient(${
                          heroContent.gradientDirection === 'to-t' ? '0deg' :
                          heroContent.gradientDirection === 'to-b' ? '180deg' :
                          heroContent.gradientDirection === 'to-l' ? '270deg' :
                          heroContent.gradientDirection === 'to-r' ? '90deg' :
                          heroContent.gradientDirection === 'to-tl' ? '315deg' :
                          heroContent.gradientDirection === 'to-tr' ? '45deg' :
                          heroContent.gradientDirection === 'to-bl' ? '225deg' :
                          '135deg'
                        }, ${heroContent.gradientFrom || '#1a1a2e'}, ${heroContent.gradientTo || '#0f0f1a'})`
                      }}
                    />
                  </div>
                </div>

                <Button
                  onClick={() => saveSection('hero', heroContent)} 
                  disabled={saving}
                  className="w-full gradient-primary"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Features Editor */}
      <TabsContent value="features">
        <Card>
          <CardHeader>
            <CardTitle>Seção Features</CardTitle>
            <CardDescription>Edite os recursos exibidos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {featuresContent && (
              <>
                {featuresContent.items.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Feature {index + 1}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newItems = featuresContent.items.filter((_, i) => i !== index);
                          setFeaturesContent({ ...featuresContent, items: newItems });
                        }}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Ícone (Lucide)</Label>
                        <Input
                          value={item.icon}
                          onChange={(e) => {
                            const newItems = [...featuresContent.items];
                            newItems[index] = { ...item, icon: e.target.value };
                            setFeaturesContent({ ...featuresContent, items: newItems });
                          }}
                          placeholder="Zap, Shield, Download..."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Título</Label>
                        <Input
                          value={item.title}
                          onChange={(e) => {
                            const newItems = [...featuresContent.items];
                            newItems[index] = { ...item, title: e.target.value };
                            setFeaturesContent({ ...featuresContent, items: newItems });
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Descrição</Label>
                      <Input
                        value={item.description}
                        onChange={(e) => {
                          const newItems = [...featuresContent.items];
                          newItems[index] = { ...item, description: e.target.value };
                          setFeaturesContent({ ...featuresContent, items: newItems });
                        }}
                      />
                    </div>
                  </div>
                ))}
                <Button
                  variant="outline"
                  onClick={() => {
                    setFeaturesContent({
                      ...featuresContent,
                      items: [...featuresContent.items, { icon: 'Star', title: 'Nova Feature', description: 'Descrição' }]
                    });
                  }}
                  className="w-full"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Adicionar Feature
                </Button>
                <Button 
                  onClick={() => saveSection('features', featuresContent)} 
                  disabled={saving}
                  className="w-full gradient-primary"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Plans Editor */}
      <TabsContent value="plans">
        <Card>
          <CardHeader>
            <CardTitle>Seção Planos</CardTitle>
            <CardDescription>Edite títulos e benefícios dos planos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {plansContent && (
              <>
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input
                    value={plansContent.title}
                    onChange={(e) => setPlansContent({ ...plansContent, title: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Input
                    value={plansContent.subtitle}
                    onChange={(e) => setPlansContent({ ...plansContent, subtitle: e.target.value })}
                  />
                </div>

                {/* Comparação com Concorrente */}
                <div className="border-t pt-4 mt-4">
                  <h4 className="font-medium mb-4">Comparação com Concorrente</h4>
                  <div className="space-y-2">
                    <Label>Texto do Label</Label>
                    <Input
                      value={plansContent.competitorLabel || 'Comprando no Concorrente'}
                      onChange={(e) => setPlansContent({ ...plansContent, competitorLabel: e.target.value })}
                      placeholder="Comprando no Concorrente"
                    />
                    <p className="text-sm text-muted-foreground">
                      Os preços do concorrente são configurados individualmente em cada plano na aba "Contas".
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Benefícios (um por linha)</Label>
                  {plansContent.features.map((feature, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={feature}
                        onChange={(e) => {
                          const newFeatures = [...plansContent.features];
                          newFeatures[index] = e.target.value;
                          setPlansContent({ ...plansContent, features: newFeatures });
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newFeatures = plansContent.features.filter((_, i) => i !== index);
                          setPlansContent({ ...plansContent, features: newFeatures });
                        }}
                        className="text-destructive shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setPlansContent({ ...plansContent, features: [...plansContent.features, 'Novo benefício'] });
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar Benefício
                  </Button>
                </div>
                <Button 
                  onClick={() => saveSection('plans', plansContent)} 
                  disabled={saving}
                  className="w-full gradient-primary"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Footer Editor */}
      <TabsContent value="footer">
        <Card>
          <CardHeader>
            <CardTitle>Footer</CardTitle>
            <CardDescription>Edite o rodapé do site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {footerContent && (
              <>
                <div className="space-y-2">
                  <Label>Copyright</Label>
                  <Input
                    value={footerContent.copyright}
                    onChange={(e) => setFooterContent({ ...footerContent, copyright: e.target.value })}
                  />
                </div>
                <Button 
                  onClick={() => saveSection('footer', footerContent)} 
                  disabled={saving}
                  className="w-full gradient-primary"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* Styles Editor */}
      <TabsContent value="styles">
        <Card>
          <CardHeader>
            <CardTitle>Estilos Globais</CardTitle>
            <CardDescription>Configure as cores e estilos do site</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {stylesContent !== null ? (
              <>
                {/* Cores dos Botões */}
                <div className="space-y-4">
                  <h4 className="font-medium">Cores do Botão Principal</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Cor Inicial do Gradiente</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={stylesContent?.buttonGradientFrom || '#6366f1'}
                          onChange={(e) => setStylesContent({ ...stylesContent, buttonGradientFrom: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={stylesContent?.buttonGradientFrom || '#6366f1'}
                          onChange={(e) => setStylesContent({ ...stylesContent, buttonGradientFrom: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Cor Final do Gradiente</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={stylesContent?.buttonGradientTo || '#a855f7'}
                          onChange={(e) => setStylesContent({ ...stylesContent, buttonGradientTo: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={stylesContent?.buttonGradientTo || '#a855f7'}
                          onChange={(e) => setStylesContent({ ...stylesContent, buttonGradientTo: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  {/* Preview do Botão */}
                  <div className="mt-4">
                    <Label>Preview do Botão</Label>
                    <div 
                      className="h-12 rounded-lg mt-2 flex items-center justify-center text-white font-medium"
                      style={{
                        background: `linear-gradient(135deg, ${stylesContent?.buttonGradientFrom || '#6366f1'}, ${stylesContent?.buttonGradientTo || '#a855f7'})`
                      }}
                    >
                      Exemplo de Botão
                    </div>
                  </div>
                </div>

                {/* Cor de Fundo das Seções */}
                <div className="border-t pt-4 space-y-4">
                  <h4 className="font-medium">Cores das Seções</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Fundo da Seção Features</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={stylesContent?.featuresBackground || '#1f1f2e'}
                          onChange={(e) => setStylesContent({ ...stylesContent, featuresBackground: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={stylesContent?.featuresBackground || '#1f1f2e'}
                          onChange={(e) => setStylesContent({ ...stylesContent, featuresBackground: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Fundo do Footer</Label>
                      <div className="flex gap-2">
                        <Input
                          type="color"
                          value={stylesContent?.footerBackground || '#1f1f2e'}
                          onChange={(e) => setStylesContent({ ...stylesContent, footerBackground: e.target.value })}
                          className="w-14 h-10 p-1 cursor-pointer"
                        />
                        <Input
                          value={stylesContent?.footerBackground || '#1f1f2e'}
                          onChange={(e) => setStylesContent({ ...stylesContent, footerBackground: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Preview Ao Vivo Completo */}
                <div className="border-t pt-6 space-y-4">
                  <h4 className="font-medium">Preview Ao Vivo</h4>
                  <p className="text-sm text-muted-foreground">Veja como as mudanças aparecerão no site</p>
                  
                  <div className="border rounded-xl overflow-hidden">
                    {/* Mini Hero Preview */}
                    <div 
                      className="p-6 text-center"
                      style={{
                        background: heroContent?.gradientFrom || heroContent?.gradientTo 
                          ? `linear-gradient(135deg, ${heroContent?.gradientFrom || '#1a1a2e'}, ${heroContent?.gradientTo || '#0f0f1a'})`
                          : 'linear-gradient(135deg, #1a1a2e, #0f0f1a)'
                      }}
                    >
                      <div className="text-xs text-white/70 mb-2">Seção Hero</div>
                      <h3 className="text-white font-bold mb-3">Título de Exemplo</h3>
                      <button 
                        className="px-4 py-2 rounded-lg text-white text-sm font-medium transition-transform hover:scale-105"
                        style={{
                          background: `linear-gradient(135deg, ${stylesContent?.buttonGradientFrom || '#6366f1'}, ${stylesContent?.buttonGradientTo || '#a855f7'})`
                        }}
                      >
                        Botão Principal
                      </button>
                    </div>

                    {/* Mini Features Preview */}
                    <div 
                      className="p-6"
                      style={{ backgroundColor: stylesContent?.featuresBackground || '#1f1f2e' }}
                    >
                      <div className="text-xs text-white/70 mb-3 text-center">Seção Features</div>
                      <div className="flex justify-center gap-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className="bg-background rounded-lg p-3 text-center w-24">
                            <div 
                              className="w-8 h-8 rounded-lg mx-auto mb-2 flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, ${stylesContent?.buttonGradientFrom || '#6366f1'}, ${stylesContent?.buttonGradientTo || '#a855f7'})`
                              }}
                            >
                              <span className="text-white text-xs">★</span>
                            </div>
                            <span className="text-xs font-medium">Feature {i}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini Plans Preview */}
                    <div className="p-6 bg-background">
                      <div className="text-xs text-muted-foreground mb-3 text-center">Seção Planos</div>
                      <div className="flex justify-center gap-3">
                        {[1, 2].map((i) => (
                          <div key={i} className={`border rounded-lg p-3 text-center w-28 ${i === 2 ? 'border-primary' : ''}`}>
                            <span className="text-xs font-medium">Plano {i}</span>
                            <div className="text-sm font-bold my-1">R$ 99</div>
                            <button 
                              className={`w-full px-2 py-1 rounded text-xs font-medium ${i === 2 ? 'text-white' : 'border'}`}
                              style={i === 2 ? {
                                background: `linear-gradient(135deg, ${stylesContent?.buttonGradientFrom || '#6366f1'}, ${stylesContent?.buttonGradientTo || '#a855f7'})`
                              } : undefined}
                            >
                              Comprar
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mini Footer Preview */}
                    <div 
                      className="p-4 text-center border-t"
                      style={{ backgroundColor: stylesContent?.footerBackground || '#1f1f2e' }}
                    >
                      <div className="text-xs text-white/70 mb-2">Footer</div>
                      <div className="flex items-center justify-center gap-2">
                        <div 
                          className="w-5 h-5 rounded flex items-center justify-center"
                          style={{
                            background: `linear-gradient(135deg, ${stylesContent?.buttonGradientFrom || '#6366f1'}, ${stylesContent?.buttonGradientTo || '#a855f7'})`
                          }}
                        >
                          <span className="text-white text-[8px]">✦</span>
                        </div>
                        <span className="text-white text-xs font-medium">CreditsHub</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Button 
                  onClick={() => saveSection('styles', stylesContent || {})} 
                  disabled={saving}
                  className="w-full gradient-primary"
                >
                  {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  Salvar Alterações
                </Button>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>Seção de estilos não encontrada.</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={async () => {
                    const defaultStyles: StylesContent = {
                      buttonGradientFrom: '#6366f1',
                      buttonGradientTo: '#a855f7',
                      featuresBackground: '#1f1f2e',
                      footerBackground: '#1f1f2e',
                    };
                    await supabase.from('site_content').insert([{
                      section_key: 'styles',
                      content: JSON.parse(JSON.stringify(defaultStyles)),
                    }]);
                    setStylesContent(defaultStyles);
                  }}
                >
                  Criar Seção de Estilos
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}