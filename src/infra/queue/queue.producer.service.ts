import { Injectable } from "@nestjs/common";
import { SqsService } from "@ssut/nestjs-sqs";
import { v4 as uuidv4 } from "uuid";

export const EMAIL_PRODUCER_NAME = "email-producer";
export const STORAGE_PRODUCER_NAME = "storage-producer";

@Injectable()
export class QueueProducerService {
  constructor(private readonly sqsService: SqsService) {}

  /**
   * Envia uma mensagem para a fila de e-mails.
   * @param jobName O nome do "trabalho" (ex: "sendVerification")
   * @param payload Os dados para o job (ex: { email, token })
   */
  async sendEmailJob(jobName: string, payload: any): Promise<void> {
    try {
      await this.sqsService.send(EMAIL_PRODUCER_NAME, {
        id: uuidv4(),
        body: JSON.stringify(payload),
        messageAttributes: {
          JobName: {
            DataType: "String",
            StringValue: jobName,
          },
        },
      });
    } catch (error) {
      console.error(`Failed to send SQS message for job: ${jobName}`, error);
      throw error;
    }
  }

  async sendStorageCleanupJob(key: string): Promise<void> {
    try {
      await this.sqsService.send(STORAGE_PRODUCER_NAME, {
        id: uuidv4(),
        body: JSON.stringify({ key }),
      });
    } catch (error) {
      console.error(
        `Failed to send SQS (Storage) message for key ${key}:`,
        error,
      );
      throw error;
    }
  }
}
