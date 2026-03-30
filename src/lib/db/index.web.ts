let initialized = false;

type WebDbStub = {
  kind: 'web-local-storage-stub';
};

const webDbStub: WebDbStub = {
  kind: 'web-local-storage-stub',
};

export async function initializeDatabase(): Promise<void> {
  if (initialized) return;

  if (typeof window !== 'undefined') {
    const key = 'akyl_cheshmesi_web_db_initialized';
    if (!window.localStorage.getItem(key)) {
      window.localStorage.setItem(key, 'true');
    }
  }

  initialized = true;
}

export async function getDb(): Promise<WebDbStub> {
  await initializeDatabase();
  return webDbStub;
}