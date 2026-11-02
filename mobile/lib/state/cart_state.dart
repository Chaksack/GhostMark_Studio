import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/cart.dart';
import '../models/design_placement.dart';
import 'providers.dart';
import 'region_state.dart';

/// Owns the single active cart, mirroring useCart.ts: lazily created
/// against the current region, id persisted in gms_cart_id, re-fetched
/// after every mutation so totals/currency stay in sync.
class CartNotifier extends AsyncNotifier<Cart?> {
  @override
  Future<Cart?> build() async {
    final storage = ref.read(storageProvider);
    final cartId = storage.cartId;
    if (cartId == null) return null;
    try {
      return await ref.read(cartRepositoryProvider).retrieve(cartId);
    } catch (_) {
      // Cart gone (expired/completed elsewhere) — drop the stale id.
      await storage.setCartId(null);
      return null;
    }
  }

  Future<Cart> _ensureCart() async {
    final existing = state.value;
    if (existing != null) return existing;

    final region = await ref.read(regionProvider.future);
    final selectedRegion = region.selected;
    if (selectedRegion == null) {
      throw StateError('No region available to create a cart in.');
    }
    final cart = await ref.read(cartRepositoryProvider).create(regionId: selectedRegion.id);
    await ref.read(storageProvider).setCartId(cart.id);
    state = AsyncData(cart);
    return cart;
  }

  Future<void> addItem({required String variantId, required int quantity}) async {
    final cart = await _ensureCart();
    final updated = await ref.read(cartRepositoryProvider).addLineItem(cart.id, variantId: variantId, quantity: quantity);
    state = AsyncData(updated);
  }

  /// POD path — uploads + attaches via the storefront's custom-cart route,
  /// creating the cart first if needed so the design lands on the same
  /// cart the rest of the app is using.
  Future<void> addDesignItem({
    required String variantId,
    required int quantity,
    required DesignPlacement placement,
    required List<int> previewPngBytes,
    String? technique,
  }) async {
    final cart = await _ensureCart();
    final region = ref.read(regionProvider).value?.selected;
    final newCartId = await ref.read(designRepositoryProvider).attachDesign(
      variantId: variantId,
      quantity: quantity,
      placement: placement,
      previewPngBytes: previewPngBytes,
      cartId: cart.id,
      regionId: region?.id,
    );
    await ref.read(storageProvider).setCartId(newCartId);
    final updated = await ref.read(cartRepositoryProvider).retrieve(newCartId);
    state = AsyncData(updated);
  }

  Future<void> updateQuantity(String lineItemId, int quantity) async {
    final cart = state.value;
    if (cart == null) return;
    final updated = await ref.read(cartRepositoryProvider).updateLineItem(cart.id, lineItemId, quantity: quantity);
    state = AsyncData(updated);
  }

  Future<void> removeItem(String lineItemId) async {
    final cart = state.value;
    if (cart == null) return;
    final updated = await ref.read(cartRepositoryProvider).removeLineItem(cart.id, lineItemId);
    state = AsyncData(updated);
  }

  Future<void> refresh() async {
    final cart = state.value;
    if (cart == null) return;
    state = AsyncData(await ref.read(cartRepositoryProvider).retrieve(cart.id));
  }

  Future<void> transferToCustomer() async {
    final cart = state.value;
    if (cart == null) return;
    try {
      state = AsyncData(await ref.read(cartRepositoryProvider).transferToCustomer(cart.id));
    } catch (_) {
      // Non-fatal — login/register should still succeed even if transfer fails.
    }
  }

  /// Called once an order is placed — the completed cart is gone, so clear
  /// local state and let the next addItem() create a fresh one.
  Future<void> clearAfterOrder() async {
    await ref.read(storageProvider).setCartId(null);
    state = const AsyncData(null);
  }
}

final cartProvider = AsyncNotifierProvider<CartNotifier, Cart?>(CartNotifier.new);
