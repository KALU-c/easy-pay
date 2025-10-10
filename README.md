# EasyPay

A TypeScript/JavaScript client to integrate payment services (Chapa, Telebirr, M-Pesa, CBE Birr) easily in web or Node.js applications. Supports inline payments, hosted payments, and automatic payment verification with retries.

### Installation

```bash
npm install @realkal/easy-pay
# or
yarn add @realkal/easy-pay
pnpm add @realkal/easy-pay
```

### Importing

```ts
import { easyPay } from "@realkal/easy-pay";
```

---

### Client Configuration (`easyPay`)

| Option           | Type       | Required | Default                                                                 | Description                                   |
| ---------------- | ---------- | -------- | ----------------------------------------------------------------------- | --------------------------------------------- |
| `publicKey`      | `string`   | ✅        | -                                                                       | Chapa public key                              |
| `secretKey`      | `string`   | ❌        | -                                                                       | Chapa secret key, required for Chapa payments and transaction verification |
| `paymentOptions` | `string[]` | ❌        | ```["telebirr", "cbebirr", "ebirr", "mpesa",   "chapa"]``` | Allowed payment methods                       |
| `callbackUrl`    | `string`   | ❌        | -                                                                       | URL to receive server-side callback           |
| `returnUrl`      | `string`   | ❌        | -                                                                       | URL to redirect after payment                 |
| `generateRefId`  | `() => string` | ❌    | Random `nanoid(10)`                                                     | Custom transaction reference generator        |
| `onSuccess`      | `(paymentInfo: any) => void` | ❌ | `() => {}`                                                           | Callback after successful payment             |
| `onFailure`      | `(error: string) => void`    | ❌ | `() => {}`                                                           | Callback after failed payment                 |
| `maxRetry`       | `number`   | ❌        | 3                                                                       | Max retries for pending payments              |
| `retryDelay`     | `number`   | ❌        | 3                                                                       | Delay between retries in seconds              |

### Payment Properties (`CreatePaymentProps`)

| Property        | Type                                                       | Required | Description                                               |
| --------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------------- |
| `mobile`        | `string`                                                   | ✅        | User phone number, validated per payment type             |
| `paymentType`   | `"telebirr" \| "cbebirr" \| "ebirr" \| "mpesa" \| "chapa"` | ✅        | Payment method                                            |
| `amount`        | `number`                                                   | ✅        | Payment amount (minimum 1)                                |
| `txRef`         | `string`                                                   | ❌        | Optional transaction reference, auto-generated if missing |
| `email`         | `string`                                                   | ❌        | Customer email                                            |
| `first_name`    | `string`                                                   | ❌        | Customer first name                                       |
| `last_name`     | `string`                                                   | ❌        | Customer last name                                        |
| `customization` | `object`                                                   | ❌        | Payment UI customization options                          |
| `meta`          | `Record<string, any>`                                      | ❌        | Extra metadata attached to the payment                    |

**Customization example:**

```ts
customization: {
  logo?: string;
  title?: string;
  description?: string;
}
```

**Meta example:**

```ts
meta: {
  userId: "123",
  campaignId: "456",
  note: "Special instructions"
}
```

---

## Usage Examples (Updated for `EasyPayResponse`)

### 1. Basic Chapa Payment

```ts
const easyPayClient = new easyPay({
  publicKey: "CHAPUBK-xxxxxxxx",
  secretKey: "CHASECK-xxxxxxxx",
});

const result = await easyPayClient.createPayment({
  mobile: "0900123456",
  amount: 500,
  paymentType: "chapa",
  first_name: "John",
  last_name: "Doe",
  email: "johndoe@example.com",
});

if (result.success) {
  console.log("Payment initiated successfully:", result.data);
} else {
  console.error("Payment failed:", result.message);
}
```


### 2. Payment with Customization

