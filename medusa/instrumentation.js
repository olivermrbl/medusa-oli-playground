const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-proto")
const { registerOtel } = require("@medusajs/medusa")

export function register() {
  // registerOtel({
  //   serviceName: "medusajs",
  //   instrumentation: {
  //     http: true,
  //     query: true,
  //     workflows: true,
  //     database: true,
  //   },
  //   exporter: new OTLPTraceExporter({
  //     url: "https://api.axiom.co/v1/traces", // Axiom API endpoint for trace data
  //     headers: {
  //       Authorization: process.env.AXIOM_API_TOKEN,
  //       "X-Axiom-Dataset": process.env.AXIOM_DATASET,
  //     },
  //   }),
  // })
}
