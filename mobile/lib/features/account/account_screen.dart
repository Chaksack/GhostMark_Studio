import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../state/auth_state.dart';
import '../../state/region_state.dart';

class AccountScreen extends ConsumerWidget {
  const AccountScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final auth = ref.watch(authProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: auth.when(
        loading: () => const Center(child: CircularProgressIndicator()),
        error: (e, st) => Center(child: Text(e.toString())),
        data: (state) {
          if (!state.isLoggedIn) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.person_outline, size: 40, color: AppColors.ink300),
                    const SizedBox(height: 12),
                    Text('Sign in to see your orders and addresses', textAlign: TextAlign.center, style: Theme.of(context).textTheme.bodyLarge),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: () => context.push('/account/login'), child: const Text('Sign in')),
                    const SizedBox(height: 8),
                    OutlinedButton(onPressed: () => context.push('/account/register'), child: const Text('Create account')),
                    const SizedBox(height: 24),
                    const _RegionPicker(),
                  ],
                ),
              ),
            );
          }

          final customer = state.customer!;
          return ListView(
            children: [
              Padding(
                padding: const EdgeInsets.all(16),
                child: Text(customer.displayName.isEmpty ? customer.email : customer.displayName, style: Theme.of(context).textTheme.titleLarge),
              ),
              ListTile(leading: const Icon(Icons.receipt_long_outlined), title: const Text('Order history'), onTap: () => context.push('/account/orders')),
              ListTile(leading: const Icon(Icons.location_on_outlined), title: const Text('Addresses'), onTap: () => context.push('/account/addresses')),
              ListTile(leading: const Icon(Icons.badge_outlined), title: const Text('Profile'), onTap: () => context.push('/account/profile')),
              const Divider(),
              const Padding(padding: EdgeInsets.fromLTRB(16, 8, 16, 0), child: _RegionPicker()),
              const Divider(),
              ListTile(
                leading: const Icon(Icons.logout),
                title: const Text('Sign out'),
                onTap: () => ref.read(authProvider.notifier).logout(),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RegionPicker extends ConsumerWidget {
  const _RegionPicker();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final region = ref.watch(regionProvider);
    return region.when(
      loading: () => const SizedBox.shrink(),
      error: (e, st) => const SizedBox.shrink(),
      data: (state) {
        if (state.regions.isEmpty) return const SizedBox.shrink();
        return Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text('Region', style: Theme.of(context).textTheme.bodyMedium),
            DropdownButton<String>(
              value: state.selected?.id,
              items: state.regions
                  .map((r) => DropdownMenuItem(value: r.id, child: Text('${r.name} (${r.currencyCode.toUpperCase()})')))
                  .toList(),
              onChanged: (id) {
                final match = state.regions.where((r) => r.id == id);
                if (match.isNotEmpty) ref.read(regionProvider.notifier).select(match.first);
              },
            ),
          ],
        );
      },
    );
  }
}
