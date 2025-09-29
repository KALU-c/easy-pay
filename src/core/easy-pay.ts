import z from "zod";
import {
	CreatePaymentProps,
	createPaymentSchema,
	InitiatePaymentResponse,
	PaymentData,
	PaymentWithChapaResponse,
	easyPaySchema,
	VerifyPaymentResponse,
	type EasyPaymentProps
} from "../types/index.js";
import { nanoid } from "nanoid";
import axios from "axios";

export class easyPay {
	private options: EasyPaymentProps
	public isLoading: boolean
	public error: string | undefined

	private chapaUrl: string
	private paymentOption:
		"telebirr" |
		"cbebirr" |
		"ebirr" |
		"mpesa" |
		"chapa";
	private chapaHostedUrl: string
	private chapaVerifyUrl: string
	private chapaAcceptPaymentUrl: string

	constructor(options: EasyPaymentProps) {
		const result = easyPaySchema.safeParse(options);

		if (!result.success) {
			throw new Error(z.prettifyError(result.error))
		}

		this.options = {
			...result.data,
			paymentOptions: result.data.paymentOptions ?? [
				"telebirr",
				"cbebirr",
				"ebirr",
				"mpesa",
				"chapa"
			],
			generateRefId: result.data.generateRefId ?? (() => nanoid(10)),
			onSuccess: result.data.onSuccess ?? (() => { }),
			onFailure: result.data.onFailure ?? (() => { })
		}

		this.isLoading = false
		this.error = undefined
		this.paymentOption = this.options.paymentOptions![0] ?? "chapa"
		this.chapaUrl = "https://inline.chapaservices.net/v1/inline/charge"
		this.chapaHostedUrl = "https://api.chapa.co/v1/hosted/pay"
		this.chapaVerifyUrl = "https://inline.chapaservices.net/v1/inline/validate"
		this.chapaAcceptPaymentUrl = "https://api.chapa.co/v1/transaction/initialize"
	}

	async createPayment(paymentOptions: CreatePaymentProps) {
		this.isLoading = true
		const result = createPaymentSchema.safeParse(paymentOptions)

		if (!result.success) {
			this.error = z.prettifyError(result.error);
			this.options.onFailure?.(this.error);
			return;
		}

		try {
			const paymentData: PaymentData = {
				amount: result.data.amount.toString(),
				mobile: result.data.mobile,
				currency: "ETB",
				payment_method: result.data.paymentType ?? "telebirr",
				tx_ref: result.data.txRef ?? this.generateRefId(),
				email: result.data.email,
				first_name: result.data.first_name,
				last_name: result.data.last_name
			}

			const initiatePaymentResponse = await this.initiatePayment(paymentData)
			this.error = undefined;

			return initiatePaymentResponse
		} catch (error) {
			this.error = "Error while creating payment";
			this.options.onFailure?.(this.error);
			return;
		} finally {
			this.isLoading = false
		}
	}

	async verifyPayment(refId: string, paymentMethod: string) {
		this.isLoading = true
		try {
			let isVerified = false;
			let retries = 0;

			while (!isVerified && (retries < (this.options.maxRetry ?? 3))) {
				const verifyFormData = new FormData();

				verifyFormData.append("reference", refId);
				verifyFormData.append("payment_method", paymentMethod);

				const { data: verifyResponse } = await axios.post<VerifyPaymentResponse>(
					this.chapaVerifyUrl,
					verifyFormData,
					{
						headers: {
							Authorization: `Bearer ${this.options.publicKey}`,
						},
					})

				if (verifyResponse.status !== "success") {
					this.error = `Payment verification failed: ${verifyResponse.message}`
				}

				if (verifyResponse.status === "success") {
					isVerified = true;
					this.error = undefined;
					this.options.onSuccess?.({
						amount: verifyResponse.data!.amount,
						txRef: verifyResponse.trx_ref,
						createdAt: verifyResponse.data!.created_at
					});
					return verifyResponse;
				} else if (verifyResponse.data?.status !== "pending") {
					this.error = `Payment verification failed: ${verifyResponse.message}`
					this.options.onFailure?.(this.error);
					break;
				}

				retries++;
				await this.delay((this.options.retryDelay ?? 3) * 1000)
			}
		} catch (error: any) {
			this.error = `Error during payment verification: ${error?.message ?? ""}`
			this.options.onFailure?.(this.error);
		} finally {
			this.isLoading = false
		}
	}

	private async initiatePayment(paymentData: PaymentData) {
		try {
			this.paymentOption = paymentData.payment_method ?? this.options.paymentOptions![0]

			if (this.paymentOption === "chapa") {
				const chapaResponse = await this.submitChapa(paymentData)
				return chapaResponse
			}

			const formData = new FormData();

			for (const [key, value] of Object.entries(paymentData)) {
				if (value !== undefined && value !== null) {
					if (typeof value === "object") {
						formData.append(key, JSON.stringify(value));
					} else {
						formData.append(key, value.toString());
					}
				}
			}

			const { data: initiatePaymentResponse } = await axios.post<InitiatePaymentResponse>(
				this.chapaUrl,
				formData,
				{
					headers: {
						Authorization: `Bearer ${this.options.publicKey}`,
					},
				});
			if (initiatePaymentResponse.status !== "success") {
				this.error = `Transaction initiation failed: ${initiatePaymentResponse.message}`
				this.options.onFailure?.(this.error);
				return
			}

			const refId = initiatePaymentResponse.data.meta.ref_id;

			return await this.verifyPayment(refId, paymentData.payment_method);
		} catch (error: any) {
			this.error = `Error during transaction: ${error?.message ?? ""}`;
			this.options.onFailure?.(this.error);
			return
		}
	}

	private async submitChapa(paymentData: PaymentData) {
		if (!this.options.secretKey) {
			this.error = "Cannot initiate Chapa payment: Secret key is missing. Please provide your Chapa secret key in the client configuration.";
			this.options.onFailure?.(this.error);
			return;
		}

		const fields = {
			public_key: this.options.publicKey,
			tx_ref: paymentData.tx_ref,
			amount: paymentData.amount,
			currency: paymentData.currency,
			first_name: paymentData.first_name ?? "",
			last_name: paymentData.last_name ?? "",
			email: paymentData.email ?? "",
			phone_number: paymentData.mobile,
			...(this.options.callbackUrl && { callback_url: this.options.callbackUrl }),
			...(this.options.returnUrl && { return_url: this.options.returnUrl }),
			...(paymentData.customization && {
				customization: JSON.stringify(paymentData.customization)
			}),
			...(paymentData.meta && {
				meta: JSON.stringify(paymentData.meta)
			})
		}

		const formData = new FormData();
		for (const [key, value] of Object.entries(fields)) {
			formData.append(key, value);
		}

		try {
			const { data } = await axios.post<PaymentWithChapaResponse>(this.chapaAcceptPaymentUrl, formData, {
				headers: {
					Authorization: `Bearer ${this.options.secretKey}`
				},
			});

			if (data.status === "success") {
				this.options.onSuccess?.({
					message: data.message,
					data: data.data ?? null,
					status: data.status
				})
				return data;
			} else {
				this.error = `Chapa payment initiation failed: ${data.message}. Please check your payment details, secret key, and try again.`;
				this.options.onFailure?.(this.error);
			}
		} catch (error: any) {
			this.error = `Error during payment submission: ${error?.message ?? "Unknown error"}`;
			this.options.onFailure?.(this.error);
		}
	}

	private delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	generateRefId(size?: number) {
		return nanoid(size ?? 10)
	}
}