import { registerAs } from "@nestjs/config";

export default registerAs("sqs", () => ({
  region: process.env.AWS_SQS_REGION || process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  // EMAIL
  emailQueueName: process.env.AWS_SQS_EMAIL_QUEUE_NAME,
  emailQueueUrl: process.env.AWS_SQS_EMAIL_QUEUE_URL,
  // STORAGE
  storageQueueName: process.env.AWS_SQS_STORAGE_QUEUE_NAME,
  storageQueueUrl: process.env.AWS_SQS_STORAGE_QUEUE_URL,
}));
