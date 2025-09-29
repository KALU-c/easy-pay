# EasyPay

A TypeScript/JavaScript client to integrate payment services (Chapa, Telebirr, M-Pesa, Ebirr, CBE Birr) easily in web or Node.js applications. Supports inline payments, hosted payments, and automatic payment verification with retries.

---

## Installation

```bash
npm install @realkal/easy-pay
# or
yarn add @realkal/easy-pay
pnpm add @realkal/easy-pay
```

---

## Importing

```ts
import { easyPay } from "@realkal/easy-pay";
```

---

## Client Configuration (`easyPay`)

| Option           | Type                      | Required | Default                                          | Description                                   |
| ---------------- | ------------------------- | -------- | ------------------------------------------------ | --------------------------------------------- |
| `publicKey`      | `string`                  | ✅       | -                                                | Chapa public key                              |
| `secretKey`      | `string`                  | ❌       | -                                                | Chapa secret key, required for Chapa payments |
| `paymentOptions` | `string[]`                | ❌       | `["telebirr","cbebirr","ebirr","mpesa","chapa"]` | Allowed payment methods                       |
| `callbackUrl`    | `string`                  | ❌       | -                                                | URL to receive server-side callback           |
| `returnUrl`      | `string`                  | ❌       | -                                                | URL to redirect after payment                 |
| `generateRefId`  | `() => string`            | ❌       | Random nanoid(10)                                | Custom transaction reference generator        |
| `onSuccess`      | `(paymentInfo) => void`   | ❌       | `() => {}`                                       | Callback after successful payment             |
| `onFailure`      | `(error: string) => void` | ❌       | `() => {}`                                       | Callback after failed payment                 |
| `maxRetry`       | `number`                  | ❌       | 3                                                | Max retries for pending payments              |
| `retryDelay`     | `number`                  | ❌       | 3                                                | Delay between retries in seconds              |

---

## Payment Properties (`CreatePaymentProps`)

| Property        | Type                                                       | Required | Description                                               |
| --------------- | ---------------------------------------------------------- | -------- | --------------------------------------------------------- |
| `mobile`        | `string`                                                   | ✅       | User phone number, validated per payment type             |
| `paymentType`   | `"telebirr" \| "cbebirr" \| "ebirr" \| "mpesa" \| "chapa"` | ✅       | Payment method                                            |
| `amount`        | `number`                                                   | ✅       | Payment amount (minimum 1)                                |
| `txRef`         | `string`                                                   | ❌       | Optional transaction reference, auto-generated if missing |
| `email`         | `string`                                                   | ❌       | Customer email                                            |
| `first_name`    | `string`                                                   | ❌       | Customer first name                                       |
| `last_name`     | `string`                                                   | ❌       | Customer last name                                        |
| `customization` | `object`                                                   | ❌       | Payment UI customization options                          |
| `meta`          | `Record<string, any>`                                      | ❌       | Extra metadata attached to the payment                    |

**Customization object:**

```ts
customization: {
  logo?: string;        // URL to logo
  title?: string;       // Payment title
  description?: string; // Payment description
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

## Usage

### 1. Basic Chapa Payment

```ts
await easyPay.createPayment({
  mobile: "0900123456",
  amount: 500,
  paymentType: "chapa",
  first_name: "Endekalu",
  last_name: "Zemenu",
  email: "realkal.ez@gmail.com",
});
```

---

### 2. Payment with Customization

```ts
await easyPay.createPayment({
  mobile: "0700123456",
  amount: 300,
  paymentType: "mpesa",
  customization: {
    logo: "https://example.com/logo.png",
    title: "Donation",
    description: "Support our cause",
  },
});
```

---

### 3. Payment with Metadata

```ts
await easyPay.createPayment({
  mobile: "0900123456",
  amount: 200,
  paymentType: "telebirr",
  meta: {
    campaignId: "CAMPAIGN123",
    userId: "USER456",
    notes: "Priority user",
  },
});
```

---

### 4. Payment with Custom `txRef` and Retry Options

```ts
await easyPay.createPayment({
  mobile: "0900123456",
  amount: 1000,
  paymentType: "chapa",
  txRef: "CUSTOM_REF_123",
  meta: { orderId: "ORDER789" },
});
```

---

### 5. Full Example (All Options)

```ts
const easyPay = new easyPay({
  publicKey: "CHAPUBK-xxxxxxxx",
  secretKey: "CHASECK-xxxxxxxx",
  callbackUrl: "https://example.com/callback",
  returnUrl: "https://example.com/return",
  maxRetry: 5,
  retryDelay: 5,
  onSuccess: (paymentInfo) => console.log("Payment succeeded:", paymentInfo),
  onFailure: (error) => console.log("Payment failed:", error),
});

await easyPay.createPayment({
  mobile: "0900123456",
  amount: 750,
  paymentType: "telebirr",
  first_name: "Endekalu",
  last_name: "Zemenu",
  email: "realkal.ez@gmail.com",
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
```

---

## Payment Verification

```ts
const verification = await easyPay.verifyPayment("TX_REF_123", "chapa");
console.log(verification);
```

- Automatically retries if the payment is pending.
- Calls `onSuccess` or `onFailure` callbacks automatically.

---

## License

MIT © Endekalu Zemenu
