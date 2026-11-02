import '../core/api_client.dart';
import '../models/region.dart';

class RegionRepository {
  RegionRepository(this._api);
  final ApiClient _api;

  Future<List<Region>> list() async {
    final json = await _api.get('/store/regions', query: {'limit': 50});
    final raw = json['regions'];
    return raw is List ? raw.whereType<Map>().map((r) => Region.fromJson(Map<String, dynamic>.from(r))).toList() : [];
  }
}
