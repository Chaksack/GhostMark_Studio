import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money.dart';
import '../../state/providers.dart';
import '../../widgets/async_value_view.dart';

final _ordersProvider = FutureProvider.autoDispose((ref) => ref.watch(orderRepositoryProvider).list());

class OrdersScreen extends ConsumerWidget {
  const OrdersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orders = ref.watch(_ordersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Order history')),
      body: AsyncValueView(
        value: orders,
        onRetry: () => ref.invalidate(_ordersProvider),
        data: (list) {
          if (list.isEmpty) return const Center(child: Text('No orders yet.'));
          return ListView.separated(
            itemCount: list.length,
            separatorBuilder: (context, index) => const Divider(height: 1),
            itemBuilder: (context, i) {
              final order = list[i];
              return ListTile(
                title: Text(order.number),
                subtitle: Text('${order.status} · ${order.createdAt?.toLocal().toString().split('.').first ?? ''}'),
                trailing: Text(formatMoney(order.total, order.currencyCode)),
                onTap: () => context.push('/account/orders/${order.id}'),
              );
            },
          );
        },
      ),
    );
  }
}
