export type CommunicationChannel = "email" | "phone" | "whatsapp" | "in_person" | "other";
export type CommunicationDirection = "inbound" | "outbound" | "internal";
export type CommunicationSource = "mail_server" | "manual" | "system";

export interface CommunicationRecord {
  id: string;
  channel: CommunicationChannel;
  direction: CommunicationDirection;
  source: CommunicationSource;
  subject: string;
  sender: string | null;
  recipients: string[];
  body_text: string | null;
  message_id: string | null;
  customer_reference: string | null;
  document_reference: string | null;
  sent_at: string | null;
  received_at: string | null;
  declared_at: string | null;
  imported_at: string;
  created_at: string;
  created_by: string | null;
  created_by_name: string | null;
  source_file_name: string | null;
  raw_sha256: string | null;
}

export interface ManualCommunicationInput {
  channel: Exclude<CommunicationChannel, "email">;
  direction: CommunicationDirection;
  subject: string;
  counterpart: string;
  body: string;
  declaredAt: string;
  customerReference?: string;
  documentReference?: string;
}
