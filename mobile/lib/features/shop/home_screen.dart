import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../state/providers.dart';
import '../../state/region_state.dart';
import '../../widgets/product_card.dart';

final _featuredProvider = FutureProvider.autoDispose((ref) async {
  final region = await ref.watch(regionProvider.future);
  final page = await ref.watch(catalogRepositoryProvider).listProducts(regionId: region.selected?.id, limit: 12);
  return page.products;
});

class HomeScreen extends ConsumerWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final featured = ref.watch(_featuredProvider);
    final currency = ref.watch(regionProvider).value?.selected?.currencyCode;

    return RefreshIndicator(
      onRefresh: () => ref.refresh(_featuredProvider.future),
      child: CustomScrollView(
        slivers: [
          SliverAppBar(
            floating: true,
            backgroundColor: AppColors.offWhite,
            surfaceTintColor: Colors.transparent,
            title: Text('GhostMark', style: Theme.of(context).textTheme.headlineSmall),
            actions: [
              IconButton(icon: const Icon(Icons.search), onPressed: () => context.go('/search')),
            ],
          ),
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            sliver: SliverToBoxAdapter(
              child: Container(
                padding: const EdgeInsets.all(24),
                decoration: BoxDecoration(color: AppColors.creamTile, borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Branded objects for the kind of work people keep.', style: Theme.of(context).textTheme.headlineMedium),
                    const SizedBox(height: 8),
                    Text('Laser engraving, DTF print, and apparel finishing — upload your own artwork and we handle production.', style: Theme.of(context).textTheme.bodyMedium),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: () => context.go('/shop'), child: const Text('Shop all')),
                  ],
                ),
              ),
            ),
          ),
          SliverPadding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            sliver: SliverToBoxAdapter(child: Text('Shop the catalogue', style: Theme.of(context).textTheme.titleLarge)),
          ),
          SliverPadding(
            padding: const EdgeInsets.all(16),
            sliver: featured.when(
              data: (products) => SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(crossAxisCount: 2, mainAxisSpacing: 16, crossAxisSpacing: 16, childAspectRatio: 0.68),
                delegate: SliverChildBuilderDelegate(
                  (context, i) => ProductCard(
                    product: products[i],
                    currencyCode: currency,
                    onTap: () => context.push('/products/${products[i].handle}'),
                  ),
                  childCount: products.length,
                ),
              ),
              loading: () => const SliverToBoxAdapter(
                child: Padding(padding: EdgeInsets.all(32), child: Center(child: CircularProgressIndicator())),
              ),
              error: (err, st) => SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Column(
                    children: [
                      Text(err.toString(), textAlign: TextAlign.center),
                      const SizedBox(height: 12),
                      OutlinedButton(onPressed: () => ref.invalidate(_featuredProvider), child: const Text('Retry')),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
