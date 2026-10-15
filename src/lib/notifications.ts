/**
 * Notificaciones del sistema para las alertas de precio. Se muestran a través
 * del service worker (necesario en Android y en la PWA instalada) y, si no
 * hay, con la API de Notification. Sin servidor de push: solo funcionan con
 * la app abierta o en segundo plano reciente.
 */
export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export const notificationPermission = (): NotificationPermission | "unsupported" =>
  notificationsSupported() ? Notification.permission : "unsupported";

export async function requestNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  return Notification.requestPermission();
}

export async function showNotification(title: string, body: string, tag: string) {
  if (notificationPermission() !== "granted") return;
  const options: NotificationOptions = { body, tag, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png" };
  try {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (registration) {
      await registration.showNotification(title, options);
      return;
    }
  } catch {
    // Sin service worker: se usa la API directa.
  }
  new Notification(title, options);
}
