export const formatCurrency = (value: number, discrete = false): string => {
  if (discrete) return '••••';
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

export const parseLocalDate = (dateStr: string): Date => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
  }).format(parseLocalDate(date));
};

export const getBillingPeriod = (closingDay: number, referenceDate: Date = new Date()) => {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const day = referenceDate.getDate();

  let startDate: Date;
  let endDate: Date;

  if (day > closingDay) {
    startDate = new Date(year, month, closingDay + 1);
    endDate = new Date(year, month + 1, closingDay);
  } else {
    startDate = new Date(year, month - 1, closingDay + 1);
    endDate = new Date(year, month, closingDay);
  }

  return { startDate, endDate };
};
