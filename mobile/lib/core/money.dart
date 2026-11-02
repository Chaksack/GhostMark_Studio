import 'package:intl/intl.dart';

/// Medusa v2 amounts are already decimal major-unit values (see the NOTE in
/// models/product.dart) — format directly, never divide by 100.
String formatMoney(num? amount, String? currencyCode) {
  final currency = (currencyCode ?? 'USD').toUpperCase();
  try {
    return NumberFormat.simpleCurrency(name: currency).format(amount ?? 0);
  } catch (_) {
    return '${(amount ?? 0).toStringAsFixed(2)} $currency';
  }
}
