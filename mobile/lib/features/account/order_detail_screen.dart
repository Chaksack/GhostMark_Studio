import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/money.dart';
import '../../state/providers.dart';
import '../../widgets/async_value_view.dart';

final _orderProvider = FutureProvider.autoDispose.family((ref, String id) => ref.watch(orderRepositoryProvider).retrieve(id));

class OrderDetailScreen extends ConsumerWidget {
  const OrderDetailScreen({super.key, required this.orderId});
  final String orderId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final orderAsync = ref.watch(_orderProvider(orderId));
    return Scaffold(
      appBar: AppBar(title: const Text('Order')),
      body: AsyncValueView(
        value: orderAsync,
        onRetry: () => ref.invalidate(_orderProvider(orderId)),
        data: (order) => ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Text(order.number, style: Theme.of(context).textTheme.titleLarge),
            Text(order.status, style: Theme.of(context).textTheme.bodySmall),
            const Divider(height: 32),
            for (final item in order.items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 4),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text('${item.title} × ${item.quantity}')),
                    Text(formatMoney(item.total, order.currencyCode)),
                  ],
                ),
              ),
            const Divider(height: 32),
            _row(context, 'Subtotal', formatMoney(order.subtotal, order.currencyCode)),
            _row(context, 'Shipping', formatMoney(order.shippingTotal, order.currencyCode)),
            _row(context, 'Tax', formatMoney(order.taxTotal, order.currencyCode)),
            const Divider(),
            _row(context, 'Total', formatMoney(order.total, order.currencyCode), bold: true),
          ],
        ),
      ),
    );
  }

  Widget _row(BuildContext context, String label, String value, {bool bold = false}) {
    final style = bold ? Theme.of(context).textTheme.titleMedium : Theme.of(context).textTheme.bodyMedium;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [Text(label, style: style), Text(value, style: style)]),
    );
  }
}
