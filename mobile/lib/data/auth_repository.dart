import '../core/api_client.dart';
import '../core/storage.dart';
import '../models/customer.dart';

/// Mirrors storefront/app/composables/useCustomer.ts call sequence exactly
/// (confirmed against the live source, not the Medusa docs — this backend
/// also guards GET /store/orders/:id to the bearer's own customer, so
/// getting this right matters for Account to work at all).
class AuthRepository {
  AuthRepository(this._api, this._storage);
  final ApiClient _api;
  final Storage _storage;

  Future<void> login({required String email, required String password}) async {
    final json = await _api.post('/auth/customer/emailpass', body: {'email': email, 'password': password});
    final token = json['token']?.toString();
    if (token == null) throw ApiException('Login failed.');
    await _storage.setAuthToken(token);
  }

  Future<void> register({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
  }) async {
    // 1. Registration token — valid for creating the customer record, NOT
    //    for cart-transfer or other store calls.
    final regJson = await _api.post(
      '/auth/customer/emailpass/register',
      body: {'email': email, 'password': password},
    );
    final regToken = regJson['token']?.toString();
    if (regToken == null) throw ApiException('Registration failed.');
    await _storage.setAuthToken(regToken);

    // 2. Create the customer using that registration token as bearer.
    await _api.post(
      '/store/customers',
      body: {'email': email, if (firstName != null) 'first_name': firstName, if (lastName != null) 'last_name': lastName},
    );

    // 3. Exchange for a real session token — the registration token above
    //    cannot be used for authenticated store calls afterward.
    await login(email: email, password: password);
  }

  Future<void> logout() async {
    // Auth type is 'jwt' here (not 'session'), so there is no server-side
    // session to invalidate — just drop the local token.
    await _storage.setAuthToken(null);
  }

  bool get isLoggedIn => (_storage.authToken ?? '').isNotEmpty;

  Future<Customer> me() async {
    final json = await _api.get('/store/customers/me', query: {'fields': '*'});
    return Customer.fromJson(Map<String, dynamic>.from(json['customer']));
  }

  Future<Customer> updateProfile({String? firstName, String? lastName, String? phone}) async {
    final json = await _api.post(
      '/store/customers/me',
      body: {
        if (firstName != null) 'first_name': firstName,
        if (lastName != null) 'last_name': lastName,
        if (phone != null) 'phone': phone,
      },
    );
    return Customer.fromJson(Map<String, dynamic>.from(json['customer']));
  }

  Future<void> createAddress(CustomerAddress address) async {
    await _api.post('/store/customers/me/addresses', body: address.toJson());
  }

  Future<void> updateAddress(String id, CustomerAddress address) async {
    await _api.post('/store/customers/me/addresses/$id', body: address.toJson());
  }

  Future<void> deleteAddress(String id) async {
    await _api.delete('/store/customers/me/addresses/$id');
  }
}
