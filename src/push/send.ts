import "server-only";
import webpush from "web-push";
import type { PushMessage, PushSubscriptionData } from "@/domain/push";
import { VAPID_PUBLIC_KEY, VAPID_SUBJECT } from "./config";

export type SendResult = "sent" | "gone" | "failed";
export type SendPush = (subscription: PushSubscriptionData, message: PushMessage) => Promise<SendResult>;

export const pushConfigured = () => Boolean(process.env.VAPID_PRIVATE_KEY);

/** Envía una notificación. "gone": el dispositivo se dio de baja y hay que olvidarlo. */
export const sendPush: SendPush = async (subscription, message) => {
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!privateKey) return "failed";
  try {
    await webpush.sendNotification(subscription, JSON.stringify(message), {
      vapidDetails: { subject: VAPID_SUBJECT, publicKey: VAPID_PUBLIC_KEY, privateKey },
      TTL: 12 * 3600,
      urgency: "high",
      topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32),
    });
    return "sent";
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    return status === 404 || status === 410 ? "gone" : "failed";
  }
};
