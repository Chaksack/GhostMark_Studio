import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../models/cart.dart';
import '../../state/cart_state.dart';

class CartScreen extends ConsumerWidget {
  const CartScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cartAsync = ref.watch(cartProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Your cart')),
      body: cartAsync.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => Center(child: Text(e.toString())),
        data: (cart) {
          if (cart == null || cart.items.isEmpty) {
            return Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.shopping_bag_outlined, size: 40, color: AppColors.ink300),
                  const SizedBox(height: 12),
                  Text('Your cart is empty', style: Theme.of(context).textTheme.bodyLarge),
                  const SizedBox(height: 16),
                  ElevatedButton(onPressed: () => context.go('/shop'), child: const Text('Continue shopping')),
                ],
              ),
            );
          }
          return Column(
            children: [
              Expanded(
                child: ListView.separated(
                  padding: const EdgeInsets.all(16),
                  itemCount: cart.items.length,
                  separatorBuilder: (context, index) => const Divider(),
                  itemBuilder: (context, i) => _CartLineTile(cart: cart, item: cart.items[i]),
                ),
              ),
              _CartSummary(cart: cart),
            ],
          );
        },
      ),
    );
  }
}

class _CartLineTile extends ConsumerWidget {
  const _CartLineTile({required this.cart, required this.item});
  final Cart cart;
  final CartLineItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final notifier = ref.read(cartProvider.notifier);
    final thumb = item.previewImageUrl ?? item.thumbnail;

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(6),
          child: thumb != null
              ? CachedNetworkImage(imageUrl: thumb, width: 72, height: 72, fit: BoxFit.cover)
              : Container(width: 72, height: 72, color: AppColors.creamTile),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.title, style: Theme.of(context).textTheme.bodyLarge),
              if ((item.variantTitle ?? '').isNotEmpty)
                Text(item.variantTitle!, style: Theme.of(context).textTheme.bodySmall),
              if (item.isCustomized)
                const Padding(
                  padding: EdgeInsets.only(top: 2),
                  child: Text('Custom design', style: TextStyle(color: AppColors.sage500, fontSize: 12)),
                ),
              const SizedBox(height: 8),
              Row(
                children: [
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: item.quantity > 1 ? () => notifier.updateQuantity(item.id, item.quantity - 1) : null,
                    icon: const Icon(Icons.remove_circle_outline, size: 20),
                  ),
                  Text('${item.quantity}'),
                  IconButton(
                    visualDensity: VisualDensity.compact,
                    onPressed: () => notifier.updateQuantity(item.id, item.quantity + 1),
                    icon: const Icon(Icons.add_circle_outline, size: 20),
                  ),
                  const Spacer(),
                  TextButton(onPressed: () => notifier.removeItem(item.id), child: const Text('Remove')),
                ],
              ),
            ],
          ),
        ),
        Text(formatMoney(item.total, cart.currencyCode), style: Theme.of(context).textTheme.bodyLarge),
      ],
    );
  }
}

class _CartSummary extends StatelessWidget {
  const _CartSummary({required this.cart});
  final Cart cart;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: const BoxDecoration(color: Colors.white, border: Border(top: BorderSide(color: AppColors.greyLines))),
      child: SafeArea(
        top: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Subtotal', style: Theme.of(context).textTheme.bodyLarge),
                Text(formatMoney(cart.subtotal, cart.currencyCode), style: Theme.of(context).textTheme.bodyLarge),
              ],
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => context.push('/checkout'),
              child: const Text('Go to checkout'),
            ),
          ],
        ),
      ),
    );
  }
}
