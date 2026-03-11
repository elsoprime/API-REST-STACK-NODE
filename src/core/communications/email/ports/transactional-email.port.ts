import {
  type TransactionalEmailDeliveryResult,
  type TransactionalEmailMessage
} from '@/core/communications/email/types/email.types';

export interface TransactionalEmailPort {
  send: (message: TransactionalEmailMessage) => Promise<TransactionalEmailDeliveryResult>;
}
