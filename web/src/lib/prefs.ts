// Kullanıcı tercihleri (localStorage). Yeni arayüz eski arayüzün anahtarlarıyla çakışmamak için kendi önekini kullanır
// (review L-2). Okunamayan/geçersiz değerlerde çağıran belgelenmiş varsayılana döner.
export const PREF_PREFIX = 'poltask.web.';

export function loadPref(key: string): string | null {
  try {
    return window.localStorage.getItem(PREF_PREFIX + key);
  } catch {
    return null;
  }
}

export function savePref(key: string, value: string): void {
  try {
    window.localStorage.setItem(PREF_PREFIX + key, value);
  } catch {
    /* depolama kapalı: tercih yalnız bu oturumda geçerli */
  }
}
