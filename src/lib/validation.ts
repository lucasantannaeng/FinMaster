import { z } from 'zod';

// --- Error Mapping ---
export function getUserFriendlyError(error: any): string {
  const message = (error?.message || '').toLowerCase();

  // Auth-specific (avoid leaking whether an email exists)
  if (message.includes('user already registered') || message.includes('email already') || message.includes('already been registered'))
    return 'Não foi possível criar a conta. Verifique os dados e tente novamente.';
  if (message.includes('invalid login credentials') || message.includes('invalid credentials'))
    return 'Email ou senha incorretos.';
  if (message.includes('email not confirmed'))
    return 'Verifique seu email para confirmar a conta.';
  if (message.includes('email rate limit') || message.includes('over_email_send_rate_limit'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (message.includes('password should be') || message.includes('weak password'))
    return 'Senha muito fraca. Use pelo menos 6 caracteres.';

  if (message.includes('row-level security'))
    return 'Você não tem permissão para realizar esta ação.';
  if (message.includes('duplicate key') || message.includes('unique constraint'))
    return 'Este item já existe.';
  if (message.includes('foreign key'))
    return 'Não é possível excluir este item pois está sendo usado.';
  if (message.includes('invalid input syntax'))
    return 'Formato de dados inválido.';
  if (message.includes('not_null_violation') || message.includes('null value'))
    return 'Preencha todos os campos obrigatórios.';
  if (message.includes('check_violation'))
    return 'Valor fora do intervalo permitido.';

  return 'Ocorreu um erro. Tente novamente.';
}

// --- Validation Schemas ---

export const transactionSchema = z.object({
  description: z.string().trim().min(1, 'Descrição obrigatória').max(200, 'Máx. 200 caracteres'),
  amount: z.number({ invalid_type_error: 'Valor inválido' }).positive('Valor deve ser positivo').max(999999999, 'Valor muito alto'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida'),
  type: z.enum(['income', 'expense', 'transfer'], { required_error: 'Tipo obrigatório' }),
  category_id: z.string().max(100).optional().or(z.literal('')),
  account_id: z.string().max(100).optional().or(z.literal('')),
  card_id: z.string().max(100).optional().or(z.literal('')),
  contact_id: z.string().max(100).optional().or(z.literal('')),
  is_paid: z.boolean(),
  installments: z.number().int().min(1).max(48).optional(),
  recurrence: z.enum(['', 'weekly', 'monthly', 'yearly']).optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100, 'Máx. 100 caracteres'),
  type: z.enum(['expense', 'income'], { required_error: 'Tipo obrigatório' }),
  icon: z.string().max(50).optional(),
  color: z.string().max(20).optional(),
  percentage: z.number().min(0).max(100).optional(),
});

export const accountSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100, 'Máx. 100 caracteres'),
  type: z.string().min(1).max(50),
  balance: z.number().max(999999999, 'Valor muito alto'),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100, 'Máx. 100 caracteres'),
});

export const creditCardSchema = z.object({
  name: z.string().trim().min(1, 'Nome obrigatório').max(100, 'Máx. 100 caracteres'),
  card_limit: z.number({ invalid_type_error: 'Limite inválido' }).positive('Limite deve ser positivo').max(999999999),
  closing_day: z.number().int().min(1, 'Dia inválido').max(31, 'Dia inválido'),
  due_day: z.number().int().min(1, 'Dia inválido').max(31, 'Dia inválido'),
});

export const incomeSchema = z.object({
  monthly_income: z.number().min(0).max(999999999, 'Valor muito alto'),
});

export const settleSchema = z.object({
  amount: z.number({ invalid_type_error: 'Valor inválido' }).positive('Valor deve ser positivo').max(999999999),
});
