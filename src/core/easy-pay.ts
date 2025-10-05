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
} from "../types/index";
import { nanoid } from "nanoid";
import axios from "axios";

export class easyPay {
	private options: EasyPaymentProps;
	public isLoading: boolean = false;
	public error: string | undefined;

	private chapaUrl = "https://inline.chapaservices.net/v1/inline/charge";
	private chapaHostedUrl = "https://api.chapa.co/v1/hosted/pay";
	private chapaVerifyUrl = "https://inline.chapaservices.net/v1/inline/validate";
	private chapaAcceptPaymentUrl = "https://api.chapa.co/v1/transaction/initialize";

	private paymentOption:
		| "telebirr"
		| "cbebirr"
		| "ebirr"
		| "mpesa"
		| "chapa";

	constructor(options: EasyPaymentProps) {
		const result = easyPaySchema.safeParse(options);

		if (!result.success) {
			throw new Error(z.prettifyError(result.error));
		}

		this.options = {
			...result.data,
			paymentOptions: result.data.paymentOptions ?? ["telebirr", "cbebirr", "ebirr", "mpesa", "chapa"],
			generateRefId: result.data.generateRefId ?? (() => nanoid(10)),
			onSuccess: result.data.onSuccess ?? (() => { }),
			onFailure: result.data.onFailure ?? (() => { })
		};

		this.paymentOption = this.options.paymentOptions![0] ?? "chapa";
	}

	// ------------------ PUBLIC METHODS ------------------

	async createPayment(paymentOptions: CreatePaymentProps) {
		this.isLoading = true;
		try {
			const validatedData = this.validateSchema(createPaymentSchema, paymentOptions, "Payment validation failed");
			if (!validatedData) return { success: false, message: this.error };

			const paymentData: PaymentData = {
				amount: validatedData.amount.toString(),
				mobile: validatedData.mobile,
				currency: "ETB",
				payment_method: validatedData.paymentType ?? "telebirr",
				tx_ref: validatedData.txRef ?? this.generateRefId(),
				email: validatedData.email,
				first_name: validatedData.first_name,
				last_name: validatedData.last_name
			};

			const response = await this.initiatePayment(paymentData);
			return response;
		} catch (error: any) {
			return this.handleError("Error while creating payment", error);
		} finally {
			this.isLoading = false;
		}
	}

	async verifyPayment(refId: string, paymentMethod: string) {
		this.isLoading = true;
		try {
			let isVerified = false;
			let retries = 0;
			const maxRetry = this.options.maxRetry ?? 3;
			const retryDelay = (this.options.retryDelay ?? 3) * 1000;

			while (!isVerified && retries < maxRetry) {
				const verifyFormData = new FormData();
				verifyFormData.append("reference", refId);
				verifyFormData.append("payment_method", paymentMethod);

				const verifyResponse = await this.post<VerifyPaymentResponse>(this.chapaVerifyUrl, verifyFormData, {
					Authorization: `Bearer ${this.options.publicKey}`
				});

				if (verifyResponse.status === "success") {
					isVerified = true;
					this.error = undefined;
					this.options.onSuccess?.({
						amount: verifyResponse.data!.amount,
						txRef: verifyResponse.trx_ref,
						createdAt: verifyResponse.data!.created_at
					});
					return { success: true, data: verifyResponse };
				}

				if (verifyResponse.data?.status !== "pending") {
					return this.handleError(`Payment verification failed: ${verifyResponse.message}`);
				}

				retries++;
				await this.delay(retryDelay);
			}

			return this.handleError("Payment verification timed out");
		} catch (error: any) {
			return this.handleError("Error during payment verification", error);
		} finally {
			this.isLoading = false;
		}
	}

	// ------------------ PRIVATE METHODS ------------------

	private async initiatePayment(paymentData: PaymentData) {
		try {
			this.paymentOption = paymentData.payment_method ?? this.options.paymentOptions![0];

			if (this.paymentOption === "chapa") {
				const chapaResponse = await this.submitChapa(paymentData);

				if (!chapaResponse || !("status" in chapaResponse) || chapaResponse.status !== "success") {
					return this.handleError("Chapa payment initiation failed");
				}

				return { success: true, data: chapaResponse };
			}

			const formData = new FormData();
			for (const [key, value] of Object.entries(paymentData)) {
				if (value !== undefined && value !== null) {
					formData.append(key, typeof value === "object" ? JSON.stringify(value) : value.toString());
				}
			}

			const initiatePaymentResponse = await this.post<InitiatePaymentResponse>(this.chapaUrl, formData, {
				Authorization: `Bearer ${this.options.publicKey}`
			});

			if (initiatePaymentResponse.status !== "success") {
				return this.handleError(`Transaction initiation failed: ${initiatePaymentResponse.message}`);
			}

			const refId = initiatePaymentResponse.data.meta.ref_id;
			return await this.verifyPayment(refId, paymentData.payment_method);
		} catch (error: any) {
			return this.handleError("Error during transaction", error);
		}
	}

	private async submitChapa(paymentData: PaymentData) {
		if (!this.options.secretKey) {
			return this.handleError(
				"Cannot initiate Chapa payment: Secret key is missing. Please provide your Chapa secret key."
			);
		}

		const fields: Record<string, string> = {
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
			...(paymentData.customization && { customization: JSON.stringify(paymentData.customization) }),
			...(paymentData.meta && { meta: JSON.stringify(paymentData.meta) })
		};

		const formData = new FormData();
		for (const [key, value] of Object.entries(fields)) {
			formData.append(key, value);
		}

		const data = await this.post<PaymentWithChapaResponse>(this.chapaAcceptPaymentUrl, formData, {
			Authorization: `Bearer ${this.options.secretKey}`
		});

		if (data.status !== "success") {
			return this.handleError(`Chapa payment initiation failed: ${data.message}`);
		}

		this.options.onSuccess?.({ message: data.message, data: data.data ?? null, status: data.status });
		return data;
	}

	private async post<T>(url: string, data: any, headers?: Record<string, string>) {
		try {
			const response = await axios.post<T>(url, data, { headers });
			return response.data;
		} catch (error: any) {
			throw new Error(error?.message ?? "Unknown axios error");
		}
	}

	private delay(ms: number) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	private handleError(message: string, originalError?: any) {
		const fullMessage = originalError ? `${message}: ${originalError?.message ?? originalError}` : message;
		this.error = fullMessage;
		this.options.onFailure?.(fullMessage);
		return { success: false, message: fullMessage };
	}

	private validateSchema<T>(schema: z.ZodSchema<T>, data: unknown, errorMessage?: string): T | undefined {
		const result = schema.safeParse(data);
		if (!result.success) {
			this.handleError(errorMessage ?? "Validation failed", z.prettifyError(result.error));
			return undefined;
		}
		return result.data;
	}

	generateRefId(size?: number) {
		return nanoid(size ?? 10);
	}
}
