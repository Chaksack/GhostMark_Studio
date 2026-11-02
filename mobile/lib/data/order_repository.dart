import '../core/api_client.dart';
import '../models/order.dart';

class OrderRepository {
  OrderRepository(this._api);
  final ApiClient _api;

  Future<List<Order>> list({int limit = 50}) async {
    final json = await _api.get(
      '/store/orders',
      query: {'limit': limit, 'fields': 'id,display_id,status,total,currency_code,created_at,items.id'},
    );
    final raw = json['orders'];
    return raw is List ? raw.whereType<Map>().map((o) => Order.fromJson(Map<String, dynamic>.from(o))).toList() : [];
  }

  Future<Order> retrieve(String id) async {
    final json = await _api.get(
      '/store/orders/$id',
      query: {'fields': '*items,*shipping_address,*billing_address,*shipping_methods,*payment_collections.payment_sessions'},
    );
    return Order.fromJson(Map<String, dynamic>.from(json['order']));
  }
}
