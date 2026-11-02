import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/catalog_repository.dart';
import '../../state/providers.dart';
import '../../state/region_state.dart';
import '../../widgets/async_value_view.dart';
import '../../widgets/product_card.dart';

final _shopProductsProvider = FutureProvider.autoDispose.family<ProductPage, String?>((ref, categoryId) async {
  final region = await ref.watch(regionProvider.future);
  return ref.watch(catalogRepositoryProvider).listProducts(
    regionId: region.selected?.id,
    categoryId: categoryId != null ? [categoryId] : null,
    limit: 48,
  );
});

class ShopScreen extends ConsumerWidget {
  const ShopScreen({super.key, this.categoryId});
  final String? categoryId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final products = ref.watch(_shopProductsProvider(categoryId));
    final currency = ref.watch(regionProvider).value?.selected?.currencyCode;

    return Scaffold(
      appBar: AppBar(title: const Text('Shop')),
      body: AsyncValueView(
        value: products,
        onRetry: () => ref.invalidate(_shopProductsProvider(categoryId)),
        data: (page) {
          if (page.products.isEmpty) {
            return const Center(child: Text('No products found.'));
          }
          return GridView.builder(
            padding: const EdgeInsets.all(16),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 16, crossAxisSpacing: 16, childAspectRatio: 0.68),
            itemCount: page.products.length,
            itemBuilder: (context, i) => ProductCard(
              product: page.products[i],
              currencyCode: currency,
              onTap: () => context.push('/products/${page.products[i].handle}'),
            ),
          );
        },
      ),
    );
  }
}
