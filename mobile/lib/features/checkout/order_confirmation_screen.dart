import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../models/order.dart';

class OrderConfirmationScreen extends StatelessWidget {
  const OrderConfirmationScreen({super.key, required this.order});
  final Map<String, dynamic>? order;

  @override
  Widget build(BuildContext context) {
    final orderData = order?['order'] is Map ? Map<String, dynamic>.from(order!['order']) : order;
    final id = orderData?['id']?.toString();
    final total = orderData?['total'];
    final currency = orderData?['currency_code']?.toString();

    return Scaffold(
      appBar: AppBar(automaticallyImplyLeading: false, title: const Text('Order placed')),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle, color: AppColors.sage500, size: 56),
              const SizedBox(height: 16),
              Text('Thank you!', style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text('Your order has been placed successfully.', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyMedium),
              const SizedBox(height: 16),
              if (id != null) Text('Order ID: ${formatOrderNumber(id)}', style: Theme.of(context).textTheme.titleMedium),
              if (total != null) ...[
                const SizedBox(height: 4),
                Text(formatMoney(total is num ? total : num.tryParse(total.toString()), currency)),
              ],
              const SizedBox(height: 24),
              ElevatedButton(onPressed: () => context.go('/'), child: const Text('Continue shopping')),
            ],
          ),
        ),
      ),
    );
  }
}
