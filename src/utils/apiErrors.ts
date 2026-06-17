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

function translateKnownMessage(message: string): string {
  const normalized = message.trim().toLowerCase();

  const known: Record<string, string> = {
    'invalid email or password': 'Неверный логин или пароль',
    'email is not verified': 'Email ещё не подтверждён',
    'registration is not completed': 'Регистрация не завершена',
    'a user with this email already exists': 'Пользователь с таким email уже существует',
    'verification code sent': 'Код подтверждения отправлен',
    'verification code not found or expired': 'Код подтверждения не найден или истёк',
    'invalid verification code': 'Неверный код подтверждения',
    'user not found': 'Пользователь не найден',
    'invalid or expired verification token': 'Сессия подтверждения истекла. Запросите код заново',
    'registration has already been completed': 'Регистрация уже завершена',
    'passwords do not match': 'Пароли не совпадают',
    'this username is already taken': 'Этот username уже занят',
    'username must be 4-32 chars and contain only letters, digits, _ or .':
      'Username должен быть 4-32 символа: буквы, цифры, _ или .',
    'verification email service is temporarily unavailable. please try again in 1-2 minutes.':
      'Сервис писем временно недоступен. Попробуйте через 1-2 минуты',
  };

  return known[normalized] || message;
}

function translateFieldMessage(message: string): string {
  const normalized = message.trim().toLowerCase();

  if (normalized.includes('enter a valid email address')) {
    return 'Введите корректный email';
  }

  if (normalized.includes('this field is required')) {
    return 'Обязательное поле';
  }

  if (normalized.includes('ensure this field has at least')) {
    return 'Слишком короткое значение';
  }

  if (normalized.includes('this password is too short')) {
    return 'Пароль слишком короткий';
  }

  if (normalized.includes('this password is too common')) {
    return 'Пароль слишком простой';
  }

  if (normalized.includes('this password is entirely numeric')) {
    return 'Пароль не должен состоять только из цифр';
  }

  return translateKnownMessage(message);
}

function statusFallback(status?: number, fallback?: string): string {
  if (status === 400 || status === 401 || status === 403) {
    return fallback || 'Проверьте введённые данные';
  }

  if (status === 429) {
    return 'Слишком много попыток. Попробуйте позже';
  }

  if (status && status >= 500) {
    return 'Сервер временно недоступен. Попробуйте позже';
  }

  return fallback || 'Не удалось выполнить запрос';
}

export function getApiErrorMessage(error: any, fallback: string) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (!data) {
    if (error?.code === 'ECONNABORTED') {
      return 'Сервер не ответил вовремя. Попробуйте ещё раз';
    }

    if (error?.message === 'Network Error' || error?.request) {
      return 'Сервер недоступен. Проверьте интернет или попробуйте позже';
    }

    return statusFallback(status, fallback);
  }

  if (typeof data === 'string') {
    return translateKnownMessage(data);
  }

  if (typeof data.detail === 'string') {
    return translateKnownMessage(data.detail);
  }

  const fieldErrors = stringifyValue(data);
  if (fieldErrors) {
    return fieldErrors
      .split('\n')
      .map((line) => {
        const [field, ...rest] = line.split(': ');
        const message = rest.join(': ');
        return message ? `${field}: ${translateFieldMessage(message)}` : translateFieldMessage(line);
      })
      .join('\n');
  }

  return statusFallback(status, fallback);
}

export function getLoginErrorMessage(error: any) {
  const status = error?.response?.status;
  const detail = error?.response?.data?.detail;

  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    String(detail || '').toLowerCase().includes('invalid email or password')
  ) {
    return 'Неверный логин или пароль';
  }

  return getApiErrorMessage(error, 'Не удалось войти. Попробуйте ещё раз');
}
