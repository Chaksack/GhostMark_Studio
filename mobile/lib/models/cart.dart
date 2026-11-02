class CartAddress {
  CartAddress({
    this.firstName,
    this.lastName,
    this.address1,
    this.address2,
    this.city,
    this.province,
    this.postalCode,
    this.countryCode,
    this.phone,
  });

  final String? firstName;
  final String? lastName;
  final String? address1;
  final String? address2;
  final String? city;
  final String? province;
  final String? postalCode;
  final String? countryCode;
  final String? phone;

  Map<String, dynamic> toJson() => {
    if (firstName != null) 'first_name': firstName,
    if (lastName != null) 'last_name': lastName,
    if (address1 != null) 'address_1': address1,
    if (address2 != null && address2!.isNotEmpty) 'address_2': address2,
    if (city != null) 'city': city,
    if (province != null && province!.isNotEmpty) 'province': province,
    if (postalCode != null) 'postal_code': postalCode,
    if (countryCode != null) 'country_code': countryCode?.toLowerCase(),
    if (phone != null) 'phone': phone,
  };
}

class CartLineItem {
  CartLineItem({
    required this.id,
    required this.title,
    this.variantTitle,
    this.thumbnail,
    required this.quantity,
    required this.unitPrice,
    required this.total,
    required this.metadata,
  });

  final String id;
  final String title;
  final String? variantTitle;
  final String? thumbnail;
  final int quantity;
  final double unitPrice;
  final double total;
  final Map<String, dynamic> metadata;

  bool get isCustomized => metadata['isCustomized'] == true;
  String? get previewImageUrl => metadata['previewImageUrl']?.toString();

  factory CartLineItem.fromJson(Map<String, dynamic> json) {
    num? asNum(dynamic v) => v is num ? v : num.tryParse(v?.toString() ?? '');
    final variant = json['variant'];
    final product = variant is Map ? variant['product'] : null;
    return CartLineItem(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? json['variant_title']?.toString() ?? 'Item',
      variantTitle: json['variant_title']?.toString(),
      thumbnail:
          json['thumbnail']?.toString() ??
          (product is Map ? product['thumbnail']?.toString() : null),
      quantity: (asNum(json['quantity']) ?? 1).toInt(),
      unitPrice: (asNum(json['unit_price']) ?? 0).toDouble(),
      total: (asNum(json['total']) ?? asNum(json['subtotal']) ?? 0).toDouble(),
      metadata: json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata']) : const {},
    );
  }
}

class ShippingOption {
  ShippingOption({required this.id, required this.name, this.amount});
  final String id;
  final String name;
  final double? amount;

  factory ShippingOption.fromJson(Map<String, dynamic> json) {
    final price = json['calculated_price'];
    double? amount;
    if (price is Map) {
      final raw = price['calculated_amount'];
      amount = raw is num ? raw.toDouble() : double.tryParse(raw?.toString() ?? '');
    }
    return ShippingOption(id: json['id']?.toString() ?? '', name: json['name']?.toString() ?? 'Shipping', amount: amount);
  }
}

class PaymentProvider {
  PaymentProvider({required this.id});
  final String id;
  bool get isStripe => id.contains('stripe');
  bool get isManual => id.contains('manual') || id.contains('system_default');

  factory PaymentProvider.fromJson(Map<String, dynamic> json) => PaymentProvider(id: json['id']?.toString() ?? '');
}

class Cart {
  Cart({
    required this.id,
    this.email,
    required this.currencyCode,
    this.regionId,
    required this.items,
    required this.subtotal,
    required this.shippingTotal,
    required this.taxTotal,
    required this.total,
    this.stripeClientSecret,
  });

  final String id;
  final String? email;
  final String currencyCode;
  final String? regionId;
  final List<CartLineItem> items;
  final double subtotal;
  final double shippingTotal;
  final double taxTotal;
  final double total;
  final String? stripeClientSecret;

  int get itemCount => items.fold(0, (sum, i) => sum + i.quantity);

  factory Cart.fromJson(Map<String, dynamic> json) {
    num? asNum(dynamic v) => v is num ? v : num.tryParse(v?.toString() ?? '');
    final rawItems = json['items'];
    final region = json['region'];

    String? clientSecret;
    final paymentCollection = json['payment_collection'];
    if (paymentCollection is Map) {
      final sessions = paymentCollection['payment_sessions'];
      if (sessions is List) {
        for (final s in sessions) {
          if (s is Map && s['provider_id']?.toString().contains('stripe') == true) {
            final data = s['data'];
            if (data is Map) clientSecret = data['client_secret']?.toString();
          }
        }
      }
    }

    return Cart(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString(),
      currencyCode:
          json['currency_code']?.toString() ?? (region is Map ? region['currency_code']?.toString() : null) ?? 'gbp',
      regionId: json['region_id']?.toString(),
      items: rawItems is List
          ? rawItems.whereType<Map>().map((i) => CartLineItem.fromJson(Map<String, dynamic>.from(i))).toList()
          : const [],
      subtotal: (asNum(json['subtotal']) ?? asNum(json['item_subtotal']) ?? 0).toDouble(),
      shippingTotal: (asNum(json['shipping_total']) ?? 0).toDouble(),
      taxTotal: (asNum(json['tax_total']) ?? 0).toDouble(),
      total: (asNum(json['total']) ?? 0).toDouble(),
      stripeClientSecret: clientSecret,
    );
  }
}
