import 'package:dio/dio.dart';

import 'env.dart';
import 'storage.dart';

/// Thrown for any non-2xx Medusa response, carrying the server's own
/// message (Medusa error bodies are `{message, type}` or `{errors:[...]}`)
/// so screens can show a real error instead of "something went wrong".
class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

/// Medusa Store API client. Mirrors what @medusajs/js-sdk's Client does
/// automatically for the web storefront: attach x-publishable-api-key to
/// every request, and Authorization: Bearer <token> once a session exists.
class ApiClient {
  ApiClient(this._storage)
    : dio = Dio(
        BaseOptions(
          baseUrl: Env.medusaUrl,
          connectTimeout: const Duration(seconds: 20),
          // Checkout's shipping-method step alone has taken 8s+ against
          // this environment — give slow calls room rather than timing
          // out mid-checkout.
          receiveTimeout: const Duration(seconds: 30),
          headers: {
            if (Env.medusaPublishableKey.isNotEmpty)
              'x-publishable-api-key': Env.medusaPublishableKey,
          },
        ),
      ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _storage.authToken;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (e, handler) {
          handler.next(_wrap(e));
        },
      ),
    );
  }

  final Storage _storage;
  final Dio dio;

  DioException _wrap(DioException e) {
    final data = e.response?.data;
    String message = e.message ?? 'Network error';
    if (data is Map) {
      message = (data['message'] ?? data['error'] ?? message).toString();
    }
    return DioException(
      requestOptions: e.requestOptions,
      response: e.response,
      type: e.type,
      error: ApiException(message, statusCode: e.response?.statusCode),
      message: message,
    );
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    final res = await dio.get<Map<String, dynamic>>(path, queryParameters: query);
    return res.data ?? {};
  }

  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body}) async {
    final res = await dio.post<Map<String, dynamic>>(path, data: body);
    return res.data ?? {};
  }

  Future<Map<String, dynamic>> delete(String path) async {
    final res = await dio.delete<Map<String, dynamic>>(path);
    return res.data ?? {};
  }
}