```ts
const result = await easyPayClient.createPayment({
  mobile: "0700123456",
  amount: 300,
  paymentType: "mpesa",
  customization: {
    logo: "https://example.com/logo.png",
    title: "Donation",
    description: "Support our cause",
  },
});

if (result.success) {
  console.log("Payment initiated successfully:", result.data);
} else {
  console.error("Payment failed:", result.message);
}
```


### 3. Payment with Metadata

```ts
const result = await easyPayClient.createPayment({
  mobile: "0900123456",
  amount: 200,
  paymentType: "telebirr",
  meta: {
    campaignId: "CAMPAIGN123",
    userId: "USER456",
    notes: "Priority user",
  },
});

if (result.success) {
  console.log("Payment initiated successfully:", result.data);
} else {
  console.error("Payment failed:", result.message);
}
```


### 4. Payment with Custom `txRef`

```ts
const result = await easyPayClient.createPayment({
  mobile: "0900123456",
  amount: 1000,
  paymentType: "chapa",
  txRef: "CUSTOM_REF_123",
  meta: { orderId: "ORDER789" },
});

if (result.success) {
  console.log("Payment initiated successfully:", result.data);
} else {
  console.error("Payment failed:", result.message);
}
```


### 5. Full Example (All Options)

```ts
const easyPayClient = new easyPay({
  publicKey: "CHAPUBK-xxxxxxxx",
  secretKey: "CHASECK-xxxxxxxx",
  callbackUrl: "https://example.com/callback",
  returnUrl: "https://example.com/return",
  maxRetry: 5,
  retryDelay: 5,
  onSuccess: (paymentInfo) => console.log("Payment succeeded:", paymentInfo),
  onFailure: (error) => console.log("Payment failed:", error),
});

const paymentResult = await easyPayClient.createPayment({
  mobile: "0900123456",
  amount: 750,
  paymentType: "telebirr",
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@gmail.com",
  customization: {
    logo: "https://example.com/logo.png",
    title: "Charity Donation",
    description: "Support our campaign",
  },
  meta: {
    userId: "USER123",
    campaignId: "CAMPAIGN456",
    note: "VIP user",
  },
});

if (paymentResult.success) {
  console.log("Payment data:", paymentResult.data);
} else {
  console.error("Payment error:", paymentResult.message);
}
```

### 6. Verify Transaction Server-Side (New)

You can verify any Chapa transaction server-side using `verifyTransaction` with the `secretKey`.

```ts
const transactionResult = await easyPayClient.verifyTransaction("TX_REF_123");

if (transactionResult.success) {
  console.log("Transaction verified successfully:", transactionResult.data);
} else {
  console.error("Transaction verification failed:", transactionResult.message);
}
```

---

## Payment Verification

```ts
const verification = await easyPayClient.verifyPayment("TX_REF_123", "chapa");

if (verification.success) {
  console.log("Payment verified successfully:", verification.data);
} else {
  console.error("Payment verification failed:", verification.message);
}
```

* Automatically retries if the payment is pending.
* Calls `onSuccess` or `onFailure` callbacks automatically.
* Retry behavior is configurable via `maxRetry` and `retryDelay`.


### Return Type (`EasyPayResponse`)

```ts
type EasyPayResponse = {
  success: boolean;
  message: string;
  data?: {
    checkoutUrl?: string; // For Chapa hosted
    txRef?: string;       // For mobile money
    amount?: string;
    status?: string;
    createdAt?: string;
  } | null;
};
```

* Both `createPayment`, `verifyPayment`, and `verifyTransaction` now always return `EasyPayResponse`.
* `message` is always a string.
* `data` is either a populated object or `null`.

---

## Notes

* Supports multiple payment methods in the same configuration.
* Chapa payments and transaction verification require `secretKey`; others do not.
* Inline payments automatically verify transactions.
* Hosted payments return a `checkout_url`.
* Return types are fully type-safe and consistent.


## License

MIT © Endekalu Zemenu
