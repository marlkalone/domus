export default () => ({
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    apiVersion: process.env.STRIPE_API_VERSION || "2025-06-30.basil",
  },
});
