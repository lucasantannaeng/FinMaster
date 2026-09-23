import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Lock, Database, Mail, ArrowLeft } from 'lucide-react';

const Section = ({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) => (
  <Card>
    <CardHeader className="pb-3">
      <CardTitle className="text-base flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" /> {title}
      </CardTitle>
    </CardHeader>
    <CardContent className="text-sm text-muted-foreground space-y-2">{children}</CardContent>
  </Card>
);

export default function Trust() {
  return (
    <div className="min-h-screen bg-background p-5">
      <Helmet>
        <title>Confiança e Privacidade — FinMaster</title>
        <meta name="description" content="Como o FinMaster protege seus dados: autenticação Supabase, isolamento por usuário via Row-Level Security e contato de segurança." />
        <meta property="og:title" content="Confiança e Privacidade — FinMaster" />
        <meta property="og:description" content="Como o FinMaster protege seus dados e isola informações por usuário." />
      </Helmet>
      <div className="max-w-3xl mx-auto space-y-5">
        <div>
          <Link to="/" className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Voltar
          </Link>
          <div className="mt-3 flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Confiança e Privacidade</h1>
              <p className="text-xs text-muted-foreground">
                Esta página é mantida pelo proprietário do FinMaster para responder dúvidas comuns sobre segurança e privacidade.
                Não é uma certificação independente.
              </p>
            </div>
          </div>
        </div>

        <Section icon={Lock} title="Autenticação e acesso">
          <p>O acesso à aplicação requer autenticação segura gerenciada pelo Supabase Auth (Email, Senha ou Google OAuth).</p>
          <p>Cada usuário acessa exclusivamente os próprios dados; a separação é aplicada no backend por políticas de Row-Level Security baseadas em <code>auth.uid()</code>.</p>
        </Section>

        <Section icon={Database} title="Dados e armazenamento">
          <p>Dados financeiros (contas, transações, cartões, contatos, categorias) são armazenados no Supabase Postgres provisionado para este projeto.</p>
          <p>Você pode editar ou excluir seus registros a qualquer momento dentro da própria aplicação.</p>
          <p>Integrações opcionais (ex.: OKX) usam chaves fornecidas pelo usuário e armazenadas como segredos no servidor — nunca no navegador.</p>
        </Section>

        <Section icon={Shield} title="Plataforma e arquitetura multiplataforma">
          <p>A aplicação opera como solução autônoma multiplataforma (Desktop Windows, Android e Web) utilizando Supabase como backend centralizado. Todos os dados são sincronizados em nuvem sob rígido isolamento criptográfico e regras de RLS.</p>
          <p>Esta página descreve apenas controles atualmente habilitados na aplicação. Não constitui declaração de conformidade regulatória.</p>
        </Section>

        <Section icon={Mail} title="Contato de segurança">
          <p>Encontrou um problema de segurança? Entre em contato com o proprietário do app para reportar de forma responsável antes de divulgar publicamente.</p>
        </Section>
      </div>
    </div>
  );
}
