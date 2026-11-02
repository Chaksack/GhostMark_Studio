import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../core/money.dart';
import '../core/theme.dart';
import '../models/product.dart';

class ProductCard extends StatelessWidget {
  const ProductCard({super.key, required this.product, required this.onTap, this.currencyCode});

  final Product product;
  final VoidCallback onTap;
  final String? currencyCode;

  @override
  Widget build(BuildContext context) {
    final prices = product.variants.map((v) => v.calculatedAmount).whereType<double>();
    final minPrice = prices.isEmpty ? null : prices.reduce((a, b) => a < b ? a : b);

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          AspectRatio(
            aspectRatio: 1,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(8),
              child: product.coverImage.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: product.coverImage,
                      fit: BoxFit.cover,
                      placeholder: (_, __) => Container(color: AppColors.creamTile),
                      errorWidget: (_, __, ___) => Container(color: AppColors.creamTile, child: const Icon(Icons.image_not_supported_outlined)),
                    )
                  : Container(color: AppColors.creamTile),
            ),
          ),
          const SizedBox(height: 8),
          Text(product.title, maxLines: 1, overflow: TextOverflow.ellipsis, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: 2),
          Text(
            minPrice != null ? 'From ${formatMoney(minPrice, currencyCode)}' : ' ',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}
