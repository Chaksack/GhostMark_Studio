import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_stripe/flutter_stripe.dart' hide Card;
import 'package:go_router/go_router.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../models/cart.dart';
import '../../state/auth_state.dart';
import '../../state/cart_state.dart';
import '../../state/checkout_state.dart';

class CheckoutScreen extends ConsumerStatefulWidget {
  const CheckoutScreen({super.key});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _address1 = TextEditingController();
  final _address2 = TextEditingController();
  final _city = TextEditingController();
  final _province = TextEditingController();
  final _postalCode = TextEditingController();
  final _country = TextEditingController(text: 'GB');
  final _phone = TextEditingController();

  bool _cardComplete = false;
  bool _placing = false;

  @override
  void initState() {
    super.initState();
    final customer = ref.read(authProvider).value?.customer;
    if (customer != null) {
      _email.text = customer.email;
      _firstName.text = customer.firstName ?? '';
      _lastName.text = customer.lastName ?? '';
      if (customer.addresses.isNotEmpty) {
        final a = customer.addresses.first;
        _address1.text = a.address1 ?? '';
        _city.text = a.city ?? '';
        _postalCode.text = a.postalCode ?? '';
        _country.text = (a.countryCode ?? 'GB').toUpperCase();
        _phone.text = a.phone ?? '';
      }
    }
  }

  @override
  void dispose() {
    for (final c in [_email, _firstName, _lastName, _address1, _address2, _city, _province, _postalCode, _country, _phone]) {
      c.dispose();
    }
    super.dispose();
  }

  Future<void> _submitShipping() async {
    if (!_formKey.currentState!.validate()) return;
    final address = CartAddress(
      firstName: _firstName.text.trim(),
      lastName: _lastName.text.trim(),
      address1: _address1.text.trim(),
      address2: _address2.text.trim(),
      city: _city.text.trim(),
      province: _province.text.trim(),
      postalCode: _postalCode.text.trim(),
      countryCode: _country.text.trim(),
      phone: _phone.text.trim(),
    );
    await ref.read(checkoutProvider.notifier).submitShipping(email: _email.text.trim(), address: address);
  }

  Future<void> _placeOrder() async {
    final cart = ref.read(cartProvider).value;
    final clientSecret = cart?.stripeClientSecret;
    if (clientSecret == null) return;

    setState(() => _placing = true);
    try {
      final billing = BillingDetails(
        name: '${_firstName.text.trim()} ${_lastName.text.trim()}'.trim(),
        email: _email.text.trim(),
        phone: _phone.text.trim().isEmpty ? null : _phone.text.trim(),
        address: Address(
          city: _city.text.trim(),
          country: _country.text.trim(),
          line1: _address1.text.trim(),
          line2: _address2.text.trim(),
          postalCode: _postalCode.text.trim(),
          state: _province.text.trim(),
        ),
      );

      await Stripe.instance.confirmPayment(
        paymentIntentClientSecret: clientSecret,
        data: PaymentMethodParams.card(paymentMethodData: PaymentMethodData(billingDetails: billing)),
      );

      final order = await ref.read(checkoutProvider.notifier).completeOrder();
      if (!mounted) return;
      if (order != null) {
        context.go('/checkout/confirmation', extra: order);
      }
    } on StripeException catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.error.localizedMessage ?? 'Card was declined.')));
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.toString())));
    } finally {
      if (mounted) setState(() => _placing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cart = ref.watch(cartProvider).value;
    final checkout = ref.watch(checkoutProvider);

    if (cart == null || cart.items.isEmpty) {
      return Scaffold(appBar: AppBar(title: const Text('Checkout')), body: const Center(child: Text('Your cart is empty.')));
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _OrderSummary(cart: cart),
            const SizedBox(height: 20),
            if (checkout.step == CheckoutStep.shipping) _ShippingForm(formKey: _formKey, state: this),
            if (checkout.step != CheckoutStep.shipping) ...[
              Text('Payment', style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 12),
              CardFormField(
                onCardChanged: (details) => setState(() => _cardComplete = details?.complete ?? false),
              ),
              const SizedBox(height: 16),
              if (checkout.error != null) ...[
                Text(checkout.error!, style: const TextStyle(color: AppColors.error)),
                const SizedBox(height: 12),
              ],
              ElevatedButton(
                onPressed: _cardComplete && !_placing ? _placeOrder : null,
                child: _placing
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : Text('Pay ${formatMoney(cart.total, cart.currencyCode)}'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.read(checkoutProvider.notifier).reset(),
                child: const Text('Back to shipping'),
              ),
            ],
            if (checkout.progressMessage != null) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
                  const SizedBox(width: 12),
                  Expanded(child: Text(checkout.progressMessage!)),
                ],
              ),
            ],
            if (checkout.error != null && checkout.step == CheckoutStep.shipping) ...[
              const SizedBox(height: 12),
              Text(checkout.error!, style: const TextStyle(color: AppColors.error)),
            ],
            if (checkout.step == CheckoutStep.shipping) ...[
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: checkout.progressMessage == null ? _submitShipping : null,
                child: checkout.progressMessage != null
                    ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Continue to payment'),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _OrderSummary extends StatelessWidget {
  const _OrderSummary({required this.cart});
  final Cart cart;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text('Order summary', style: Theme.of(context).textTheme.titleMedium),
            const SizedBox(height: 8),
            for (final item in cart.items)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 2),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(child: Text('${item.title} × ${item.quantity}', overflow: TextOverflow.ellipsis)),
                    Text(formatMoney(item.total, cart.currencyCode)),
                  ],
                ),
              ),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [Text('Total', style: Theme.of(context).textTheme.titleMedium), Text(formatMoney(cart.total, cart.currencyCode))],
            ),
          ],
        ),
      ),
    );
  }
}

class _ShippingForm extends StatelessWidget {
  const _ShippingForm({required this.formKey, required this.state});
  final GlobalKey<FormState> formKey;
  final _CheckoutScreenState state;

  Widget _field(TextEditingController c, String label, {bool required = true, TextInputType? type}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: TextFormField(
        controller: c,
        keyboardType: type,
        decoration: InputDecoration(labelText: label),
        validator: required ? (v) => (v == null || v.trim().isEmpty) ? 'Required' : null : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Shipping details', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          _field(state._email, 'Email', type: TextInputType.emailAddress),
          _field(state._phone, 'Phone', type: TextInputType.phone),
          Row(
            children: [
              Expanded(child: _field(state._firstName, 'First name')),
              const SizedBox(width: 12),
              Expanded(child: _field(state._lastName, 'Last name')),
            ],
          ),
          _field(state._address1, 'Address line 1'),
          _field(state._address2, 'Address line 2', required: false),
          _field(state._city, 'City'),
          Row(
            children: [
              Expanded(child: _field(state._province, 'Province / State', required: false)),
              const SizedBox(width: 12),
              Expanded(child: _field(state._postalCode, 'Postal code')),
            ],
          ),
          _field(state._country, 'Country code (e.g. GB)'),
        ],
      ),
    );
  }
}
