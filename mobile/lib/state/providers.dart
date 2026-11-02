import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api_client.dart';
import '../core/storage.dart';
import '../data/auth_repository.dart';
import '../data/cart_repository.dart';
import '../data/catalog_repository.dart';
import '../data/design_repository.dart';
import '../data/order_repository.dart';
import '../data/region_repository.dart';

/// Overridden in main() once Storage.create() resolves — every other
/// provider below derives from this, so nothing else needs async init.
final storageProvider = Provider<Storage>((ref) => throw UnimplementedError('Storage not initialized'));

final apiClientProvider = Provider<ApiClient>((ref) => ApiClient(ref.watch(storageProvider)));

final catalogRepositoryProvider = Provider((ref) => CatalogRepository(ref.watch(apiClientProvider)));
final regionRepositoryProvider = Provider((ref) => RegionRepository(ref.watch(apiClientProvider)));
final cartRepositoryProvider = Provider((ref) => CartRepository(ref.watch(apiClientProvider)));
final authRepositoryProvider = Provider((ref) => AuthRepository(ref.watch(apiClientProvider), ref.watch(storageProvider)));
final orderRepositoryProvider = Provider((ref) => OrderRepository(ref.watch(apiClientProvider)));
final designRepositoryProvider = Provider((ref) => DesignRepository());
