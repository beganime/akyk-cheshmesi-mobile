function humanizeField(field: string) {
  const labels: Record<string, string> = {
    email: 'Email',
    username: 'Username',
    password: 'Пароль',
    password_confirm: 'Подтверждение пароля',
    phone: 'Телефон',
    phone_number: 'Телефон',
    detail: 'Ошибка',
    non_field_errors: 'Ошибка',
  };

  return labels[field] || field.replace(/_/g, ' ');
}

function stringifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(stringifyValue).filter(Boolean).join('\n');
  }

  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, nested]) => {
        const message = stringifyValue(nested);
        return message ? `${humanizeField(key)}: ${message}` : '';
      })
      .filter(Boolean)
      .join('\n');
  }

  return typeof value === 'string' ? value : '';
}

export function getApiErrorMessage(error: any, fallback: string) {
  const data = error?.response?.data;

  if (!data) {
    return error?.message || fallback;
  }

  if (typeof data === 'string') {
    return data;
  }

  if (typeof data.detail === 'string') {
    return data.detail;
  }

  const fieldErrors = stringifyValue(data);
  return fieldErrors || error?.message || fallback;
}
