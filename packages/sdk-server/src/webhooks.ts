import { formatAccountantCsv } from "@pulsepay/shared";

export { formatAccountantCsv };

export interface WebhookPayload {
  eventId: string;
  eventType: string;
  timestamp: number;
  data: Record<string, unknown>;
}


