import 'package:shared_preferences/shared_preferences.dart';

/// Thin wrapper over SharedPreferences using the SAME key names the web
/// storefront uses for the equivalent cookie/localStorage value, so the
/// two clients are trivially cross-referenced during debugging.
class Storage {
  Storage(this._prefs);

  final SharedPreferences _prefs;

  static Future<Storage> create() async {
    return Storage(await SharedPreferences.getInstance());
  }

  static const _cartIdKey = 'gms_cart_id';
  static const _authTokenKey = 'gms_auth_token';
  static const _regionIdKey = 'gms_region_id';
  static const _wishlistKey = 'gms_wishlist';

  String? get cartId => _prefs.getString(_cartIdKey);
  Future<void> setCartId(String? id) => _setOrRemove(_cartIdKey, id);

  String? get authToken => _prefs.getString(_authTokenKey);
  Future<void> setAuthToken(String? token) => _setOrRemove(_authTokenKey, token);

  String? get regionId => _prefs.getString(_regionIdKey);
  Future<void> setRegionId(String? id) => _setOrRemove(_regionIdKey, id);

  List<String> get wishlist => _prefs.getStringList(_wishlistKey) ?? const [];
  Future<void> setWishlist(List<String> ids) => _prefs.setStringList(_wishlistKey, ids);

  Future<void> _setOrRemove(String key, String? value) {
    if (value == null || value.isEmpty) return _prefs.remove(key);
    return _prefs.setString(key, value);
  }
}
