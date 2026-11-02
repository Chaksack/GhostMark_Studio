/// Dart port of storefront/app/utils/printMetadata.ts — same shapes, same
/// fallback rules, read off `product.metadata`. Keep in sync with that file
/// if the backend's metadata contract changes.
class DesignArea {
  const DesignArea({required this.x, required this.y, required this.width, required this.height});

  final double x;
  final double y;
  final double width;
  final double height;

  factory DesignArea.fromJson(Map<String, dynamic> json) => DesignArea(
    x: (json['x'] as num?)?.toDouble() ?? 0,
    y: (json['y'] as num?)?.toDouble() ?? 0,
    width: (json['width'] as num?)?.toDouble() ?? 300,
    height: (json['height'] as num?)?.toDouble() ?? 300,
  );

  Map<String, dynamic> toJson() => {'x': x, 'y': y, 'width': width, 'height': height};

  static const fallback = DesignArea(x: 0, y: 0, width: 300, height: 300);
}

class PrintLocation {
  const PrintLocation({required this.key, this.label, this.mockupUrl, this.area});

  final String key;
  final String? label;
  final String? mockupUrl;
  final DesignArea? area;

  factory PrintLocation.fromJson(Map<String, dynamic> json) => PrintLocation(
    key: json['key']?.toString() ?? 'front',
    label: json['label']?.toString(),
    mockupUrl: json['mockup_url']?.toString(),
    area: json['area'] is Map ? DesignArea.fromJson(Map<String, dynamic>.from(json['area'])) : null,
  );
}

class PrintTechnique {
  const PrintTechnique({required this.key, this.label, this.surcharge});

  final String key;
  final String? label;
  final double? surcharge;

  factory PrintTechnique.fromJson(Map<String, dynamic> json) => PrintTechnique(
    key: json['key']?.toString() ?? '',
    label: json['label']?.toString(),
    surcharge: (json['surcharge'] as num?)?.toDouble(),
  );
}

class QuantityTier {
  const QuantityTier({required this.quantity, required this.unitAmount});

  final int quantity;
  final double unitAmount;

  factory QuantityTier.fromJson(Map<String, dynamic> json) => QuantityTier(
    quantity: (json['quantity'] as num?)?.toInt() ?? 1,
    unitAmount: (json['unit_amount'] as num?)?.toDouble() ?? 0,
  );
}

/// Parses the POD fields off raw product.metadata, with the same
/// is_customizable opt-out + print_locations fallback chain the web uses
/// (printMetadata.ts:62-135).
class PrintMetadata {
  PrintMetadata({
    required this.isCustomizable,
    required this.printLocations,
    required this.techniques,
    required this.quantityTiers,
    this.moq,
  });

  final bool isCustomizable;
  final List<PrintLocation> printLocations;
  final List<PrintTechnique> techniques;
  final List<QuantityTier> quantityTiers;
  final int? moq;

  factory PrintMetadata.parse(
    Map<String, dynamic>? metadata, {
    String? thumbnail,
    List<String> images = const [],
  }) {
    metadata ??= const {};

    final isCustomizableRaw = metadata['is_customizable'];
    final isCustomizable = !(isCustomizableRaw == false || isCustomizableRaw == 'false');

    List<PrintLocation> locations = [];
    final rawLocations = metadata['print_locations'];
    if (rawLocations is List && rawLocations.isNotEmpty) {
      locations = rawLocations
          .whereType<Map>()
          .map((e) => PrintLocation.fromJson(Map<String, dynamic>.from(e)))
          .toList();
    } else if (metadata['mockup_front'] != null || metadata['mockup_back'] != null) {
      if (metadata['mockup_front'] != null) {
        locations.add(PrintLocation(key: 'front', label: 'Front', mockupUrl: metadata['mockup_front'].toString()));
      }
      if (metadata['mockup_back'] != null) {
        locations.add(PrintLocation(key: 'back', label: 'Back', mockupUrl: metadata['mockup_back'].toString()));
      }
    } else if (isCustomizable) {
      final fallbackMockup = images.isNotEmpty ? images.first : thumbnail;
      if (fallbackMockup != null) {
        locations.add(PrintLocation(key: 'front', label: 'Front', mockupUrl: fallbackMockup));
      }
    }

    final techniques = <PrintTechnique>[];
    final rawTechniques = metadata['techniques'];
    if (rawTechniques is List) {
      for (final t in rawTechniques) {
        if (t is Map) techniques.add(PrintTechnique.fromJson(Map<String, dynamic>.from(t)));
      }
    }

    final tiers = <QuantityTier>[];
    final rawTiers = metadata['quantity_tiers'];
    if (rawTiers is List) {
      for (final t in rawTiers) {
        if (t is Map) tiers.add(QuantityTier.fromJson(Map<String, dynamic>.from(t)));
      }
      tiers.sort((a, b) => a.quantity.compareTo(b.quantity));
    }

    final moqRaw = metadata['moq'];
    final moq = moqRaw is num ? moqRaw.toInt() : int.tryParse(moqRaw?.toString() ?? '');

    return PrintMetadata(
      isCustomizable: isCustomizable,
      printLocations: locations,
      techniques: techniques,
      quantityTiers: tiers,
      moq: moq,
    );
  }
}
