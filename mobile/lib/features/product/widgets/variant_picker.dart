import 'package:flutter/material.dart';

import '../../../core/theme.dart';
import '../../../models/product.dart';

/// One option group's pill row (e.g. Colour, Size). Selection state is
/// owned by the parent screen (selected values map), mirroring the web's
/// selectedOptions state + resolveVariant() matching.
class OptionGroupPicker extends StatelessWidget {
  const OptionGroupPicker({super.key, required this.option, required this.selectedValue, required this.onSelect});

  final ProductOption option;
  final String? selectedValue;
  final ValueChanged<String> onSelect;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(option.title, style: Theme.of(context).textTheme.labelLarge),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: option.values.map((value) {
            final selected = value == selectedValue;
            return ChoiceChip(
              label: Text(value),
              selected: selected,
              onSelected: (_) => onSelect(value),
              backgroundColor: Colors.white,
              selectedColor: AppColors.ink950,
              labelStyle: TextStyle(color: selected ? Colors.white : AppColors.ink950),
              side: const BorderSide(color: AppColors.greyLines),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
            );
          }).toList(),
        ),
        const SizedBox(height: 16),
      ],
    );
  }
}
