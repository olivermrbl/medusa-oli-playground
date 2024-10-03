const { loadEnv, defineConfig } = require("@medusajs/utils")
const { Modules } = require("@medusajs/utils")

loadEnv(process.env.NODE_ENV, process.cwd())

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    redisUrl: process.env.REDIS_URL,
    http: {
      storeCors: process.env.STORE_CORS,
      adminCors: process.env.ADMIN_CORS,
      authCors: process.env.AUTH_CORS,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    },
    notifications: {
      events: [
        {
          event: "order.placed",
          template: "d-5d519dfba769437886c33a6d55430eb2",
          channel: "email",
          to: "email",
          data: {
            order_id: "id",
            display_id: "display_id",
          },
        },
        {
          event: "order.placed",
          template: "",
          channel: "feed",
          to: "email",
          data: {
            order_id: "id",
            display_id: "display_id",
          },
        },
      ],
    },
  },
  modules: {
    [Modules.PAYMENT]: {
      resolve: "@medusajs/medusa/payment",
      options: {
        providers: [
          {
            resolve: "@medusajs/payment-stripe",
            id: "stripe",
            options: {
              apiKey: process.env.STRIPE_API_KEY,
              webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
            },
          },
          {
            resolve: "./modules/payment-adyen",
            id: "adyen",
            options: {
              apiKey: process.env.ADYEN_API_KEY,
              returnUrl: process.env.ADYEN_RETURN_URL,
              merchantAccount: process.env.ADYEN_MERCHANT_ACCOUNT,
            },
          },
        ],
      },
    },
    [Modules.NOTIFICATION]: {
      resolve: "@medusajs/medusa/notification",
      options: {
        providers: [
          // {
          //   resolve: "@medusajs/notification-sendgrid",
          //   id: "sendgrid",
          //   options: {
          //     channels: ["email"],
          //     api_key: process.env.SENDGRID_API_KEY,
          //     from: "hello@medusajs.com",
          //   },
          // },
          {
            resolve: "@medusajs/medusa/notification-local",
            id: "local",
            options: {
              channels: ["feed", "log", "email"],
            },
          },
        ],
      },
    },
    [Modules.WORKFLOW_ENGINE]: {
      resolve: "@medusajs/workflow-engine-redis",
      options: {
        redis: { url: process.env.REDIS_URL },
      },
    },
    [Modules.AUTH]: {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
          },
          // {
          //   resolve: "@medusajs/auth-google",
          //   id: "google",
          //   options: {
          //     clientID: process.env.GOOGLE_CLIENT_ID,
          //     clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          //     callbackURL: process.env.GOOGLE_CALLBACK_URL,
          //   },
          // },
        ],
      },
    },
  },
})
