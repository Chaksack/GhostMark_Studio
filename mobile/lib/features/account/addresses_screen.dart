import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../models/customer.dart';
import '../../state/auth_state.dart';
import '../../state/providers.dart';

class AddressesScreen extends ConsumerWidget {
  const AddressesScreen({super.key});

  Future<void> _openForm(BuildContext context, WidgetRef ref, {CustomerAddress? existing}) async {
    final result = await showModalBottomSheet<CustomerAddress>(
      context: context,
      isScrollControlled: true,
      builder: (_) => _AddressForm(existing: existing),
    );
    if (result == null) return;
    final repo = ref.read(authRepositoryProvider);
    if (existing != null) {
      await repo.updateAddress(existing.id, result);
    } else {
      await repo.createAddress(result);
    }
    await ref.read(authProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);
    final addresses = auth.value?.customer?.addresses ?? const <CustomerAddress>[];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Addresses'),
        actions: [IconButton(icon: const Icon(Icons.add), onPressed: () => _openForm(context, ref))],
      ),
      body: addresses.isEmpty
          ? const Center(child: Text('No saved addresses yet.'))
          : ListView.separated(
              itemCount: addresses.length,
              separatorBuilder: (context, index) => const Divider(height: 1),
              itemBuilder: (context, i) {
                final a = addresses[i];
                return ListTile(
                  title: Text([a.firstName, a.lastName].where((e) => (e ?? '').isNotEmpty).join(' ')),
                  subtitle: Text(a.summary),
                  onTap: () => _openForm(context, ref, existing: a),
                  trailing: IconButton(
                    icon: const Icon(Icons.delete_outline),
                    onPressed: () async {
                      await ref.read(authRepositoryProvider).deleteAddress(a.id);
                      await ref.read(authProvider.notifier).refresh();
                    },
                  ),
                );
              },
            ),
    );
  }
}

class _AddressForm extends StatefulWidget {
  const _AddressForm({this.existing});
  final CustomerAddress? existing;

  @override
  State<_AddressForm> createState() => _AddressFormState();
}

class _AddressFormState extends State<_AddressForm> {
  final _formKey = GlobalKey<FormState>();
  late final _firstName = TextEditingController(text: widget.existing?.firstName);
  late final _lastName = TextEditingController(text: widget.existing?.lastName);
  late final _address1 = TextEditingController(text: widget.existing?.address1);
  late final _city = TextEditingController(text: widget.existing?.city);
  late final _postalCode = TextEditingController(text: widget.existing?.postalCode);
  late final _country = TextEditingController(text: widget.existing?.countryCode ?? 'GB');
  late final _phone = TextEditingController(text: widget.existing?.phone);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 20, right: 20, top: 20),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(widget.existing == null ? 'Add address' : 'Edit address', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 16),
            Row(
              children: [
                Expanded(child: TextFormField(controller: _firstName, decoration: const InputDecoration(labelText: 'First name'))),
                const SizedBox(width: 12),
                Expanded(child: TextFormField(controller: _lastName, decoration: const InputDecoration(labelText: 'Last name'))),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _address1, decoration: const InputDecoration(labelText: 'Address'), validator: (v) => (v == null || v.isEmpty) ? 'Required' : null),
            const SizedBox(height: 12),
            TextFormField(controller: _city, decoration: const InputDecoration(labelText: 'City')),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(child: TextFormField(controller: _postalCode, decoration: const InputDecoration(labelText: 'Postal code'))),
                const SizedBox(width: 12),
                Expanded(child: TextFormField(controller: _country, decoration: const InputDecoration(labelText: 'Country'))),
              ],
            ),
            const SizedBox(height: 12),
            TextFormField(controller: _phone, decoration: const InputDecoration(labelText: 'Phone')),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () {
                if (!_formKey.currentState!.validate()) return;
                Navigator.of(context).pop(
                  CustomerAddress(
                    id: widget.existing?.id ?? '',
                    firstName: _firstName.text.trim(),
                    lastName: _lastName.text.trim(),
                    address1: _address1.text.trim(),
                    city: _city.text.trim(),
                    postalCode: _postalCode.text.trim(),
                    countryCode: _country.text.trim(),
                    phone: _phone.text.trim(),
                  ),
                );
              },
              child: const Text('Save'),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }
}
