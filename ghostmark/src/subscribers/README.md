# Custom subscribers

Subscribers handle events emitted in the Medusa application.

> Learn more about Subscribers in [this documentation](https://docs.medusajs.com/learn/fundamentals/events-and-subscribers).

The subscriber is created in a TypeScript or JavaScript file under the `src/subscribers` directory.

For example, create the file `src/subscribers/product-created.ts` with the following content:

```ts
import {
  type SubscriberConfig,
} from "@medusajs/framework"

// subscriber function
export default async function productCreateHandler() {
  console.log("A product was created")
}

// subscriber config
export const config: SubscriberConfig = {
  event: "product.created",
}
```

## Gift card code generation (added)

This project includes a subscriber `src/subscribers/gift-card-code.ts` that:

- Listens to `order.placed` and `order.updated` events.
- Detects if the order contains any gift card items (either product `is_giftcard = true` or product type value `gift-card`).
- Generates a unique code and creates a Promotion (if the Promotions module is available) with the following default policies:
  - `usage_limit = 1`
  - `regions = [all active regions]` by default (configurable)
  - `can_be_combined = false` by default (configurable)
- Stores the generated code in `order.metadata.gift_card_codes`.

Environment variables to control defaults:

- `GIFT_CARD_USAGE_LIMIT` (default: `1`)
- `GIFT_CARD_CAN_BE_COMBINED` (default: `false`)
- `GIFT_CARD_CODE_PREFIX` (default: `GC-`)
- `GIFT_CARD_SCOPE_ALL_REGIONS` (default: `true`)

Notes:

- If the Promotions module is not installed, the subscriber will still generate a code and store it in the order metadata, but it won't create a Promotion. In that case, install/enable the Promotions module or adapt the code to your discount engine.
- If you need the code to represent a specific stored value (e.g., $25), extend the subscriber to compute the denomination from the line items and set an appropriate fixed amount on the `application_method.value` when creating the Promotion.

A subscriber file must export:

- The subscriber function that is an asynchronous function executed whenever the associated event is triggered.
- A configuration object defining the event this subscriber is listening to.

## Subscriber Parameters

A subscriber receives an object having the following properties:

- `event`: An object holding the event's details. It has a `data` property, which is the event's data payload.
- `container`: The Medusa container. Use it to resolve modules' main services and other registered resources.

```ts
import type {
  SubscriberArgs,
  SubscriberConfig,
} from "@medusajs/framework"

export default async function productCreateHandler({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  const productId = data.id

  const productModuleService = container.resolve("product")

  const product = await productModuleService.retrieveProduct(productId)

  console.log(`The product ${product.title} was created`)
}

export const config: SubscriberConfig = {
  event: "product.created",
}
```