import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/money.dart';
import '../../core/theme.dart';
import '../../models/print_metadata.dart';
import '../../models/product.dart';
import '../../state/cart_state.dart';
import '../../state/providers.dart';
import '../../state/region_state.dart';
import '../../widgets/async_value_view.dart';
import 'widgets/design_placement_sheet.dart';
import 'widgets/variant_picker.dart';

final _productProvider = FutureProvider.autoDispose.family<Product?, String>((ref, handle) async {
  final region = await ref.watch(regionProvider.future);
  return ref.watch(catalogRepositoryProvider).getByHandle(handle, regionId: region.selected?.id);
});

class ProductDetailScreen extends ConsumerStatefulWidget {
  const ProductDetailScreen({super.key, required this.handle});
  final String handle;

  @override
  ConsumerState<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends ConsumerState<ProductDetailScreen> {
  final Map<String, String> _selectedOptions = {};
  int _quantity = 1;
  String? _selectedTechnique;
  DesignPlacementResult? _design;
  bool _initialisedDefaults = false;
  bool _adding = false;
  String? _addError;
  bool _addSuccess = false;

  void _ensureDefaults(Product product) {
    if (_initialisedDefaults) return;
    _initialisedDefaults = true;
    for (final option in product.options) {
      if (option.values.isNotEmpty) _selectedOptions[option.id] = option.values.first;
    }
    _quantity = product.printMetadata.quantityTiers.isNotEmpty
        ? product.printMetadata.quantityTiers.first.quantity
        : (product.printMetadata.moq ?? 1);
    if (product.printMetadata.techniques.isNotEmpty) {
      _selectedTechnique = product.printMetadata.techniques.first.key;
    }
  }

  Future<void> _pickDesign(PrintLocation location) async {
    final result = await DesignPlacementSheet.show(context, location);
    if (result != null) setState(() => _design = result);
  }

  Future<void> _addToCart(Product product, String? variantId) async {
    if (variantId == null) {
      setState(() => _addError = 'Please select every option before adding to cart.');
      return;
    }
    if (product.isPod && product.printMetadata.printLocations.isNotEmpty && _design == null) {
      setState(() => _addError = 'Upload a design before adding to cart.');
      return;
    }

    setState(() {
      _adding = true;
      _addError = null;
      _addSuccess = false;
    });
    try {
      if (_design != null) {
        await ref.read(cartProvider.notifier).addDesignItem(
          variantId: variantId,
          quantity: _quantity,
          placement: _design!.placement,
          previewPngBytes: _design!.previewPngBytes,
          technique: _selectedTechnique,
        );
      } else {
        await ref.read(cartProvider.notifier).addItem(variantId: variantId, quantity: _quantity);
      }
      if (!mounted) return;
      setState(() => _addSuccess = true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _addError = e.toString());
    } finally {
      if (mounted) setState(() => _adding = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final productAsync = ref.watch(_productProvider(widget.handle));
    final currency = ref.watch(regionProvider).value?.selected?.currencyCode;

    return Scaffold(
      appBar: AppBar(title: const Text('')),
      body: AsyncValueView<Product?>(
        value: productAsync,
        onRetry: () => ref.invalidate(_productProvider(widget.handle)),
        data: (product) {
          if (product == null) return const Center(child: Text('Product not found.'));
          _ensureDefaults(product);
          final variant = product.resolveVariant(_selectedOptions);
          final price = variant?.calculatedAmount;
          final printMeta = product.printMetadata;
          final isPod = product.isPod;
          final hasLocations = printMeta.printLocations.isNotEmpty;

          return SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AspectRatio(
                  aspectRatio: 1,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(8),
                    child: product.coverImage.isNotEmpty
                        ? CachedNetworkImage(imageUrl: product.coverImage, fit: BoxFit.cover)
                        : Container(color: AppColors.creamTile),
                  ),
                ),
                const SizedBox(height: 16),
                Text(product.title, style: Theme.of(context).textTheme.headlineSmall),
                if ((product.subtitle ?? '').isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(product.subtitle!, style: Theme.of(context).textTheme.bodyMedium),
                ],
                const SizedBox(height: 8),
                Text(
                  price != null ? formatMoney(price, currency) : 'Select options for price',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
                const SizedBox(height: 16),
                for (final option in product.options)
                  OptionGroupPicker(
                    option: option,
                    selectedValue: _selectedOptions[option.id],
                    onSelect: (v) => setState(() {
                      _selectedOptions[option.id] = v;
                      _addError = null;
                    }),
                  ),

                if (isPod && hasLocations) ...[
                  const Divider(height: 32),
                  Text('Your design', style: Theme.of(context).textTheme.titleLarge),
                  const SizedBox(height: 8),
                  Text(
                    'Upload artwork for ${printMeta.printLocations.first.label ?? printMeta.printLocations.first.key}.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 12),
                  _design == null
                      ? OutlinedButton.icon(
                          onPressed: () => _pickDesign(printMeta.printLocations.first),
                          icon: const Icon(Icons.upload_outlined),
                          label: const Text('Upload a design'),
                        )
                      : Row(
                          children: [
                            ClipRRect(
                              borderRadius: BorderRadius.circular(6),
                              child: Image.memory(_design!.previewPngBytes, width: 64, height: 64, fit: BoxFit.cover),
                            ),
                            const SizedBox(width: 12),
                            Expanded(child: Text(_design!.placement.originalFilename, overflow: TextOverflow.ellipsis)),
                            TextButton(
                              onPressed: () => _pickDesign(printMeta.printLocations.first),
                              child: const Text('Change'),
                            ),
                          ],
                        ),
                  if (printMeta.techniques.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('Technique', style: Theme.of(context).textTheme.labelLarge),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      children: printMeta.techniques.map((t) {
                        final selected = t.key == _selectedTechnique;
                        return ChoiceChip(
                          label: Text(t.label ?? t.key),
                          selected: selected,
                          onSelected: (_) => setState(() => _selectedTechnique = t.key),
                        );
                      }).toList(),
                    ),
                  ],
                ],

                const Divider(height: 32),
                Text('Quantity', style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 8),
                if (printMeta.quantityTiers.isNotEmpty)
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: printMeta.quantityTiers.map((tier) {
                      final selected = tier.quantity == _quantity;
                      return ChoiceChip(
                        label: Text('${tier.quantity} · ${formatMoney(tier.unitAmount, currency)}/pc'),
                        selected: selected,
                        onSelected: (_) => setState(() => _quantity = tier.quantity),
                      );
                    }).toList(),
                  )
                else
                  Row(
                    children: [
                      IconButton(
                        onPressed: _quantity > (printMeta.moq ?? 1) ? () => setState(() => _quantity--) : null,
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text('$_quantity', style: Theme.of(context).textTheme.titleMedium),
                      IconButton(onPressed: () => setState(() => _quantity++), icon: const Icon(Icons.add_circle_outline)),
                    ],
                  ),

                const SizedBox(height: 20),
                if (_addError != null) ...[
                  Text(_addError!, style: const TextStyle(color: AppColors.error)),
                  const SizedBox(height: 12),
                ],
                if (_addSuccess) ...[
                  const Text('Added to cart.', style: TextStyle(color: AppColors.sage500)),
                  const SizedBox(height: 12),
                ],
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _adding ? null : () => _addToCart(product, variant?.id),
                    child: _adding
                        ? const SizedBox(height: 18, width: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                        : const Text('Add to cart'),
                  ),
                ),
                const SizedBox(height: 8),
                if (_addSuccess)
                  TextButton(onPressed: () => context.push('/cart'), child: const Text('View cart')),
              ],
            ),
          );
        },
      ),
    );
  }
}
