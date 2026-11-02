import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/customer.dart';
import 'cart_state.dart';
import 'providers.dart';

class AuthState {
  const AuthState({this.customer});
  final Customer? customer;
  bool get isLoggedIn => customer != null;
}

class AuthNotifier extends AsyncNotifier<AuthState> {
  @override
  Future<AuthState> build() async {
    final repo = ref.read(authRepositoryProvider);
    if (!repo.isLoggedIn) return const AuthState();
    try {
      return AuthState(customer: await repo.me());
    } catch (_) {
      // Stale/expired token — drop it rather than get stuck logged-out-but-token-present.
      await repo.logout();
      return const AuthState();
    }
  }

  Future<void> login(String email, String password) async {
    final repo = ref.read(authRepositoryProvider);
    await repo.login(email: email, password: password);
    final customer = await repo.me();
    state = AsyncData(AuthState(customer: customer));
    await ref.read(cartProvider.notifier).transferToCustomer();
  }

  Future<void> register({required String email, required String password, String? firstName, String? lastName}) async {
    final repo = ref.read(authRepositoryProvider);
    await repo.register(email: email, password: password, firstName: firstName, lastName: lastName);
    final customer = await repo.me();
    state = AsyncData(AuthState(customer: customer));
    await ref.read(cartProvider.notifier).transferToCustomer();
  }

  Future<void> logout() async {
    await ref.read(authRepositoryProvider).logout();
    state = const AsyncData(AuthState());
  }

  Future<void> refresh() async {
    final repo = ref.read(authRepositoryProvider);
    if (!repo.isLoggedIn) return;
    state = AsyncData(AuthState(customer: await repo.me()));
  }
}

final authProvider = AsyncNotifierProvider<AuthNotifier, AuthState>(AuthNotifier.new);
