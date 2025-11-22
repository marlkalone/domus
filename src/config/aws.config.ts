export default () => ({
  aws: {
    bucket: process.env.AWS_BUCKET_NAME,
    region: process.env.AWS_REGION,
    accessKey: process.env.AWS_ACCESS_KEY_ID,
    secretKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});
