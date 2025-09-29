import z from "zod"

const PaymentOptions = z.enum([
	"telebirr",
	"cbebirr",
	"ebirr",
	"mpesa",
	"chapa"
])

export const easyPaySchema = z.object({
	publicKey: z.string().min(8).regex(/^CHAPUBK.*$/, {
		error: "String must start with 'CHAPUBK'"
	}),
	secretKey: z.string().min(8).regex(/^CHASECK.*$/, {
		error: "String must start with 'CHASECK'"
	}).optional(),
	paymentOptions: z.array(PaymentOptions).default([
		"telebirr",
		"cbebirr",
		"ebirr",
		"mpesa",
		"chapa"
	]).optional(),
	generateRefId: z.function({
		input: [],
		output: z.string()
	})
		.optional(),
	callbackUrl: z.url().optional(),
	returnUrl: z.url().optional(),
	onSuccess: z.function({
		input: [
			z.union([
				z.object({
					amount: z.string(),
					txRef: z.string(),
					createdAt: z.string(),
				}).optional(),
				z.object({
					message: z.string(),
					status: z.string(),
					data: z.object({
						checkout_url: z.string(),
					}).nullable(),
				}).optional(),
			]),
		],
		output: z.void()
	}).optional(),
	onFailure: z.function({
		input: [z.string().optional()],
		output: z.void()
	}).optional(),
	maxRetry: z.number().default(3).optional(),
	retryDelay: z.number().default(3).optional()
	// verifyPaymentOnSuccess: z.boolean().default(true).optional()
})

export const createPaymentSchema = z.object({
	mobile: z
		.string()
		.refine((val) => /^(251\d{9}|0\d{9}|9\d{8}|7\d{8})$/.test(val), {
			message: "Please enter a valid Phone Number.",
		}),
	paymentType: PaymentOptions,
	amount: z.number().min(1, "Minimum amount must be at least 1"),
	txRef: z.string().min(3, "txRef must be at least 3 characters long").optional(),
	email: z.email().optional(),
	first_name: z.string().optional(),
	last_name: z.string().optional(),
	customization: z.object({
		logo: z.url().optional(),
		title: z.string().optional(),
		description: z.string().optional()
	}).optional(),
	meta: z.record(z.string(), z.any()).optional()
}).refine(
	(data) => {
		if (data.paymentType === "telebirr") {
			return /^(2519\d{8}|09\d{8}|9\d{8})$/.test(data.mobile);
		}
		return true;
	},
	{
		message: "Please enter a valid Telebirr Phone Number.",
		path: ["mobile"],
	}
)
	.refine(
		(data) => {
			if (data.paymentType === "mpesa") {
				return /^(2517\d{8}|07\d{8}|7\d{8})$/.test(data.mobile);
			}
			return true;
		},
		{
			message: "Please enter a valid Mpesa Phone Number.",
			path: ["mobile"],
		}
	);


export type EasyPaymentProps = z.infer<typeof easyPaySchema>
export type CreatePaymentProps = z.infer<typeof createPaymentSchema>

export type InitiatePaymentResponse = {
	message: string,
	status: string,
	data: {
		auth_type: "ussd",
		requestID: string,
		meta: {
			message: "Payment successfully initiated with telebirr",
			status: string,
			ref_id: string,
			payment_status: string
		},
		mode: string
	}
}

export type PaymentData = {
	amount: string;
	mobile: string;
	currency: "ETB";
	payment_method: "telebirr" | "cbebirr" | "ebirr" | "mpesa" | "chapa";
	tx_ref: string;
	email?: string;
	first_name?: string;
	last_name?: string;
	customization?: {
		logo?: string | undefined;
		title?: string | undefined;
		description?: string | undefined;
	} | undefined;
	meta?: Record<string, any> | undefined;
}

export type VerifyPaymentResponse = {
	message: string,
	trx_ref: string,
	processor_id: string | null,
	data?: {
		amount: string,
		charge: string,
		status: string,
		created_at: string,
	},
	status: string,
}

export type PaymentWithChapaResponse = {
	message: string,
	status: "success" | "failed",
	data?: {
		checkout_url: string,
	},
}