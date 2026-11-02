import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/cart.dart';
import 'cart_state.dart';
import 'providers.dart';

enum CheckoutStep { shipping, payment, placing, done }

class CheckoutState {
  const CheckoutState({
    this.step = CheckoutStep.shipping,
    this.progressMessage,
    this.shippingOptions = const [],
    this.selectedShippingOptionId,
    this.providers = const [],
    this.selectedProviderId,
    this.error,
    this.placedOrder,
  });

  final CheckoutStep step;
  final String? progressMessage;
  final List<ShippingOption> shippingOptions;
  final String? selectedShippingOptionId;
  final List<PaymentProvider> providers;
  final String? selectedProviderId;
  final String? error;
  final Map<String, dynamic>? placedOrder;

  CheckoutState copyWith({
    CheckoutStep? step,
    String? progressMessage,
    List<ShippingOption>? shippingOptions,
    String? selectedShippingOptionId,
    List<PaymentProvider>? providers,
    String? selectedProviderId,
    String? error,
    Map<String, dynamic>? placedOrder,
  }) => CheckoutState(
    step: step ?? this.step,
    progressMessage: progressMessage,
    shippingOptions: shippingOptions ?? this.shippingOptions,
    selectedShippingOptionId: selectedShippingOptionId ?? this.selectedShippingOptionId,
    providers: providers ?? this.providers,
    selectedProviderId: selectedProviderId ?? this.selectedProviderId,
    error: error,
    placedOrder: placedOrder ?? this.placedOrder,
  );
}

/// Same step sequence as storefront/app/pages/checkout.vue's
/// onSaveShipping/onPlaceOrder. Each step is individually slow against
/// this backend (seconds, not ms) — surfaced here as a progressMessage so
/// the UI can show real progress instead of one frozen spinner, which is
/// the actual bug the web version has.
class CheckoutNotifier extends Notifier<CheckoutState> {
  @override
  CheckoutState build() => const CheckoutState();

  Future<bool> submitShipping({required String email, required CartAddress address}) async {
    state = state.copyWith(progressMessage: 'Confirming address…', error: null);
    try {
      final cartRepo = ref.read(cartRepositoryProvider);
      final cart = ref.read(cartProvider).value;
      if (cart == null) throw StateError('No cart to check out.');

      await cartRepo.updateAddresses(cart.id, email: email, shippingAddress: address);
      await ref.read(cartProvider.notifier).refresh();

      state = state.copyWith(progressMessage: 'Checking delivery options…');
      final options = await cartRepo.listShippingOptions(cart.id);
      if (options.isEmpty) {
        state = state.copyWith(
          progressMessage: null,
          error: 'No delivery options are available for this address. Double-check the country/postcode.',
        );
        return false;
      }

      String? selected = state.selectedShippingOptionId;
      if (options.length == 1 || selected == null || !options.any((o) => o.id == selected)) {
        selected = options.first.id;
      }

      state = state.copyWith(progressMessage: 'Reserving your delivery slot…', shippingOptions: options, selectedShippingOptionId: selected);
      await cartRepo.addShippingMethod(cart.id, selected);
      await ref.read(cartProvider.notifier).refresh();

      state = state.copyWith(progressMessage: 'Preparing payment…');
      final providers = await cartRepo.listPaymentProviders(cart.regionId ?? '');
      final stripe = providers.where((p) => p.isStripe).toList();
      final chosenProvider = stripe.isNotEmpty ? stripe.first.id : (providers.isNotEmpty ? providers.first.id : null);

      await cartRepo.initiateStripePayment(cart.id);
      await ref.read(cartProvider.notifier).refresh();

      state = state.copyWith(
        step: CheckoutStep.payment,
        progressMessage: null,
        providers: providers,
        selectedProviderId: chosenProvider,
      );
      return true;
    } catch (e) {
      state = state.copyWith(progressMessage: null, error: e.toString());
      return false;
    }
  }

  Future<Map<String, dynamic>?> completeOrder() async {
    state = state.copyWith(step: CheckoutStep.placing, error: null);
    try {
      final cart = ref.read(cartProvider).value;
      if (cart == null) throw StateError('No cart to check out.');
      final result = await ref.read(cartRepositoryProvider).complete(cart.id);
      await ref.read(cartProvider.notifier).clearAfterOrder();
      state = state.copyWith(step: CheckoutStep.done, placedOrder: result);
      return result;
    } catch (e) {
      state = state.copyWith(step: CheckoutStep.payment, error: e.toString());
      return null;
    }
  }

  void reset() => state = const CheckoutState();
}

final checkoutProvider = NotifierProvider<CheckoutNotifier, CheckoutState>(CheckoutNotifier.new);
