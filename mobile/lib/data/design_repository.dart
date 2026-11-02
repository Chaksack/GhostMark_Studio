import 'package:dio/dio.dart';

import '../core/api_client.dart';
import '../core/env.dart';
import '../models/design_placement.dart';
import '../models/print_metadata.dart';

/// Talks to the storefront's (Nuxt) own BFF routes for POD design attach —
/// server/api/uploads/image.post.ts and server/api/custom-cart.post.ts —
/// instead of reimplementing their storage/metadata logic in Dart. Those
/// routes already produce exactly the designs/isCustomized/designDataJson/
/// previewImageUrl shape the admin's "Uploaded designs" widget expects
/// (fixed and verified end-to-end earlier this session), so reusing them
/// is both less code and zero risk of the contract drifting.
class DesignRepository {
  DesignRepository() : _dio = Dio(BaseOptions(baseUrl: Env.storefrontUrl, receiveTimeout: const Duration(seconds: 30)));

  final Dio _dio;

  Future<String> _uploadImage(List<int> bytes, String filename, String mimeType) async {
    final parts = mimeType.split('/');
    final form = FormData.fromMap({
      'image': MultipartFile.fromBytes(
        bytes,
        filename: filename,
        contentType: DioMediaType(parts.first, parts.length > 1 ? parts[1] : 'png'),
      ),
    });
    final res = await _dio.post<Map<String, dynamic>>('/api/uploads/image', data: form);
    final url = res.data?['url']?.toString();
    if (url == null) throw ApiException('Could not upload the design image.');
    return url;
  }

  /// Uploads the original file + the composited preview, then attaches the
  /// design to the cart via the custom-cart line-item route. Returns the
  /// resulting Medusa cart id.
  Future<String> attachDesign({
    required String variantId,
    required int quantity,
    required DesignPlacement placement,
    required List<int> previewPngBytes,
    String? cartId,
    String? regionId,
    String? technique,
  }) async {
    final originalUrl = await _uploadImage(placement.originalBytes, placement.originalFilename, placement.originalMimeType);
    final previewUrl = await _uploadImage(previewPngBytes, 'preview.png', 'image/png');

    final locationKey = placement.location.key;
    final sidePayload = {
      'imageUrl': originalUrl,
      'position': {'x': placement.offsetX, 'y': placement.offsetY},
      'scale': placement.scale,
      'rotation': placement.rotationDegrees,
      'mockupUrl': placement.location.mockupUrl,
      'area': (placement.location.area ?? DesignArea.fallback).toJson(),
      'originalUrl': originalUrl,
      'originalFilename': placement.originalFilename,
      'originalMimeType': placement.originalMimeType,
    };

    final designData = {
      'designs': {locationKey: sidePayload},
      'activeLocation': locationKey,
      'area': (placement.location.area ?? DesignArea.fallback).toJson(),
      'technique': technique,
      'front': locationKey == 'front' ? sidePayload : null,
      'back': locationKey == 'back' ? sidePayload : null,
      'activeSide': locationKey,
    };

    final res = await _dio.post<Map<String, dynamic>>(
      '/api/custom-cart',
      data: {
        'variant_id': variantId,
        'quantity': quantity,
        if (cartId != null) 'cart_id': cartId,
        if (regionId != null) 'region_id': regionId,
        'design_data': designData,
        'preview_url': previewUrl,
      },
    );
    final data = res.data;
    if (data?['ok'] != true) {
      throw ApiException(data?['error']?.toString() ?? 'Could not add the customised item to your cart.');
    }
    final newCartId = data?['cart_id']?.toString();
    if (newCartId == null) throw ApiException('Could not add the customised item to your cart.');
    return newCartId;
  }
}
