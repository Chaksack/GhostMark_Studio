import '../core/api_client.dart';
import '../models/product.dart';

/// Same field lists the web storefront requests (useProducts.ts / PDP),
/// confirmed against the live code this session rather than guessed.
const _listFields =
    'id,handle,title,subtitle,description,thumbnail,*images,*variants.calculated_price,'
    '*variants.options.value,options.id,*options.title,*options.values,*type,metadata,*tags';

const _detailFields =
    'id,title,subtitle,handle,description,thumbnail,*variants.calculated_price,'
    '*variants.options,options.id,*options.title,*options.values,*images,metadata,*type,type_id,*tags';

class ProductPage {
  ProductPage({required this.products, required this.count});
  final List<Product> products;
  final int count;
}

class CatalogRepository {
  CatalogRepository(this._api);
  final ApiClient _api;

  Future<ProductPage> listProducts({
    String? regionId,
    String? q,
    List<String>? typeId,
    List<String>? categoryId,
    List<String>? collectionId,
    int limit = 24,
    int offset = 0,
  }) async {
    final json = await _api.get(
      '/store/products',
      query: {
        'fields': _listFields,
        'limit': limit,
        'offset': offset,
        if (regionId != null) 'region_id': regionId,
        if (q != null && q.isNotEmpty) 'q': q,
        if (typeId != null && typeId.isNotEmpty) 'type_id[]': typeId,
        if (categoryId != null && categoryId.isNotEmpty) 'category_id[]': categoryId,
        if (collectionId != null && collectionId.isNotEmpty) 'collection_id[]': collectionId,
      },
    );
    final raw = json['products'];
    final products = raw is List
        ? raw.whereType<Map>().map((p) => Product.fromJson(Map<String, dynamic>.from(p))).toList()
        : <Product>[];
    return ProductPage(products: products, count: (json['count'] as num?)?.toInt() ?? products.length);
  }

  Future<Product?> getByHandle(String handle, {String? regionId}) async {
    final json = await _api.get(
      '/store/products',
      query: {'handle': handle, 'limit': 1, 'fields': _detailFields, if (regionId != null) 'region_id': regionId},
    );
    final raw = json['products'];
    if (raw is! List || raw.isEmpty) return null;
    return Product.fromJson(Map<String, dynamic>.from(raw.first));
  }

  Future<List<Map<String, dynamic>>> listCollections({int limit = 50}) async {
    final json = await _api.get(
      '/store/collections',
      query: {'limit': limit, 'fields': 'id,title,handle,created_at,metadata'},
    );
    final raw = json['collections'];
    return raw is List ? raw.whereType<Map>().map((c) => Map<String, dynamic>.from(c)).toList() : [];
  }

  Future<List<Map<String, dynamic>>> listTopLevelCategories() async {
    final json = await _api.get(
      '/store/product-categories',
      query: {'limit': 100, 'fields': 'id,name,handle,parent_category_id'},
    );
    final raw = json['product_categories'];
    if (raw is! List) return [];
    return raw
        .whereType<Map>()
        .map((c) => Map<String, dynamic>.from(c))
        .where((c) => c['parent_category_id'] == null)
        .toList();
  }
}
