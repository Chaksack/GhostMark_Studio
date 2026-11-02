import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/region.dart';
import 'providers.dart';

class RegionState {
  const RegionState({this.regions = const [], this.selected});
  final List<Region> regions;
  final Region? selected;
}

/// Loads /store/regions once, restores the persisted gms_region_id choice
/// if still valid, else defaults to the first region returned — same
/// fallback the web's useRegion.ts effectively lands on absent its geo-IP
/// heuristic (which this app deliberately doesn't replicate, per plan).
class RegionNotifier extends AsyncNotifier<RegionState> {
  @override
  Future<RegionState> build() async {
    final regions = await ref.read(regionRepositoryProvider).list();
    if (regions.isEmpty) return const RegionState();

    final storage = ref.read(storageProvider);
    final savedId = storage.regionId;
    final selected = regions.firstWhere(
      (r) => r.id == savedId,
      orElse: () => regions.first,
    );
    await storage.setRegionId(selected.id);
    return RegionState(regions: regions, selected: selected);
  }

  Future<void> select(Region region) async {
    await ref.read(storageProvider).setRegionId(region.id);
    final current = state.value ?? const RegionState();
    state = AsyncData(RegionState(regions: current.regions, selected: region));
  }
}

final regionProvider = AsyncNotifierProvider<RegionNotifier, RegionState>(RegionNotifier.new);
