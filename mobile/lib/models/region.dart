class Region {
  Region({required this.id, required this.name, required this.currencyCode, required this.countries});

  final String id;
  final String name;
  final String currencyCode;
  final List<String> countries;

  factory Region.fromJson(Map<String, dynamic> json) {
    final rawCountries = json['countries'];
    return Region(
      id: json['id']?.toString() ?? '',
      name: json['name']?.toString() ?? '',
      currencyCode: json['currency_code']?.toString() ?? 'usd',
      countries: rawCountries is List
          ? rawCountries
                .map((c) => c is Map ? c['iso_2']?.toString() : null)
                .whereType<String>()
                .map((c) => c.toUpperCase())
                .toList()
          : const [],
    );
  }
}
