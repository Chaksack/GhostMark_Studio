import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'providers.dart';

/// Local-only, device-scoped — matches the web's useWishlist.ts exactly
/// (localStorage, no server call, no customer scoping at all).
class WishlistNotifier extends Notifier<List<String>> {
  @override
  List<String> build() => ref.read(storageProvider).wishlist;

  bool contains(String productId) => state.contains(productId);

  Future<void> toggle(String productId) async {
    final next = contains(productId) ? (state.where((id) => id != productId).toList()) : [...state, productId];
    state = next;
    await ref.read(storageProvider).setWishlist(next);
  }
}

final wishlistProvider = NotifierProvider<WishlistNotifier, List<String>>(WishlistNotifier.new);
