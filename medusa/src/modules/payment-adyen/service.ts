import { CheckoutAPI, Client, Config, Types } from "@adyen/api-library"
import {
  CreatePaymentProviderSession,
  PaymentProviderError,
  PaymentProviderSessionResponse,
  ProviderWebhookPayload,
  UpdatePaymentProviderSession,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  AbstractPaymentProvider,
  isDefined,
  isPaymentProviderError,
  PaymentActions,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { EOL } from "os"
import { getSmallestUnit } from "./utils"

type AdyenPaymentResponse = Pick<
  Types.checkout.PaymentResponse,
  keyof Types.checkout.PaymentResponse
>

type Options = {
  apiKey: string
  liveEndpointPrefix: string
  origin: string
  merchantAccount: string
  returnUrl: string
  environment: Environment
}

class AdyenPaymentProviderService extends AbstractPaymentProvider<Options> {
  static PROVIDER = "adyen"

  protected adyenClient_: Client
  protected checkout: CheckoutAPI
  protected options_: Options

  static validateOptions(options: Options): void {
    if (!isDefined(options.apiKey)) {
      throw new Error("Required option `apiKey` is missing in Adyen plugin")
    }

    if (!isDefined(options.merchantAccount)) {
      throw new Error(
        "Required option `merchantAccount` is missing in Adyen plugin"
      )
    }

    if (!isDefined(options.returnUrl)) {
      throw new Error("Required option `returnUrl` is missing in Adyen plugin")
    }
  }

  constructor({}, options: Options) {
    super(arguments[0])

    this.options_ = options

    this.adyenClient_ = this.initAdyenClient()
    this.checkout = new CheckoutAPI(this.adyenClient_)
  }

  initAdyenClient() {
    const config = new Config()
    config.apiKey = this.options_.apiKey

    const client = new Client({
      config,
    })

    const env = this.options_.environment ?? "TEST"

    if (this.options_.liveEndpointPrefix) {
      client.setEnvironment(env, this.options_.liveEndpointPrefix)
    } else {
      client.setEnvironment(env)
    }

    return client
  }

  async getPaymentStatus(
    paymentSessionData: Types.checkout.SessionResultResponse
  ): Promise<PaymentSessionStatus> {
    switch (paymentSessionData.status) {
      case Types.checkout.SessionResultResponse.StatusEnum.PaymentPending:
        return PaymentSessionStatus.PENDING
      case Types.checkout.SessionResultResponse.StatusEnum.Canceled:
        return PaymentSessionStatus.CANCELED
      case Types.checkout.SessionResultResponse.StatusEnum.Completed:
        return PaymentSessionStatus.AUTHORIZED
      case Types.checkout.SessionResultResponse.StatusEnum.Refused:
        return PaymentSessionStatus.ERROR
      default:
        return PaymentSessionStatus.PENDING
    }
  }

  async getWebhookActionAndData(
    data: ProviderWebhookPayload["payload"]
  ): Promise<WebhookActionResult> {
    return { action: PaymentActions.NOT_SUPPORTED }
  }

  async initiatePayment(
    input: CreatePaymentProviderSession
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse> {
    const { session_id, cart } = input.context
    const { currency_code, amount } = input

    const countryCode = cart.shipping_address?.country_code

    if (!cart.shipping_address?.country_code) {
      return this.buildError(
        "An error occurred in initiatePayment during the creation of the Adyen session",
        {
          name: "NoShippingAddress",
          message: "No shipping address found on cart",
        }
      )
    }

    let createCheckoutSessionRequest: Types.checkout.CreateCheckoutSessionRequest =
      {
        reference: session_id,
        amount: {
          currency: currency_code.toUpperCase(),
          value: getSmallestUnit(amount, currency_code),
        },
        merchantAccount: this.options_.merchantAccount,
        countryCode,
        returnUrl: this.options_.returnUrl,
      }

    let sessionResponse: Types.checkout.CreateCheckoutSessionResponse

    try {
      sessionResponse = await this.checkout.PaymentsApi.sessions(
        createCheckoutSessionRequest
      )
    } catch (error) {
      return this.buildError(
        "An error occurred in initiatePayment during the creation of the Adyen session",
        error as Error
      )
    }

    return {
      data: sessionResponse as unknown as Record<string, unknown>,
    }
  }

  async retrievePayment(
    data: Record<string, unknown>
  ): Promise<PaymentProviderError | Record<string, unknown>> {
    try {
      const session = await this.checkout.PaymentsApi.getResultOfPaymentSession(
        data.id as string,
        data.sessionResult as string
      )

      return session as unknown as Record<string, unknown>
    } catch (e) {
      return this.buildError("An error occurred in retrievePayment", e as Error)
    }
  }

  async authorizePayment(
    data: any,
    context: Record<string, unknown>
  ): Promise<
    | PaymentProviderError
    | {
        status: PaymentSessionStatus
        data: AdyenPaymentResponse
      }
  > {
    try {
      const session = (await this.retrievePayment(
        data
      )) as unknown as Types.checkout.SessionResultResponse
      const status = await this.getPaymentStatus(session)

      return { data: data, status }
    } catch (error) {
      return this.buildError(
        "An error occurred in authorizePayment during the authorization of the Adyen session",
        error as Error
      )
    }
  }

  async updatePayment(
    input: UpdatePaymentProviderSession
  ): Promise<
    | PaymentProviderError
    | (PaymentProviderSessionResponse & { status: PaymentSessionStatus })
  > {
    const session = (await this.retrievePayment(
      input
    )) as unknown as Types.checkout.SessionResultResponse

    const status = await this.getPaymentStatus(session)

    return { data: input.data, status }
  }

  async capturePayment(
    data: Record<string, unknown> & AdyenPaymentResponse
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
    const pspReference = data.pspReference
    const { currency, value } = data.amount

    try {
      const response =
        await this.checkout.ModificationsApi.captureAuthorisedPayment(
          pspReference,
          {
            amount: {
              currency,
              value,
            },
            merchantAccount: this.options_.merchantAccount,
          }
        )

      return { ...response, pspReference }
    } catch (error) {
      return this.buildError(
        "An error occurred in capturePayment during the capture of the Adyen session",
        error as Error
      )
    }
  }

  async refundPayment(
    data: Record<string, unknown> & AdyenPaymentResponse,
    refundAmount: number
  ): Promise<PaymentProviderSessionResponse["data"] | PaymentProviderError> {
    const pspReference = data.pspReference
    const { currency } = data.amount

    try {
      const response =
        await this.checkout.ModificationsApi.refundCapturedPayment(
          pspReference,
          {
            amount: {
              currency,
              value: refundAmount,
            },
            merchantAccount: this.options_.merchantAccount,
          }
        )

      return { ...response, pspReference }
    } catch (error) {
      return this.buildError(
        "An error occurred in refundPayment during the refund of the Adyen session",
        error as Error
      )
    }
  }

  async cancelPayment(
    paymentSessionData: AdyenPaymentResponse
  ): Promise<PaymentProviderError | PaymentProviderSessionResponse["data"]> {
    try {
      if (!paymentSessionData.pspReference) {
        return {}
      }

      const res = await this.checkout.ModificationsApi.refundOrCancelPayment(
        paymentSessionData.pspReference,
        {
          merchantAccount: this.options_.merchantAccount,
        }
      )

      return { ...res, pspReference: paymentSessionData.pspReference }
    } catch (error) {
      throw error
    }
  }

  async deletePayment(
    paymentSessionData: AdyenPaymentResponse
  ): Promise<PaymentProviderSessionResponse["data"] | PaymentProviderError> {
    return await this.cancelPayment(paymentSessionData)
  }

  protected buildError(
    message: string,
    e: PaymentProviderError | Error
  ): PaymentProviderError {
    return {
      error: message,
      code: "code" in e ? e.code : "",
      detail: isPaymentProviderError(e)
        ? `${e.error}${EOL}${e.detail ?? ""}`
        : "detail" in e
        ? e.detail
        : e.message ?? "",
    }
  }
}

export default AdyenPaymentProviderService
