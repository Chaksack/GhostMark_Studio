import '../core/api_client.dart';
import '../models/cart.dart';

const _cartFields = '*items,*items.variant.product.type,*region';

/// Same Store API sequence as storefront/app/composables/useCart.ts and
/// app/pages/checkout.vue, called directly instead of through the
/// Nuxt/js-sdk layer.
class CartRepository {
  CartRepository(this._api);
  final ApiClient _api;

  Future<Cart> create({required String regionId}) async {
    final json = await _api.post('/store/carts', body: {'region_id': regionId});
    return Cart.fromJson(Map<String, dynamic>.from(json['cart']));
  }

  Future<Cart> retrieve(String cartId) async {
    final json = await _api.get('/store/carts/$cartId', query: {'fields': _cartFields});
    return Cart.fromJson(Map<String, dynamic>.from(json['cart']));
  }

  Future<Cart> addLineItem(String cartId, {required String variantId, required int quantity}) async {
    final json = await _api.post(
      '/store/carts/$cartId/line-items',
      body: {'variant_id': variantId, 'quantity': quantity},
    );
    return Cart.fromJson(Map<String, dynamic>.from(json['cart']));
  }

  Future<Cart> updateLineItem(String cartId, String lineItemId, {required int quantity}) async {
    final json = await _api.post('/store/carts/$cartId/line-items/$lineItemId', body: {'quantity': quantity});
    return Cart.fromJson(Map<String, dynamic>.from(json['cart']));
  }

  Future<Cart> removeLineItem(String cartId, String lineItemId) async {
    final json = await _api.delete('/store/carts/$cartId/line-items/$lineItemId');
    return Cart.fromJson(Map<String, dynamic>.from(json['parent'] ?? json['cart'] ?? {}));
  }

  Future<Cart> updateAddresses(
    String cartId, {
    required String email,
    required CartAddress shippingAddress,
  }) async {
    final json = await _api.post(
      '/store/carts/$cartId',
      body: {'email': email, 'shipping_address': shippingAddress.toJson(), 'billing_address': shippingAddress.toJson()},
    );
    return Cart.fromJson(Map<String, dynamic>.from(json['cart']));
  }

  Future<List<ShippingOption>> listShippingOptions(String cartId) async {
    final json = await _api.get('/store/shipping-options', query: {'cart_id': cartId});
    final raw = json['shipping_options'];
    return raw is List
        ? raw.whereType<Map>().map((o) => ShippingOption.fromJson(Map<String, dynamic>.from(o))).toList()
        : [];
  }

  Future<Cart> addShippingMethod(String cartId, String optionId) async {
    final json = await _api.post('/store/carts/$cartId/shipping-methods', body: {'option_id': optionId});
    return Cart.fromJson(Map<String, dynamic>.from(json['cart']));
  }

  Future<List<PaymentProvider>> listPaymentProviders(String regionId) async {
    final json = await _api.get('/store/payment-providers', query: {'region_id': regionId});
    final raw = json['payment_providers'];
    return raw is List
        ? raw.whereType<Map>().map((p) => PaymentProvider.fromJson(Map<String, dynamic>.from(p))).toList()
        : [];
  }

  /// Creates a payment collection for the cart, then a Stripe payment
  /// session on it, and returns the refreshed cart (which now carries the
  /// Stripe client_secret under payment_collection.payment_sessions).
  Future<Cart> initiateStripePayment(String cartId) async {
    final collectionRes = await _api.post('/store/payment-collections', body: {'cart_id': cartId});
    final collection = collectionRes['payment_collection'];
    final collectionId = collection is Map ? collection['id']?.toString() : null;
    if (collectionId == null) {
      throw ApiException('Could not start a payment session for this order.');
    }
    await _api.post(
      '/store/payment-collections/$collectionId/payment-sessions',
      body: {'provider_id': 'pp_stripe_stripe', 'data': {}},
    );
    return retrieve(cartId);
  }

  /// Completes the cart. Medusa returns either {type:'order', order} on
  /// success or {type:'cart', cart, error} when finalisation fails (e.g.
  /// payment not actually captured yet) — matches checkout.vue's
  /// finalizeOrder() handling.
  Future<Map<String, dynamic>> complete(String cartId) async {
    final json = await _api.post('/store/carts/$cartId/complete');
    if (json['type'] == 'cart' && json['error'] != null) {
      final error = json['error'];
      final message = error is Map ? (error['message']?.toString() ?? 'Could not complete order.') : 'Could not complete order.';
      throw ApiException(message);
    }
    return json;
  }

  Future<Cart> transferToCustomer(String cartId) async {
    final json = await _api.post('/store/carts/$cartId/customer');
    return Cart.fromJson(Map<String, dynamic>.from(json['cart']));
  }
}
