import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'features/account/account_screen.dart';
import 'features/account/addresses_screen.dart';
import 'features/account/order_detail_screen.dart';
import 'features/account/orders_screen.dart';
import 'features/account/profile_screen.dart';
import 'features/auth/login_screen.dart';
import 'features/auth/register_screen.dart';
import 'features/cart/cart_screen.dart';
import 'features/checkout/checkout_screen.dart';
import 'features/checkout/order_confirmation_screen.dart';
import 'features/product/product_detail_screen.dart';
import 'features/shop/home_screen.dart';
import 'features/shop/search_screen.dart';
import 'features/shop/shop_screen.dart';
import 'widgets/app_shell.dart';

final routerProvider = Provider<GoRouter>((ref) {
  return GoRouter(
    initialLocation: '/',
    routes: [
      ShellRoute(
        builder: (context, state, child) => AppShell(child: child),
        routes: [
          GoRoute(path: '/', builder: (context, state) => const HomeScreen()),
          GoRoute(path: '/shop', builder: (context, state) => ShopScreen(categoryId: state.uri.queryParameters['category'])),
          GoRoute(path: '/search', builder: (context, state) => const SearchScreen()),
          GoRoute(path: '/cart', builder: (context, state) => const CartScreen()),
          GoRoute(path: '/account', builder: (context, state) => const AccountScreen()),
        ],
      ),
      GoRoute(path: '/products/:handle', builder: (context, state) => ProductDetailScreen(handle: state.pathParameters['handle']!)),
      GoRoute(path: '/checkout', builder: (context, state) => const CheckoutScreen()),
      GoRoute(path: '/checkout/confirmation', builder: (context, state) => OrderConfirmationScreen(order: state.extra as Map<String, dynamic>?)),
      GoRoute(path: '/account/login', builder: (context, state) => const LoginScreen()),
      GoRoute(path: '/account/register', builder: (context, state) => const RegisterScreen()),
      GoRoute(path: '/account/orders', builder: (context, state) => const OrdersScreen()),
      GoRoute(path: '/account/orders/:id', builder: (context, state) => OrderDetailScreen(orderId: state.pathParameters['id']!)),
      GoRoute(path: '/account/addresses', builder: (context, state) => const AddressesScreen()),
      GoRoute(path: '/account/profile', builder: (context, state) => const ProfileScreen()),
    ],
  );
});
