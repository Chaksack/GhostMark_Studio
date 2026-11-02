class CustomerAddress {
  CustomerAddress({
    required this.id,
    this.firstName,
    this.lastName,
    this.company,
    this.address1,
    this.address2,
    this.city,
    this.province,
    this.postalCode,
    this.countryCode,
    this.phone,
  });

  final String id;
  final String? firstName;
  final String? lastName;
  final String? company;
  final String? address1;
  final String? address2;
  final String? city;
  final String? province;
  final String? postalCode;
  final String? countryCode;
  final String? phone;

  String get summary =>
      [address1, city, postalCode, countryCode?.toUpperCase()].where((e) => e != null && e.isNotEmpty).join(', ');

  factory CustomerAddress.fromJson(Map<String, dynamic> json) => CustomerAddress(
    id: json['id']?.toString() ?? '',
    firstName: json['first_name']?.toString(),
    lastName: json['last_name']?.toString(),
    company: json['company']?.toString(),
    address1: json['address_1']?.toString(),
    address2: json['address_2']?.toString(),
    city: json['city']?.toString(),
    province: json['province']?.toString(),
    postalCode: json['postal_code']?.toString(),
    countryCode: json['country_code']?.toString(),
    phone: json['phone']?.toString(),
  );

  Map<String, dynamic> toJson() => {
    if (firstName != null) 'first_name': firstName,
    if (lastName != null) 'last_name': lastName,
    if (company != null && company!.isNotEmpty) 'company': company,
    if (address1 != null) 'address_1': address1,
    if (address2 != null && address2!.isNotEmpty) 'address_2': address2,
    if (city != null) 'city': city,
    if (province != null && province!.isNotEmpty) 'province': province,
    if (postalCode != null) 'postal_code': postalCode,
    if (countryCode != null) 'country_code': countryCode?.toLowerCase(),
    if (phone != null && phone!.isNotEmpty) 'phone': phone,
  };
}

class Customer {
  Customer({
    required this.id,
    required this.email,
    this.firstName,
    this.lastName,
    this.phone,
    required this.addresses,
  });

  final String id;
  final String email;
  final String? firstName;
  final String? lastName;
  final String? phone;
  final List<CustomerAddress> addresses;

  String get displayName => [firstName, lastName].where((e) => e != null && e.isNotEmpty).join(' ');

  factory Customer.fromJson(Map<String, dynamic> json) {
    final rawAddresses = json['addresses'];
    return Customer(
      id: json['id']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      firstName: json['first_name']?.toString(),
      lastName: json['last_name']?.toString(),
      phone: json['phone']?.toString(),
      addresses: rawAddresses is List
          ? rawAddresses.whereType<Map>().map((a) => CustomerAddress.fromJson(Map<String, dynamic>.from(a))).toList()
          : const [],
    );
  }
}
