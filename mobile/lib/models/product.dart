import 'print_metadata.dart';

/// NOTE on money: Medusa v2 represents all money fields (calculated_price,
/// cart/order totals, unit_price) as decimal major-unit values — e.g. 42.0
/// means £42.00, NOT 4200 cents. This was confirmed the hard way earlier
/// this session (a `/100` assumption silently produced a 100x pricing bug
/// in the web admin). Never divide a Medusa amount by 100 in this app.

enum ProductFlow { pod, apparel, giftCard }

class ProductOptionValue {
  ProductOptionValue({required this.value});
  final String value;

  factory ProductOptionValue.fromJson(dynamic json) {
    if (json is Map) return ProductOptionValue(value: json['value']?.toString() ?? '');
    return ProductOptionValue(value: json?.toString() ?? '');
  }
}

class ProductOption {
  ProductOption({required this.id, required this.title, required this.values});
  final String id;
  final String title;
  final List<String> values;

  factory ProductOption.fromJson(Map<String, dynamic> json) {
    final rawValues = json['values'];
    return ProductOption(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      values: rawValues is List
          ? rawValues.map((v) => ProductOptionValue.fromJson(v).value).where((v) => v.isNotEmpty).toList()
          : const [],
    );
  }

  /// `color`/`gender` (shown as "Fit")/`size`/`default` — same substring
  /// classification as [handle].vue's optionKind().
  String get kind {
    final t = title.toLowerCase();
    if (t.contains('colour') || t.contains('color')) return 'color';
    if (t.contains('gender') || t.contains('sex')) return 'gender';
    if (t.contains('size') || t.contains('taille')) return 'size';
    return 'default';
  }
}

class VariantOptionValue {
  VariantOptionValue({required this.optionId, required this.value});
  final String optionId;
  final String value;

  factory VariantOptionValue.fromJson(Map<String, dynamic> json) => VariantOptionValue(
    optionId: json['option_id']?.toString() ?? '',
    value: json['value']?.toString() ?? '',
  );
}

class ProductVariant {
  ProductVariant({
    required this.id,
    required this.title,
    required this.options,
    this.calculatedAmount,
    this.currencyCode,
  });

  final String id;
  final String title;
  final List<VariantOptionValue> options;
  final double? calculatedAmount;
  final String? currencyCode;

  factory ProductVariant.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['options'];
    final price = json['calculated_price'];
    double? amount;
    String? currency;
    if (price is Map) {
      final raw = price['calculated_amount'];
      amount = raw is num ? raw.toDouble() : double.tryParse(raw?.toString() ?? '');
      currency = price['currency_code']?.toString();
    }
    return ProductVariant(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      options: rawOptions is List
          ? rawOptions.whereType<Map>().map((o) => VariantOptionValue.fromJson(Map<String, dynamic>.from(o))).toList()
          : const [],
      calculatedAmount: amount,
      currencyCode: currency,
    );
  }

  bool matches(Map<String, String> selected) {
    if (selected.isEmpty) return false;
    for (final entry in selected.entries) {
      final hit = options.any((o) => o.optionId == entry.key && o.value == entry.value);
      if (!hit) return false;
    }
    return true;
  }
}

class Product {
  Product({
    required this.id,
    required this.handle,
    required this.title,
    this.subtitle,
    this.description,
    this.thumbnail,
    required this.images,
    required this.options,
    required this.variants,
    required this.tags,
    this.typeValue,
    required this.metadata,
  }) : printMetadata = PrintMetadata.parse(metadata, thumbnail: thumbnail, images: images);

  final String id;
  final String handle;
  final String title;
  final String? subtitle;
  final String? description;
  final String? thumbnail;
  final List<String> images;
  final List<ProductOption> options;
  final List<ProductVariant> variants;
  final List<String> tags;
  final String? typeValue;
  final Map<String, dynamic> metadata;
  final PrintMetadata printMetadata;

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawImages = json['images'];
    final rawOptions = json['options'];
    final rawVariants = json['variants'];
    final rawTags = json['tags'];
    final type = json['type'];

    return Product(
      id: json['id']?.toString() ?? '',
      handle: json['handle']?.toString() ?? '',
      title: json['title']?.toString() ?? '',
      subtitle: json['subtitle']?.toString(),
      description: json['description']?.toString(),
      thumbnail: json['thumbnail']?.toString(),
      images: rawImages is List
          ? rawImages.map((i) => i is Map ? i['url']?.toString() : i?.toString()).whereType<String>().toList()
          : const [],
      options: rawOptions is List
          ? rawOptions.whereType<Map>().map((o) => ProductOption.fromJson(Map<String, dynamic>.from(o))).toList()
          : const [],
      variants: rawVariants is List
          ? rawVariants.whereType<Map>().map((v) => ProductVariant.fromJson(Map<String, dynamic>.from(v))).toList()
          : const [],
      tags: rawTags is List
          ? rawTags.map((t) => t is Map ? t['value']?.toString() : t?.toString()).whereType<String>().toList()
          : const [],
      typeValue: type is Map ? type['value']?.toString() : null,
      metadata: json['metadata'] is Map ? Map<String, dynamic>.from(json['metadata']) : const {},
    );
  }

  ProductFlow get flow {
    final t = typeValue?.toLowerCase();
    if (t == 'pod') return ProductFlow.pod;
    if (t == 'gift-card' || t == 'giftcard') return ProductFlow.giftCard;
    if (t == 'apparel') return ProductFlow.apparel;
    // Unset type: fall back to the metadata heuristic, same as [handle].vue.
    if (printMetadata.isCustomizable && printMetadata.printLocations.isNotEmpty) return ProductFlow.pod;
    return ProductFlow.apparel;
  }

  bool get isPod => flow == ProductFlow.pod;

  String get coverImage => thumbnail ?? (images.isNotEmpty ? images.first : '');

  /// Resolve the variant matching every selected {option_id: value} pair —
  /// same `.every(...)` linear scan as [handle].vue:2696-2708.
  ProductVariant? resolveVariant(Map<String, String> selected) {
    if (variants.length == 1) return variants.first;
    if (selected.isEmpty || options.isEmpty) return variants.isNotEmpty ? variants.first : null;
    for (final v in variants) {
      if (v.matches(selected)) return v;
    }
    return null;
  }
}
