/// Build-time config, supplied via --dart-define. Defaults match this
/// session's local dev setup (medusa develop on :9000, nuxt dev on :8000).
class Env {
  /// Medusa backend base URL. Store API lives under this origin.
  static const medusaUrl = String.fromEnvironment(
    'MEDUSA_URL',
    defaultValue: 'http://localhost:9000',
  );

  /// Medusa Store API publishable key, sent as x-publishable-api-key on
  /// every request — same header the web storefront's js-sdk attaches
  /// automatically.
  static const medusaPublishableKey = String.fromEnvironment(
    'MEDUSA_PUBLISHABLE_KEY',
  );

  /// Storefront (Nuxt) origin. Only used for the two POD design routes
  /// (/api/uploads/image, /api/custom-cart) — everything else talks to
  /// Medusa directly. Different origin from medusaUrl on purpose.
  static const storefrontUrl = String.fromEnvironment(
    'STOREFRONT_URL',
    defaultValue: 'http://localhost:8000',
  );

  static const stripePublishableKey = String.fromEnvironment(
    'STRIPE_PUBLISHABLE_KEY',
  );
}
