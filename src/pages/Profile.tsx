import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/format';
import { LogOut, Wallet, Plus, Users, Loader2, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { accountSchema, contactSchema, getUserFriendlyError } from '@/lib/validation';

const Profile = () => {
  const { user, signOut } = useAuth();
  const [accounts, setAccounts] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [accountDialog, setAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any>(null);
  const [contactDialog, setContactDialog] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [accountForm, setAccountForm] = useState({ name: '', type: 'checking', balance: '' });
  const [contactForm, setContactForm] = useState({ name: '' });

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    const [aRes, cRes] = await Promise.all([
      supabase.from('accounts').select('*').order('name'),
      supabase.from('contacts').select('*').order('name'),
    ]);
    setAccounts(aRes.data || []);
    setContacts(cRes.data || []);
  };

  const openNewAccount = () => {
    setEditingAccount(null);
    setAccountForm({ name: '', type: 'checking', balance: '' });
    setAccountDialog(true);
  };

  const openEditAccount = (acc: any) => {
    setEditingAccount(acc);
    setAccountForm({ name: acc.name, type: acc.type, balance: acc.balance.toString() });
    setAccountDialog(true);
  };

  const handleAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsed = accountSchema.parse({
        name: accountForm.name,
        type: accountForm.type,
        balance: parseFloat(accountForm.balance) || 0,
      });

      if (editingAccount) {
        const { error } = await supabase.from('accounts').update({
          name: parsed.name,
          type: parsed.type,
          balance: parsed.balance,
        }).eq('id', editingAccount.id);
        if (error) throw error;
        toast.success('Conta atualizada!');
      } else {
        const { error } = await supabase.from('accounts').insert({
          user_id: user.id,
          name: parsed.name,
          type: parsed.type,
          balance: parsed.balance,
        });
        if (error) throw error;
        toast.success('Conta criada!');
      }

      setAccountDialog(false);
      setEditingAccount(null);
      setAccountForm({ name: '', type: 'checking', balance: '' });
      loadData();
    } catch (err: any) {
      if (err?.errors?.[0]?.message) {
        toast.error(err.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteAccount = async (acc: any) => {
    if (!confirm(`Excluir a conta "${acc.name}"?`)) return;
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', acc.id);
      if (error) throw error;
      toast.success('Conta excluída!');
      loadData();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    }
  };

  const openNewContact = () => {
    setEditingContact(null);
    setContactForm({ name: '' });
    setContactDialog(true);
  };

  const openEditContact = (contact: any) => {
    setEditingContact(contact);
    setContactForm({ name: contact.name });
    setContactDialog(true);
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const parsed = contactSchema.parse({ name: contactForm.name });
      if (editingContact) {
        const { error } = await supabase.from('contacts').update({ name: parsed.name }).eq('id', editingContact.id);
        if (error) throw error;
        toast.success('Pessoa atualizada!');
      } else {
        const { error } = await supabase.from('contacts').insert({
          user_id: user.id,
          name: parsed.name,
        });
        if (error) throw error;
        toast.success('Pessoa cadastrada!');
      }
      setContactDialog(false);
      setEditingContact(null);
      setContactForm({ name: '' });
      loadData();
    } catch (err: any) {
      if (err?.errors?.[0]?.message) {
        toast.error(err.errors[0].message);
      } else {
        toast.error(getUserFriendlyError(err));
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteContact = async (contact: any) => {
    if (!confirm(`Excluir a pessoa "${contact.name}"?`)) return;
    try {
      const { error } = await supabase.from('contacts').delete().eq('id', contact.id);
      if (error) throw error;
      toast.success('Pessoa excluída!');
      loadData();
    } catch (err: any) {
      toast.error(getUserFriendlyError(err));
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold">Perfil</h1>
          <p className="text-sm text-muted-foreground">{user?.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={signOut}>
          <LogOut className="h-4 w-4 mr-1" /> Sair
        </Button>
      </div>

      {/* Accounts Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4" /> Contas
          </h2>
          <Button variant="ghost" size="sm" onClick={openNewAccount} aria-label="Nova conta"><Plus className="h-4 w-4" /></Button>
        </div>
        {accounts.length === 0 ? (
          <Card><CardContent className="py-4 text-center text-sm text-muted-foreground">Nenhuma conta</CardContent></Card>
        ) : (
          accounts.map(acc => (
            <Card key={acc.id}>
              <CardContent className="flex items-center justify-between py-3">
                <span className="font-medium text-sm">{acc.name}</span>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{formatCurrency(Number(acc.balance))}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditAccount(acc)} aria-label="Editar conta">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteAccount(acc)} aria-label="Excluir conta">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Account Dialog */}
      <Dialog open={accountDialog} onOpenChange={(open) => { setAccountDialog(open); if (!open) setEditingAccount(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAccount ? 'Editar Conta' : 'Nova Conta'}</DialogTitle></DialogHeader>
          <form onSubmit={handleAccountSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={accountForm.name} onChange={e => setAccountForm({ ...accountForm, name: e.target.value })} placeholder="Ex: Nubank" required />
            </div>
            <div className="space-y-1.5">
              <Label>Saldo (R$)</Label>
              <Input type="number" step="0.01" value={accountForm.balance} onChange={e => setAccountForm({ ...accountForm, balance: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingAccount ? 'Salvar' : 'Criar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Contacts (People) Section — CRUD only */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold flex items-center gap-2">
            <Users className="h-4 w-4" /> Pessoas
          </h2>
          <Button variant="ghost" size="sm" onClick={openNewContact} aria-label="Nova pessoa"><Plus className="h-4 w-4" /></Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Quitação de dívidas é feita na aba <span className="font-medium text-foreground">Cartões</span>, filtrando pela fatura, pessoa e status.
        </p>
        {contacts.length === 0 ? (
          <Card><CardContent className="py-4 text-center text-sm text-muted-foreground">Nenhuma pessoa cadastrada</CardContent></Card>
        ) : (
          contacts.map(contact => (
            <Card key={contact.id}>
              <CardContent className="flex items-center justify-between py-3">
                <span className="font-medium text-sm">{contact.name}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => openEditContact(contact)} aria-label="Editar pessoa">
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteContact(contact)} aria-label="Excluir pessoa">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Contact Dialog */}
      <Dialog open={contactDialog} onOpenChange={(open) => { setContactDialog(open); if (!open) setEditingContact(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingContact ? 'Editar Pessoa' : 'Nova Pessoa'}</DialogTitle></DialogHeader>
          <form onSubmit={handleContactSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={contactForm.name} onChange={e => setContactForm({ name: e.target.value })} placeholder="Nome da pessoa" required />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingContact ? 'Salvar' : 'Criar'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
