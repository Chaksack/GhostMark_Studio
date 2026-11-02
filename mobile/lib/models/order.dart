class OrderItemSummary {
  OrderItemSummary({required this.id, required this.title, this.thumbnail, required this.quantity, required this.total});
  final String id;
  final String title;
  final String? thumbnail;
  final int quantity;
  final double total;

  factory OrderItemSummary.fromJson(Map<String, dynamic> json) {
    num? asNum(dynamic v) => v is num ? v : num.tryParse(v?.toString() ?? '');
    return OrderItemSummary(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? json['variant_title']?.toString() ?? 'Item',
      thumbnail: json['thumbnail']?.toString(),
      quantity: (asNum(json['quantity']) ?? 1).toInt(),
      total: (asNum(json['total']) ?? 0).toDouble(),
    );
  }
}

/// Matches customer-facing GMS-<id> format — see
/// ghostmark/src/subscribers/order-notifications.ts / order-number-widget.tsx.
String formatOrderNumber(String internalId) {
  if (internalId.startsWith('GMS-')) return internalId;
  return 'GMS-${internalId.replaceFirst(RegExp(r'^order_'), '')}';
}

class Order {
  Order({
    required this.id,
    required this.displayId,
    required this.status,
    required this.currencyCode,
    required this.total,
    required this.subtotal,
    required this.shippingTotal,
    required this.taxTotal,
    required this.createdAt,
    required this.items,
  });

  final String id;
  final int displayId;
  final String status;
  final String currencyCode;
  final double total;
  final double subtotal;
  final double shippingTotal;
  final double taxTotal;
  final DateTime? createdAt;
  final List<OrderItemSummary> items;

  String get number => formatOrderNumber(id);

  factory Order.fromJson(Map<String, dynamic> json) {
    num? asNum(dynamic v) => v is num ? v : num.tryParse(v?.toString() ?? '');
    final rawItems = json['items'];
    return Order(
      id: json['id']?.toString() ?? '',
      displayId: (asNum(json['display_id']) ?? 0).toInt(),
      status: json['status']?.toString() ?? json['fulfillment_status']?.toString() ?? 'pending',
      currencyCode: json['currency_code']?.toString() ?? 'gbp',
      total: (asNum(json['total']) ?? 0).toDouble(),
      subtotal: (asNum(json['subtotal']) ?? asNum(json['item_subtotal']) ?? 0).toDouble(),
      shippingTotal: (asNum(json['shipping_total']) ?? 0).toDouble(),
      taxTotal: (asNum(json['tax_total']) ?? 0).toDouble(),
      createdAt: DateTime.tryParse(json['created_at']?.toString() ?? ''),
      items: rawItems is List
          ? rawItems.whereType<Map>().map((i) => OrderItemSummary.fromJson(Map<String, dynamic>.from(i))).toList()
          : const [],
    );
  }
}
